"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Mail, MessageCircle, Phone } from "lucide-react";

import { markLeadContacted } from "@/lib/admin/actions/leads/actions";
import { waLink } from "@/components/admin/leads/constants";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The three taps that matter on a phone: WhatsApp, call, and "I contacted them".
 * Everything else about a lead can wait until you are at a desk.
 */
export function LeadQuickActions({
  id,
  name,
  phone,
  email,
  contacted,
  size = "sm",
}: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contacted: boolean;
  size?: "sm" | "icon";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const whatsapp = waLink(phone, name);

  function handleContacted() {
    startTransition(async () => {
      try {
        await markLeadContacted(id);
        router.refresh();
        toast.success("Marcado como contactado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  // 40px en móvil: por debajo de eso, fallar el botón de WhatsApp es común.
  const buttonClass =
    size === "icon" ? "size-10 md:size-7" : "size-10 md:h-7 md:w-auto md:px-2";
  const iconClass = "size-[18px] md:size-3.5";

  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      {whatsapp ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={`${buttonClass} text-emerald-600 hover:text-emerald-700 dark:text-emerald-400`}
            >
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className={iconClass} />
                <span className="sr-only">WhatsApp</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>WhatsApp</TooltipContent>
        </Tooltip>
      ) : null}

      {phone ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className={buttonClass}>
              <a href={`tel:${phone}`}>
                <Phone className={iconClass} />
                <span className="sr-only">Llamar</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Llamar {phone}</TooltipContent>
        </Tooltip>
      ) : null}

      {email ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className={buttonClass}>
              <a href={`mailto:${email}`}>
                <Mail className={iconClass} />
                <span className="sr-only">Email</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{email}</TooltipContent>
        </Tooltip>
      ) : null}

      {!contacted ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={buttonClass}
              disabled={pending}
              onClick={handleContacted}
            >
              <Check className={iconClass} />
              <span className="sr-only">Marcar contactado</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Marcar contactado</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
