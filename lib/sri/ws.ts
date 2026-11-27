import { XMLParser } from "fast-xml-parser";

import type { SriEnvironment } from "@/lib/sri/access-key";

// Read-only calls to the SRI web services (esquema offline). Plain fetch +
// a hand-written SOAP envelope: two fixed operations do not justify a SOAP
// client. Every call has a short timeout: the SRI is often slow or down and
// the invoice form must keep working without it.

const HOSTS: Record<SriEnvironment, string> = {
  PRUEBAS: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws",
  PRODUCCION: "https://cel.sri.gob.ec/comprobantes-electronicos-ws",
};

// The SRI sometimes leaves a request hanging while the next one answers in
// 100 ms: short timeout, one retry.
const TIMEOUT_MS = 5000;
const ATTEMPTS = 2;

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: true,
  isArray: (name) => ["autorizacion", "mensaje"].includes(name),
});

export type SriMessage = { id: string | null; text: string | null; detail: string | null; type: string | null };

async function soap(url: string, namespace: string, operation: string, body: string) {
  const envelope =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="${namespace}">` +
    `<soapenv:Header/><soapenv:Body><ec:${operation}>${body}</ec:${operation}></soapenv:Body></soapenv:Envelope>`;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/xml;charset=UTF-8" },
        body: envelope,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      break;
    } catch (error) {
      if (attempt === ATTEMPTS) {
        throw new Error(
          error instanceof Error && error.name === "TimeoutError"
            ? "El SRI no respondió a tiempo."
            : "No se pudo conectar con el SRI.",
        );
      }
    }
  }
  const text = await response!.text();
  if (!response!.ok && !text.includes("Envelope")) {
    throw new Error(`El SRI respondió ${response!.status}.`);
  }
  return text;
}

function messages(node: unknown): SriMessage[] {
  const list = (node as { mensaje?: unknown[] } | undefined)?.mensaje ?? [];
  return list.map((m) => {
    const msg = m as Record<string, unknown>;
    // <mensaje><mensaje>texto</mensaje></mensaje>: the inner one is also
    // parsed as an array because of the shared tag name.
    const str = (v: unknown): string | null =>
      typeof v === "string" ? v : Array.isArray(v) ? str(v[0]) : null;
    return {
      id: str(msg.identificador),
      text: str(msg.mensaje),
      detail: str(msg.informacionAdicional),
      type: str(msg.tipo),
    };
  });
}

export type AuthorizationResult =
  | {
      found: true;
      status: string | null;
      /** The <autorizacion> element as XML, ready to store as the invoice file. */
      xml: string;
    }
  | { found: false };

/**
 * autorizacionComprobante(clave): the authorized XML, when the SRI still
 * serves it. Invoices issued from the SRI web facturador, or older ones, come
 * back with zero comprobantes.
 */
export async function fetchAuthorization(accessKey: string, env: SriEnvironment): Promise<AuthorizationResult> {
  const text = await soap(
    `${HOSTS[env]}/AutorizacionComprobantesOffline`,
    "http://ec.gob.sri.ws.autorizacion",
    "autorizacionComprobante",
    `<claveAccesoComprobante>${accessKey}</claveAccesoComprobante>`,
  );
  const start = text.indexOf("<autorizacion>");
  const end = text.lastIndexOf("</autorizacion>");
  if (start < 0 || end < 0) return { found: false };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>${text.slice(start, end + "</autorizacion>".length)}`;
  const parsed = parser.parse(xml) as { autorizacion?: Array<{ estado?: string }> };
  return { found: true, status: parsed.autorizacion?.[0]?.estado ?? null, xml };
}

export type StatusResult = {
  /** AUTORIZADO, NO AUTORIZADO, RECHAZADA (query refused), ... */
  state: string | null;
  authorizedAt: string | null;
  messages: SriMessage[];
};

/** consultarEstadoAutorizacionComprobante(clave) — ficha 2.31. */
export async function checkAuthorizationStatus(accessKey: string, env: SriEnvironment): Promise<StatusResult> {
  const text = await soap(
    `${HOSTS[env]}/ConsultaComprobante`,
    "http://ec.gob.sri.ws.consultas",
    "consultarEstadoAutorizacionComprobante",
    `<claveAcceso>${accessKey}</claveAcceso>`,
  );
  const doc = parser.parse(text) as Record<string, unknown>;
  const find = (value: unknown, key: string): unknown => {
    if (!value || typeof value !== "object") return undefined;
    if (key in (value as object)) return (value as Record<string, unknown>)[key];
    for (const child of Object.values(value as object)) {
      const found = find(child, key);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const node = find(doc, "EstadoAutorizacionComprobante") as Record<string, unknown> | undefined;
  const fault = find(doc, "faultstring");
  if (!node) throw new Error(typeof fault === "string" ? fault : "Respuesta inesperada del SRI.");

  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    state: str(node.estadoAutorizacion) ?? str(node.estadoConsulta),
    authorizedAt: str(node.fechaAutorizacion),
    messages: messages(node.mensajes),
  };
}
