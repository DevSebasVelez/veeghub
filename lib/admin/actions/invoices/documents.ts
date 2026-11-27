"use server";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult } from "@/lib/admin/actions/shared";
import { fromCents } from "@/lib/admin/finance/money";
import { compactId } from "@/lib/admin/slug";
import { COMPANY } from "@/lib/company";
import { uploadToR2 } from "@/lib/storage/r2";
import { type SriEnvironment, parseAccessKey } from "@/lib/sri/access-key";
import { SriXmlError, parseSriInvoiceXml, type SriInvoice } from "@/lib/sri/invoice-xml";
import { parseRideText } from "@/lib/sri/ride";
import { checkAuthorizationStatus, fetchAuthorization } from "@/lib/sri/ws";

// Reading SRI documents in the invoice dialog. Three entry points (the XML,
// the RIDE PDF, or just the clave) end in the same analysis, so the dialog
// prefills the same fields whatever the person has at hand. Nothing here
// creates an invoice; only an XML fetched from the SRI is stored, so it can be
// attached when the invoice is saved.

export type InvoiceDocSource =
  /** The XML the person uploaded. */
  | "XML"
  /** XML downloaded from the SRI web service. */
  | "SRI"
  /** Read from the RIDE's text: confirm the amounts. */
  | "RIDE"
  /** Only the clave: number, date and environment. */
  | "CLAVE";

export type InvoiceDocAnalysis = {
  source: InvoiceDocSource;
  number: string;
  accessKey: string;
  /** "yyyy-MM-dd" */
  issueDay: string;
  environment: SriEnvironment;
  subtotal: string | null;
  taxAmount: string | null;
  vatRate: string | null;
  total: string | null;
  buyer: { id: string | null; name: string | null };
  items: Array<{ description: string; total: string }>;
  /** Client whose RUC/cédula matches the buyer, if any. */
  client: { id: string; name: string } | null;
  /** Another invoice already registered with this clave. */
  duplicate: { id: string; number: string | null } | null;
  /** XML fetched from the SRI and stored, to attach as the invoice's XML. */
  attachedXml: { objectKey: string; name: string; mimeType: string; size: number } | null;
  warnings: string[];
};

const MAX_XML_BYTES = 512 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

type Draft = Omit<InvoiceDocAnalysis, "client" | "duplicate"> & { emitterRuc: string };

/** Client match, duplicate check and the warnings every source shares. */
async function finish(draft: Draft, currentInvoiceId: string | null | undefined): Promise<InvoiceDocAnalysis> {
  const { emitterRuc, ...analysis } = draft;
  const warnings = [...analysis.warnings];

  if (COMPANY.taxId && emitterRuc !== COMPANY.taxId) {
    warnings.unshift(`La factura fue emitida por otro RUC (${emitterRuc}), no por ${COMPANY.brand}.`);
  }

  // RUC of a persona natural = cédula + "001": match either form.
  const buyerId = analysis.buyer.id;
  const ids = buyerId ? [...new Set([buyerId, buyerId.slice(0, 10)])] : [];
  const [client, duplicate] = await Promise.all([
    ids.length
      ? prisma.client.findFirst({
          where: { OR: [{ taxId: { in: ids } }, ...ids.map((id) => ({ taxId: { startsWith: id } }))] },
          select: { id: true, name: true },
        })
      : null,
    prisma.invoice.findFirst({
      where: {
        accessKey: analysis.accessKey,
        ...(currentInvoiceId ? { id: { not: currentInvoiceId } } : {}),
      },
      select: { id: true, invoiceNumber: true },
    }),
  ]);

  if (buyerId && !client) {
    warnings.push(
      `Ningún cliente tiene el RUC o cédula ${buyerId}${analysis.buyer.name ? ` (${analysis.buyer.name})` : ""}. Elige el cliente a mano o agrégale el RUC.`,
    );
  }

  return {
    ...analysis,
    client,
    duplicate: duplicate ? { id: duplicate.id, number: duplicate.invoiceNumber } : null,
    warnings,
  };
}

function fromXml(inv: SriInvoice, source: "XML" | "SRI", attachedXml: InvoiceDocAnalysis["attachedXml"]): Draft {
  return {
    source,
    number: inv.number,
    accessKey: inv.accessKey,
    issueDay: inv.issueDay,
    environment: inv.environment,
    subtotal: fromCents(inv.subtotalCents),
    taxAmount: fromCents(inv.vatCents),
    vatRate: inv.vatRate == null ? null : String(inv.vatRate),
    total: fromCents(inv.totalCents),
    buyer: { id: inv.buyer.id, name: inv.buyer.name },
    items: inv.items.map((i) => ({ description: i.description, total: fromCents(i.totalCents) })),
    attachedXml,
    warnings: inv.warnings,
    emitterRuc: inv.emitter.ruc,
  };
}

/**
 * Asks the SRI for the authorized XML of a clave. When it still serves it,
 * the XML is stored and becomes the source of truth; when it does not (web
 * facturador, older invoices, SRI down) the caller falls back to what it has.
 */
async function tryDownloadXml(accessKey: string, env: SriEnvironment) {
  try {
    const result = await fetchAuthorization(accessKey, env);
    if (!result.found || result.status !== "AUTORIZADO") return null;
    const inv = parseSriInvoiceXml(result.xml);
    const body = Buffer.from(result.xml, "utf8");
    const name = `${accessKey}.xml`;
    const objectKey = `drive/${Date.now()}-${compactId()}-${name}`;
    await uploadToR2({ key: objectKey, body, contentType: "application/xml" });
    return fromXml(inv, "SRI", { objectKey, name, mimeType: "application/xml", size: body.length });
  } catch {
    return null;
  }
}

