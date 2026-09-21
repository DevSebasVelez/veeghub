import { createHmac, timingSafeEqual } from "crypto";

import { z } from "zod";

import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { normalizePhone } from "@/lib/meta/lead-mapper";

/**
 * Ingesta de leads del sitio público (veegsoft.com).
 *
 * El formulario de contacto de la web manda acá cada envío correcto, además de
 * los dos correos que ya enviaba. Antes un lead del sitio vivía sólo en la
 * bandeja de entrada: no tenía etapa, ni seguimiento, ni quedaba junto a los de
 * Meta. Ahora entra como `Lead` con `source: WEBSITE` y se gestiona igual que
 * el resto.
 *
 * Sigue el mismo trato que el webhook de Meta: firma HMAC sobre el cuerpo
 * crudo, nunca se fusionan duplicados automáticamente y se deja rastro en
 * `LeadActivity`.
 */

const SIGNATURE_PREFIX = "sha256=";

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Define ${name} para la ingesta de leads del sitio web.`);
  }

  return value;
}

export function websiteLeadSecret() {
  return required("WEBSITE_LEAD_SECRET");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  // timingSafeEqual lanza si las longitudes difieren, así que se comparan
  // antes. La longitud en sí no es secreta.
  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida la cabecera `x-veeg-signature` contra el cuerpo CRUDO.
 *
 * Tiene que ser los bytes exactos que mandó el sitio: parsear el JSON y volver
 * a serializarlo produce otro digest y rechazaría todas las entregas. Es la
 * misma razón por la que el webhook de Meta lee `request.text()` primero.
 */
export function verifyWebsiteLeadSignature(
  rawBody: string,
  header: string | null,
) {
  if (!header || !header.startsWith(SIGNATURE_PREFIX)) return false;

  const expected =
    SIGNATURE_PREFIX +
    createHmac("sha256", websiteLeadSecret())
      .update(rawBody, "utf8")
      .digest("hex");

  return safeEqual(header, expected);
}

/**
 * Forma del envío. `name` y `message` son lo único imprescindible: el resto
 * depende de qué formulario del sitio lo manda —el corto de las landings pide
 * menos campos que el de `/contacto`— y un lead sin empresa sigue siendo un
 * lead.
 */
export const websiteLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().max(5000).optional().nullable(),
  /** Servicio elegido, o la página desde la que se envió. */
  serviceTag: z.string().trim().max(120).optional().nullable(),
  /** Ruta del formulario, para saber qué landing convierte. */
  sourcePath: z.string().trim().max(500).optional().nullable(),
});

export type WebsiteLeadInput = z.infer<typeof websiteLeadSchema>;

function limpio(valor: string | null | undefined) {
  const recortado = valor?.trim();
  return recortado ? recortado : null;
}

/**
 * Deja rastro cuando la misma persona vuelve por otro camino.
 *
 * Nunca fusiona: esa decisión es de una persona. Igual que en la ingesta de
 * Meta, sólo escribe una actividad para que se vea en la ficha.
 */
async function marcarPosibleDuplicado(
  leadId: string,
  phone: string | null,
  email: string | null,
) {
  if (!phone && !email) return;

  const anterior = await prisma.lead.findFirst({
    where: {
      id: { not: leadId },
      stage: { not: "LOST" },
      OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  if (!anterior) return;

  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "SYSTEM",
      body: `Posible duplicado del lead ${anterior.name} (${anterior.id}).`,
    },
  });
}

export async function ingestWebsiteLead(input: WebsiteLeadInput) {
  const phoneRaw = limpio(input.phone);
  const phone = normalizePhone(phoneRaw);
  const email = limpio(input.email)?.toLowerCase() ?? null;
  const origen = limpio(input.sourcePath);

  const lead = await prisma.lead.create({
    data: {
      name: input.name.trim(),
      email,
      phone,
      phoneRaw,
      company: limpio(input.company),
      message: limpio(input.message),
      serviceTag: limpio(input.serviceTag),
      source: "WEBSITE",
      rawPayload: input as unknown as Prisma.InputJsonValue,
      activities: {
        create: {
          type: "SYSTEM",
          body: origen
            ? `Lead recibido desde el formulario de ${origen}.`
            : "Lead recibido desde el formulario del sitio web.",
        },
      },
    },
    select: { id: true },
  });

  await marcarPosibleDuplicado(lead.id, phone, email);

  return lead;
}
