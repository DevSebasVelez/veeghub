"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatTurn } from "@/lib/leads/ficha";
import { cn } from "@/lib/utils";

/** Turnos visibles antes de «Ver toda»: el inicio dice qué buscaba. */
const PREVIEW = 6;

/**
 * La conversación con el asistente, como la vio el visitante: él a la
 * derecha con sus iniciales, el asistente a la izquierda. El resumen de
 * arriba es lo rápido; esto es para confirmar un matiz antes de escribirle.
 */
export function LeadConversation({
  turns,
  initials,
}: {
  turns: ChatTurn[];
  initials: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? turns : turns.slice(0, PREVIEW);
  const hidden = turns.length - visible.length;

  return (
    <div className="space-y-4">
      {visible.map((turn, index) => {
        const visitor = turn.role === "user";
        return (
          <div
            key={index}
            className={cn("flex items-end gap-2.5", visitor && "flex-row-reverse")}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                visitor
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
                  : "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
              )}
              aria-label={visitor ? "Visitante" : "Asistente"}
            >
              {visitor ? initials : <Sparkles className="size-4" />}
            </span>
            <p
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                visitor
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-muted",
              )}
            >
              {turn.text}
            </p>
          </div>
        );
      })}

      {hidden > 0 || expanded ? (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Mostrar menos" : `Ver toda la conversación (${hidden} más)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
