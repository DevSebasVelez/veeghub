import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";

import { InfoTip } from "@/components/admin/finance/info-tip";
import { waLink } from "@/components/admin/leads/constants";
import { Button } from "@/components/ui/button";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Lo primero que se lee de un lead del chat: qué quiere, dicho en una línea,
 * el resumen del asistente y qué hacer ahora. El botón de WhatsApp abre el
 * mensaje ya citando su necesidad.
 */
export function LeadAiSummary({
  name,
  phone,
  summary,
  need,
  nextStep,
}: {
  name: string;
  phone: string | null;
  summary: string;
  need: string | null;
  nextStep: string | null;
}) {
  const whatsapp = waLink(phone, name, need);

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-50 via-card to-blue-50 p-5 shadow-xs sm:p-6 dark:from-violet-950/40 dark:via-card dark:to-blue-950/30">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
          <Sparkles className="size-3.5" />
          Resumen del asistente IA
        </span>
        <InfoTip text="Lo escribió el asistente del sitio a partir de la conversación. Confirma los datos al contactar." />
      </div>

      {need ? (
        <h2 className="mt-4 text-pretty text-xl font-semibold tracking-tight sm:text-2xl">
          {capitalize(need)}
        </h2>
      ) : null}
      <p className="mt-2 max-w-3xl text-pretty text-[15px] leading-relaxed text-foreground/80">
        {summary}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {nextStep ? (
          <div className="flex min-w-0 items-start gap-3 rounded-xl bg-background/70 px-3.5 py-2.5 ring-1 ring-border backdrop-blur-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="size-3.5" />
            </span>
            <p className="text-sm">
              <span className="font-medium">Siguiente paso: </span>
              {nextStep}
            </p>
          </div>
        ) : (
          <span />
        )}

        {whatsapp ? (
          <Button
            asChild
            className="h-10 shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              Escribir por WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
