export const STAGE_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUALIFIED: "Calificado",
  PROPOSAL: "Propuesta",
  NEGOTIATION: "Negociación",
  WON: "Ganado",
  LOST: "Perdido",
};

export const SOURCE_LABELS: Record<string, string> = {
  META_ADS: "Meta Ads",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referido",
  WEBSITE: "Sitio web",
  WEB_CHAT: "Chat IA web",
  MANUAL: "Manual",
  CSV_IMPORT: "Importado CSV",
  OTHER: "Otro",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  NOTE: "Nota",
  CALL: "Llamada",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Reunión",
  STAGE_CHANGE: "Cambio de etapa",
  SYSTEM: "Sistema",
};

export const STAGE_TEXT_COLOR: Record<string, string> = {
  NEW: "text-violet-600 dark:text-violet-400",
  CONTACTED: "text-blue-600 dark:text-blue-400",
  QUALIFIED: "text-cyan-600 dark:text-cyan-400",
  PROPOSAL: "text-amber-600 dark:text-amber-400",
  NEGOTIATION: "text-orange-600 dark:text-orange-400",
  WON: "text-emerald-600 dark:text-emerald-400",
  LOST: "text-muted-foreground line-through",
};

/** Qué tan listo está para comprar, según el asistente IA del sitio. */
export const TEMPERATURE_LABELS: Record<string, string> = {
  HOT: "Caliente",
  WARM: "Tibio",
  COLD: "Frío",
};

/** Minutes a NEW lead can sit before the card turns red. */
export const STALE_MINUTES = 30;

/**
 * wa.me needs E.164 with no plus sign. `about` is what the lead asked for —
 * the chat's summary of their need — so the first message shows we read it.
 */
export function waLink(phone: string | null, name: string, about?: string | null) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  const firstName = name.split(" ")[0];
  const text = encodeURIComponent(
    about
      ? `Hola ${firstName}, te escribo de VeegSoft por lo que conversaste en nuestra web sobre ${about.replace(/[.\s]+$/, "")}. ¿Tienes un momento para contarme un poco más?`
      : `Hola ${firstName}, te escribo de VeegSoft por tu consulta. ¿Tienes un momento?`,
  );

  return `https://wa.me/${digits}?text=${text}`;
}
