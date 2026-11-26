/**
 * Labels, colors and limits of the marketing module. No server imports: the
 * post editor and the calendar read these on the client.
 */

export const CONTENT_CHANNELS = [
  "LINKEDIN_PERSONAL",
  "LINKEDIN_COMPANY",
  "GBP",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "BLOG",
] as const;

export type ContentChannelValue = (typeof CONTENT_CHANNELS)[number];

export const CONTENT_STATUSES = [
  "IDEA",
  "BORRADOR",
  "EN_REVISION",
  "APROBADO",
  "PROGRAMADO",
  "PUBLICADO",
  "FALLIDO",
  "DESCARTADO",
] as const;

export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

export const ASSET_KINDS = [
  "IMAGEN",
  "VIDEO",
  "RENDER_3D",
  "CAPTURA",
  "LOGO",
  "PLANTILLA",
  "OTRO",
] as const;

export type AssetKindValue = (typeof ASSET_KINDS)[number];

type ChannelInfo = {
  label: string;
  short: string;
  /** Hard limit of the post body, when the channel has one. */
  maxChars?: number;
  /** utm_source / utm_medium (decision 10 of the plan). */
  utmSource: string;
  utmMedium: "social" | "organic";
  /** Where «Abrir canal» lands while there is no API (F6). */
  openUrl: string;
  /** LinkedIn puts the link in the first comment, not in the post. */
  linkInComment: boolean;
  chip: string;
  dot: string;
};

export const CHANNELS: Record<ContentChannelValue, ChannelInfo> = {
  LINKEDIN_PERSONAL: {
    label: "LinkedIn (perfil)",
    short: "LinkedIn",
    maxChars: 3000,
    utmSource: "linkedin",
    utmMedium: "social",
    openUrl: "https://www.linkedin.com/feed/?shareActive=true",
    linkInComment: true,
    chip: "bg-sky-500/15 text-sky-800 hover:bg-sky-500/25 dark:text-sky-200",
    dot: "bg-sky-600",
  },
  LINKEDIN_COMPANY: {
    label: "LinkedIn (página)",
    short: "LinkedIn pág.",
    maxChars: 3000,
    utmSource: "linkedin",
    utmMedium: "social",
    openUrl: "https://www.linkedin.com/company/veegsoft/admin/",
    linkInComment: true,
    chip: "bg-cyan-500/15 text-cyan-800 hover:bg-cyan-500/25 dark:text-cyan-200",
    dot: "bg-cyan-600",
  },
  GBP: {
    label: "Google Business Profile",
    short: "GBP",
    maxChars: 1500,
    utmSource: "gbp",
    utmMedium: "organic",
    openUrl: "https://business.google.com/",
    linkInComment: false,
    chip: "bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
    dot: "bg-emerald-600",
  },
  INSTAGRAM: {
    label: "Instagram",
    short: "Instagram",
    maxChars: 2200,
    utmSource: "instagram",
    utmMedium: "social",
    openUrl: "https://www.instagram.com/",
    linkInComment: false,
    chip: "bg-rose-500/15 text-rose-800 hover:bg-rose-500/25 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  FACEBOOK: {
    label: "Facebook",
    short: "Facebook",
    maxChars: 63206,
    utmSource: "facebook",
    utmMedium: "social",
    openUrl: "https://business.facebook.com/latest/composer",
    linkInComment: false,
    chip: "bg-blue-500/15 text-blue-800 hover:bg-blue-500/25 dark:text-blue-200",
    dot: "bg-blue-600",
  },
  TIKTOK: {
    label: "TikTok",
    short: "TikTok",
    maxChars: 2200,
    utmSource: "tiktok",
    utmMedium: "social",
    openUrl: "https://www.tiktok.com/upload",
    linkInComment: false,
    chip: "bg-zinc-500/15 text-zinc-800 hover:bg-zinc-500/25 dark:text-zinc-200",
    dot: "bg-zinc-700 dark:bg-zinc-300",
  },
  YOUTUBE: {
    label: "YouTube",
    short: "YouTube",
    maxChars: 5000,
    utmSource: "youtube",
    utmMedium: "social",
    openUrl: "https://studio.youtube.com/",
    linkInComment: false,
    chip: "bg-red-500/15 text-red-800 hover:bg-red-500/25 dark:text-red-200",
    dot: "bg-red-600",
  },
  BLOG: {
    label: "Blog",
    short: "Blog",
    utmSource: "blog",
    utmMedium: "organic",
    openUrl: "https://veegsoft.com/blog",
    linkInComment: false,
    chip: "bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-200",
    dot: "bg-amber-600",
  },
};

