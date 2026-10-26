"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";

import { markLeadContacted } from "@/lib/admin/actions/leads/actions";
import { unwrap } from "@/lib/admin/actions/types";
import { waLink } from "@/components/admin/leads/constants";
import { cn } from "@/lib/utils";

const TILE: Record<string, string> = {
  whatsapp:
    "bg-emerald-500 text-white group-hover:bg-emerald-600 dark:bg-emerald-600 dark:group-hover:bg-emerald-500",
  call: "bg-blue-500 text-white group-hover:bg-blue-600 dark:bg-blue-600 dark:group-hover:bg-blue-500",
  email:
    "bg-violet-500 text-white group-hover:bg-violet-600 dark:bg-violet-600 dark:group-hover:bg-violet-500",
  done: "bg-muted text-foreground group-hover:bg-accent",
};

function Tile({
  icon: Icon,
  label,
  tone,
  href,
  external,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  tone: keyof typeof TILE;
  href?: string | null;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl shadow-xs transition-colors",
          disabled ? "bg-muted text-muted-foreground/50" : TILE[tone],
        )}
      >
        <Icon className="size-5" />
      </span>
      <span
        className={cn(
          "text-xs font-medium",
          disabled ? "text-muted-foreground/60" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {label}
      </span>
    </>
  );

  const className =
    "group flex min-w-16 flex-col items-center gap-1.5 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={className}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cn(className, disabled && "cursor-not-allowed")}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      {inner}
    </button>
  );
}

/**
 * Las cuatro acciones de un lead como mosaicos con icono y nombre, igual que
 * la ficha de contacto de cualquier CRM: se reconocen sin leer. Las que no
 * aplican (sin correo, ya contactado) quedan visibles y apagadas, para que la
 * fila no cambie de forma de un lead a otro.
 */
export function LeadContactTiles({
  id,
  name,
  phone,
  email,
  contacted,
  about,
}: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contacted: boolean;
  about?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleContacted() {
    startTransition(async () => {
      try {
        unwrap(await markLeadContacted(id));
        router.refresh();
        toast.success("Marcado como contactado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="flex justify-center gap-2">
      <Tile
        icon={MessageCircle}
        label="WhatsApp"
        tone="whatsapp"
        href={waLink(phone, name, about)}
        external
        disabled={!phone}
      />
      <Tile
        icon={Phone}
        label="Llamar"
        tone="call"
        href={phone ? `tel:${phone}` : null}
        disabled={!phone}
      />
      <Tile
        icon={Mail}
        label="Correo"
        tone="email"
        href={email ? `mailto:${email}` : null}
        disabled={!email}
      />
      <Tile
        icon={Check}
        label={contacted ? "Contactado" : "Marcar"}
        tone="done"
        onClick={handleContacted}
        disabled={contacted || pending}
      />
    </div>
  );
}
