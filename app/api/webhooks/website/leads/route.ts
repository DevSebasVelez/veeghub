import { after } from "next/server";

import { notifyNewLead } from "@/lib/notifications/lead-alert";
import {
  ingestWebsiteLead,
  type WebsiteLeadResult,
  verifyWebsiteLeadSignature,
  websiteLeadSchema,
} from "@/lib/leads/website";

// Escribe en la base en cada petición: nada que cachear.
export const dynamic = "force-dynamic";

/**
 * Entrada de leads desde veegsoft.com.
 *
 * El sitio público llama acá después de que su formulario de contacto responde
 * bien, y cuando su asistente IA registra a un visitante (`channel: "chat"`). A diferencia del webhook de Meta, el emisor es nuestro, así que el
 * lead se crea en la propia petición en vez de en `after()`: la web ya le
 * respondió al visitante antes de llamarnos y nadie está esperando. Así, si la
 * creación falla, el sitio lo ve en el código de estado y puede registrarlo.
 */
export async function POST(request: Request) {
  // Bytes exactos: la firma se calcula sobre el cuerpo crudo, y volver a
  // serializar el JSON parseado cambiaría el digest.
  const rawBody = await request.text();

  if (!verifyWebsiteLeadSignature(rawBody, request.headers.get("x-veeg-signature"))) {
    console.warn("[web] firma inválida en la ingesta de leads");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = websiteLeadSchema.safeParse(payload);

  if (!parsed.success) {
    console.warn("[web] payload de lead inválido", parsed.error.issues);
    return Response.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const lead = await ingestWebsiteLead(parsed.data);
  console.log(lead.created ? "[web] lead creado" : "[web] lead actualizado", lead.id);

  // Sólo al crear: si el asistente vuelve a registrar la misma conversación,
  // ya hubo aviso y un segundo push sería ruido.
  if (lead.created) {
    after(async () => {
      try {
        await notifyNewLead(alertFor(lead));
      } catch (error) {
        console.error("[web] no se pudo notificar el lead", lead.id, error);
      }
    });
  }

  return Response.json(
    { received: true, leadId: lead.id, created: lead.created },
    { status: lead.created ? 201 : 200 },
  );
}

const TEMPERATURA: Record<string, string> = {
  HOT: "🔥 Caliente",
  WARM: "🌤️ Tibio",
  COLD: "❄️ Frío",
};

/** El push tiene poco espacio: lo primero es qué quiere, no de dónde vino. */
function alertFor(lead: WebsiteLeadResult) {
  if (lead.channel === "chat") {
    const resumen = lead.aiSummary ?? "";
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      serviceTag: lead.serviceTag,
      campaign: null,
      title: `${lead.temperature ? TEMPERATURA[lead.temperature] : "Lead"} · Chat IA: ${lead.name}`,
      body: resumen.length > 160 ? `${resumen.slice(0, 157)}…` : resumen,
    };
  }

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    serviceTag: lead.serviceTag,
    campaign: null,
    title: `Nuevo lead del sitio: ${lead.name}`,
    body:
      [lead.serviceTag, lead.phone].filter(Boolean).join(" · ") ||
      "Formulario del sitio web",
  };
}