export const STATUS_LABELS: Record<ContentStatusValue, string> = {
  IDEA: "Idea",
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  APROBADO: "Aprobado",
  PROGRAMADO: "Por publicar",
  PUBLICADO: "Publicado",
  FALLIDO: "Fallido",
  DESCARTADO: "Descartado",
};

export const STATUS_BADGES: Record<ContentStatusValue, string> = {
  IDEA: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  BORRADOR:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  EN_REVISION:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APROBADO:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PROGRAMADO:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  PUBLICADO:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  FALLIDO:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  DESCARTADO:
    "border-zinc-200 bg-zinc-50 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500",
};

/** Statuses that still need someone to act before the post is out. */
export const OPEN_STATUSES: ContentStatusValue[] = [
  "IDEA",
  "BORRADOR",
  "EN_REVISION",
  "APROBADO",
  "PROGRAMADO",
  "FALLIDO",
];

export const ASSET_KIND_LABELS: Record<AssetKindValue, string> = {
  IMAGEN: "Imagen",
  VIDEO: "Video",
  RENDER_3D: "Render 3D",
  CAPTURA: "Captura",
  LOGO: "Logo",
  PLANTILLA: "Plantilla",
  OTRO: "Otro",
};

/** R2 prefix of the library. Uploads outside it are rejected. */
export const ASSET_PREFIX = "marketing/";

export function isChannel(value: unknown): value is ContentChannelValue {
  return CONTENT_CHANNELS.includes(value as ContentChannelValue);
}

export function isStatus(value: unknown): value is ContentStatusValue {
  return CONTENT_STATUSES.includes(value as ContentStatusValue);
}

export function isAssetKind(value: unknown): value is AssetKindValue {
  return ASSET_KINDS.includes(value as AssetKindValue);
}

// ─── Banco de ideas (F2) ────────────────────────────────────────────────────

export const IDEA_STAGES = ["IDEA", "GUION", "GRABADO", "EDITADO", "PUBLICADO", "ARCHIVADO"] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number];

export function isIdeaStage(value: unknown): value is IdeaStage {
  return typeof value === "string" && (IDEA_STAGES as readonly string[]).includes(value);
}

export const IDEA_STAGE_LABELS: Record<IdeaStage, string> = {
  IDEA: "Idea",
  GUION: "Lista para grabar",
  GRABADO: "Grabado",
  EDITADO: "Editado",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

/** What comes next, for the one-tap «advance» button. */
export const IDEA_NEXT_STAGE: Partial<Record<IdeaStage, IdeaStage>> = {
  IDEA: "GUION",
  GUION: "GRABADO",
  GRABADO: "EDITADO",
  EDITADO: "PUBLICADO",
};

/** Conventions §5: zinc neutral, blue ready, amber in progress, orange act now, emerald done. */
export const IDEA_STAGE_BADGES: Record<IdeaStage, string> = {
  IDEA: STATUS_BADGES.BORRADOR,
  GUION: STATUS_BADGES.APROBADO,
  GRABADO: STATUS_BADGES.EN_REVISION,
  EDITADO: STATUS_BADGES.PROGRAMADO,
  PUBLICADO: STATUS_BADGES.PUBLICADO,
  ARCHIVADO: STATUS_BADGES.DESCARTADO,
};

export const IDEA_STAGE_DOTS: Record<IdeaStage, string> = {
  IDEA: "bg-zinc-400",
  GUION: "bg-blue-500",
  GRABADO: "bg-amber-500",
  EDITADO: "bg-orange-500",
  PUBLICADO: "bg-emerald-500",
  ARCHIVADO: "bg-zinc-300",
};
