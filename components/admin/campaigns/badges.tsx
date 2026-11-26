import {
  Eye,
  FileText,
  Globe2,
  Heart,
  Camera,
  MessageCircle,
  MessagesSquare,
  Phone,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { ToneTag, type Tone } from "@/components/admin/tone";
import {
  CAMPAIGN_KIND_SHORT,
  DELIVERY_LABELS,
  type CampaignKind,
  type DeliveryState,
} from "@/lib/meta/campaign-kind";
import { cn } from "@/lib/utils";

// Fixed colors from the conventions: active emerald, learning amber, paused
// zinc, problems red, scheduled blue; ended stays neutral.
export const DELIVERY_BADGES: Record<DeliveryState, string> = {
  ACTIVA: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  APRENDIZAJE: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  PROGRAMADA: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PROBLEMAS: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  PAUSADA: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  TERMINADA: "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 dark:text-zinc-500",
};

export const DELIVERY_DOTS: Record<DeliveryState, string> = {
  ACTIVA: "bg-emerald-500",
  APRENDIZAJE: "bg-amber-500",
  PROGRAMADA: "bg-blue-500",
  PROBLEMAS: "bg-red-500",
  PAUSADA: "bg-zinc-400",
  TERMINADA: "bg-zinc-300 dark:bg-zinc-600",
};

export function DeliveryBadge({ state, className }: { state: DeliveryState; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", DELIVERY_BADGES[state], className)}>
      <span className={cn("size-1.5 rounded-full", DELIVERY_DOTS[state], state === "ACTIVA" && "animate-pulse")} />
      {DELIVERY_LABELS[state]}
    </span>
  );
}

export const KIND_STYLE: Record<CampaignKind, { tone: Tone; icon: React.ElementType }> = {
  FORMULARIO: { tone: "violet", icon: FileText },
  WHATSAPP: { tone: "emerald", icon: Phone },
  MESSENGER: { tone: "blue", icon: MessageCircle },
  INSTAGRAM: { tone: "pink", icon: Camera },
  MENSAJES: { tone: "teal", icon: MessagesSquare },
  TRAFICO: { tone: "sky", icon: Globe2 },
  INTERACCION: { tone: "rose", icon: Heart },
  RECONOCIMIENTO: { tone: "indigo", icon: Eye },
  VENTAS: { tone: "amber", icon: ShoppingBag },
  OTRO: { tone: "zinc", icon: Sparkles },
};

export function KindTag({ kind, className }: { kind: CampaignKind; className?: string }) {
  const style = KIND_STYLE[kind];
  return (
    <ToneTag tone={style.tone} icon={style.icon} className={className}>
      {CAMPAIGN_KIND_SHORT[kind]}
    </ToneTag>
  );
}

/** Creative thumbnail from Meta (fbcdn URL, refreshed every sync). */
export function AdThumb({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground", className)} aria-hidden>
        <Sparkles className="size-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fbcdn URLs rotate; next/image would need a remote pattern per CDN host.
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-xl bg-muted object-cover", className)} />
  );
}