const NOT_SERVED =
  "El SRI no entrega el XML de esta factura por servicio web. Si lo necesitas, descárgalo de SRI en línea (Comprobantes electrónicos › Consultas) y súbelo.";

/** XML uploaded by the person. */
export async function analyzeInvoiceXml(xml: string, currentInvoiceId?: string | null) {
  await requireAdmin();

  return actionResult(async () => {
    if (xml.length > MAX_XML_BYTES) throw new SriXmlError("El XML es demasiado grande.");
    return finish(fromXml(parseSriInvoiceXml(xml), "XML", null), currentInvoiceId);
  });
}

/** RIDE PDF: the clave from its text, then the SRI's XML or the RIDE's own figures. */
export async function analyzeInvoiceRide(formData: FormData) {
  await requireAdmin();

  return actionResult(async () => {
    const file = formData.get("file");
    const currentInvoiceId = formData.get("currentInvoiceId")?.toString() || null;
    if (!(file instanceof File)) throw new Error("No llegó el PDF.");
    if (file.size > MAX_PDF_BYTES) throw new Error("El PDF pesa más de 5 MB.");

    let text: string;
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      text = (await extractText(pdf, { mergePages: true })).text;
    } catch {
      throw new Error("No se pudo leer el PDF.");
    }

    const ride = parseRideText(text);
    if (!ride) {
      throw new Error(
        "No se encontró una clave de acceso válida en el PDF. Si el RIDE es una imagen escaneada, pega la clave a mano.",
      );
    }

    const downloaded = await tryDownloadXml(ride.accessKey, ride.key.environment);
    if (downloaded) return finish(downloaded, currentInvoiceId);

    return finish(
      {
        source: "RIDE",
        number: ride.number,
        accessKey: ride.accessKey,
        issueDay: ride.key.issueDay,
        environment: ride.key.environment,
        subtotal: ride.subtotalCents == null ? null : fromCents(ride.subtotalCents),
        taxAmount: ride.vatCents == null ? null : fromCents(ride.vatCents),
        vatRate: ride.vatRate == null ? null : String(ride.vatRate),
        total: ride.totalCents == null ? null : fromCents(ride.totalCents),
        buyer: ride.buyer,
        items: [],
        attachedXml: null,
        warnings: [...ride.warnings, "Montos leídos del texto del RIDE: confírmalos.", NOT_SERVED],
        emitterRuc: ride.key.ruc,
      },
      currentInvoiceId,
    );
  });
}

/** Just the clave, pasted. */
export async function analyzeAccessKey(rawKey: string, currentInvoiceId?: string | null) {
  await requireAdmin();

  return actionResult(async () => {
    const accessKey = rawKey.replace(/\D/g, "");
    const key = parseAccessKey(accessKey);
    if (!key) throw new Error("La clave debe tener 49 dígitos y un dígito verificador válido.");
    if (key.docType !== "01") throw new Error(`La clave es de un comprobante tipo ${key.docType}, no de una factura (01).`);

    const downloaded = await tryDownloadXml(accessKey, key.environment);
    if (downloaded) return finish(downloaded, currentInvoiceId);

    return finish(
      {
        source: "CLAVE",
        number: `${key.establishment}-${key.emissionPoint}-${key.sequential}`,
        accessKey,
        issueDay: key.issueDay,
        environment: key.environment,
        subtotal: null,
        taxAmount: null,
        vatRate: null,
        total: null,
        buyer: { id: null, name: null },
        items: [],
        attachedXml: null,
        warnings: [
          ...(key.environment === "PRUEBAS"
            ? ["La factura es del ambiente de PRUEBAS del SRI: no tiene validez tributaria."]
            : []),
          "De la clave solo salen el número, la fecha y el ambiente: completa los montos y el cliente.",
          NOT_SERVED,
        ],
        emitterRuc: key.ruc,
      },
      currentInvoiceId,
    );
  });
}

export type SriVerification = {
  state: "AUTORIZADO" | "NO_AUTORIZADO" | "NO_VERIFICABLE" | "SIN_CONEXION";
  detail: string | null;
};

/**
 * Status of a clave at the SRI, checked after the form is already filled so
 * a slow SRI never blocks it. The SRI only answers for recent invoices.
 */
export async function verifyWithSri(accessKey: string) {
  await requireAdmin();

  return actionResult<SriVerification>(async () => {
    const key = parseAccessKey(accessKey);
    if (!key) return { state: "NO_VERIFICABLE", detail: "Clave de acceso inválida." };
    try {
      const status = await checkAuthorizationStatus(accessKey, key.environment);
      const detail = status.messages.map((m) => m.detail ?? m.text).filter(Boolean).join(" ") || null;
      if (status.state === "AUTORIZADO") {
        return { state: "AUTORIZADO", detail: status.authorizedAt };
      }
      if (status.state === "NO AUTORIZADO" || status.state === "NO_AUTORIZADO") {
        return { state: "NO_AUTORIZADO", detail };
      }
      if (detail && /fuera del rango/i.test(detail)) {
        return { state: "NO_VERIFICABLE", detail: "El SRI solo permite consultar facturas recientes." };
      }
      return { state: "NO_VERIFICABLE", detail };
    } catch (error) {
      return { state: "SIN_CONEXION", detail: error instanceof Error ? error.message : null };
    }
  });
}
