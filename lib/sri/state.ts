import type { AuthorizationAnswer, ReceptionResult, SriMessage } from "@/lib/sri/ws";

// Pure rules of the issuing state machine (plan B4):
//
//   DRAFT ─sign→ SIGNED ─reception→ RECEIVED ─authorization→ AUTHORIZED
//                  │                    │                  └→ NOT_AUTHORIZED
//                  └→ RETURNED          └ (en proceso: wait and ask again)
//
// The SRI is slow and sometimes silent, so a step can end "unknown". Rules:
// - reception is never repeated blindly: after a timeout, ask for the
//   authorization first; only if the SRI has no record, send again;
// - the same signed bytes and the same clave are always resent, never a new
//   document (plan §3.6);
// - 43 (clave registrada) and 70 (en procesamiento) on reception mean the SRI
//   already has it: go ask for the authorization.

export type SriStatus = "DRAFT" | "SIGNED" | "RECEIVED" | "RETURNED" | "AUTHORIZED" | "NOT_AUTHORIZED";

export const FINAL_STATUSES: readonly SriStatus[] = ["RETURNED", "AUTHORIZED", "NOT_AUTHORIZED"];

export type Decision = {
  status: SriStatus;
  /** Ask the SRI again later (cron or the button). */
  retry: boolean;
  /** Spanish, for the UI; null when all is well. */
  problem: string | null;
};

const ALREADY_THERE = new Set(["43", "70"]);

export function describeMessages(messages: SriMessage[]) {
  return messages
    .map((m) => [m.id ? `[${m.id}]` : null, m.text, m.detail ? `— ${m.detail}` : null].filter(Boolean).join(" "))
    .join(" · ");
}

/** After validarComprobante. `null` = no answer (timeout, network). */
export function afterReception(result: ReceptionResult | null, error?: string): Decision {
  if (!result) {
    return {
      status: "SIGNED",
      retry: true,
      problem: `Sin respuesta de recepción (${error ?? "error de red"}). Se consultará la autorización antes de reenviar.`,
    };
  }
  if (result.state === "RECIBIDA") return { status: "RECEIVED", retry: true, problem: null };
  if (result.state === "DEVUELTA") {
    if (result.messages.length > 0 && result.messages.every((m) => m.id && ALREADY_THERE.has(m.id))) {
      return { status: "RECEIVED", retry: true, problem: null };
    }
    return { status: "RETURNED", retry: false, problem: `Devuelta por el SRI: ${describeMessages(result.messages)}` };
  }
  return { status: "SIGNED", retry: true, problem: `Respuesta de recepción inesperada: ${result.state ?? "vacía"}.` };
}

/**
 * After autorizacionComprobante. `null` = no answer. `fromStatus` matters
 * when the SRI has no record: a SIGNED invoice whose sending was uncertain
 * must be sent; a RECEIVED one is still being processed.
 */
export function afterAuthorization(
  answer: AuthorizationAnswer | null,
  fromStatus: "SIGNED" | "RECEIVED",
  error?: string,
): Decision & { send?: boolean } {
  if (!answer) {
    return {
      status: fromStatus,
      retry: true,
      problem: `Sin respuesta de autorización (${error ?? "error de red"}).`,
    };
  }
  switch (answer.state) {
    case "AUTORIZADO":
      return { status: "AUTHORIZED", retry: false, problem: null };
    case "NO AUTORIZADO":
      return {
        status: "NOT_AUTHORIZED",
        retry: false,
        problem: `No autorizada: ${describeMessages(answer.messages)}`,
      };
    case null:
      // Nothing at the SRI under this clave.
      return fromStatus === "SIGNED"
        ? { status: "SIGNED", retry: true, problem: null, send: true }
        : { status: "RECEIVED", retry: true, problem: null };
    default:
      // EN PROCESO and the like.
      return { status: "RECEIVED", retry: true, problem: null };
  }
}

/** Wait before the next try, by attempts made: 30 s, 1, 2, 5, 10, 30 min, then hourly. */
export function retryDelayMs(attempts: number) {
  const steps = [30, 60, 120, 300, 600, 1800];
  return (steps[Math.max(0, attempts - 1)] ?? 3600) * 1000;
}
