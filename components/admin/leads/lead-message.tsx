import { MessageCircle, Quote } from "lucide-react";

import { waLink } from "@/components/admin/leads/constants";
import { Button } from "@/components/ui/button";

/**
 * Para los leads sin resumen IA (formulario, Meta, manual): lo que escribió
 * ocupa el mismo lugar destacado que el resumen del chat, porque es lo mismo
 * que hay que leer antes de contactar.
 */
export function LeadMessage({
  message,
  title,
  phone,
  name,
}: {
  message: string;
  title: string;
  phone: string | null;
  name: string;
}) {
  const whatsapp = waLink(phone, name);

  return (
    <section className="rounded-2xl border bg-gradient-to-br from-blue-50 via-card to-card p-5 shadow-xs sm:p-6 dark:from-blue-950/30 dark:via-card">
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-200">
          <Quote className="size-3.5" />
          {title}
        </span>
        {whatsapp ? (
          <Button
            asChild
            className="h-10 shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">Escribir por WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>
          </Button>
        ) : null}
      </div>
      <p className="mt-4 max-w-3xl whitespace-pre-wrap text-pretty text-[15px] leading-relaxed">
        {message}
      </p>
    </section>
  );
}
