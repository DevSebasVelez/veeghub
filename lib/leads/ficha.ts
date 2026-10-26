/**
 * Lectura defensiva de las columnas JSON del lead para la ficha.
 *
 * `aiInsights`, `conversation` y `rawPayload` son `Json` en Prisma: lo que
 * entra lo valida la ingesta, pero un lead editado a mano, importado o de una
 * versión anterior puede traer cualquier forma. La ficha nunca debe romperse
 * por eso, así que todo lo que no tenga la forma esperada se descarta.
 */

export type AiInsights = {
  necesidad: string | null;
  servicio: string | null;
  urgencia: string | null;
  plazo: string | null;
  preferenciaContacto: string | null;
  presupuestoMencionado: string | null;
  siguientePaso: string | null;
  ubicacion: string | null;
};

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type WebOrigin = {
  sourcePath: string | null;
  landing: string | null;
  businessType: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  googleAdsClick: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readInsights(value: unknown): AiInsights | null {
  if (!isRecord(value)) return null;

  return {
    necesidad: text(value.necesidad),
    servicio: text(value.servicio),
    urgencia: text(value.urgencia),
    plazo: text(value.plazo),
    preferenciaContacto: text(value.preferenciaContacto),
    presupuestoMencionado: text(value.presupuestoMencionado),
    siguientePaso: text(value.siguientePaso),
    ubicacion: text(value.ubicacion),
  };
}

export function readConversation(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((turn) => {
    if (!isRecord(turn)) return [];
    const body = text(turn.text);
    if (!body) return [];
    if (turn.role !== "user" && turn.role !== "assistant") return [];
    return [{ role: turn.role, text: body }];
  });
}

/** Sólo devuelve algo si el payload trae al menos un dato de origen web. */
export function readWebOrigin(value: unknown): WebOrigin | null {
  if (!isRecord(value)) return null;

  const a = isRecord(value.attribution) ? value.attribution : {};
  const origin: WebOrigin = {
    sourcePath: text(value.sourcePath),
    landing: text(value.landing),
    businessType: text(value.businessType),
    utmSource: text(a.utm_source),
    utmMedium: text(a.utm_medium),
    utmCampaign: text(a.utm_campaign),
    utmTerm: text(a.utm_term),
    googleAdsClick: Boolean(text(a.gclid) || text(a.gbraid) || text(a.wbraid)),
  };

  const { googleAdsClick, ...rest } = origin;
  const hasAny = googleAdsClick || Object.values(rest).some(Boolean);

  return hasAny ? origin : null;
}
