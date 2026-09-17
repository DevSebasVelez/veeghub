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

/** Minutes a NEW lead can sit before the card turns red. */
export const STALE_MINUTES = 30;

export function minutesSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

/** Compact "hace 3 h" style age, for cards where space is tight. */
export function shortAge(date: string) {
  const minutes = minutesSince(date);

  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/** wa.me needs E.164 with no plus sign. */
export function waLink(phone: string | null, name: string) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  const text = encodeURIComponent(
    `Hola ${name.split(" ")[0]}, te escribo de VeegSoft por tu consulta. ¿Tienes un momento?`,
  );

  return `https://wa.me/${digits}?text=${text}`;
}
