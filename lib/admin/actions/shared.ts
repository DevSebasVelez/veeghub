import { unstable_rethrow } from "next/navigation";

import { Prisma } from "@/app/generated/prisma/client";
import { formErrorMessage } from "@/lib/admin/schemas";
import type { AdminFormState } from "@/lib/admin/actions/types";

const PRISMA_MESSAGES: Record<string, string> = {
  P2002: "Ya existe un registro con ese valor.",
  P2003: "No se puede completar: el registro está relacionado con otros datos.",
  P2025: "El registro ya no existe. Recarga la página.",
};

/**
 * The message an action returns to the user. Validation (Zod) and the
 * errors the actions throw on purpose carry Spanish, user-facing text and
 * pass through. Database errors would expose internals in English, so they
 * get a plain message and the detail stays in the server log.
 */
export function actionErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[action]", error.code, error.message);
    return (
      PRISMA_MESSAGES[error.code] ??
      "No se pudo guardar por un error de la base de datos."
    );
  }

  if (error instanceof Error && error.name.startsWith("PrismaClient")) {
    console.error("[action]", error);
    return "No se pudo guardar por un error de la base de datos.";
  }

  return formErrorMessage(error);
}

/**
 * Runs an action and returns its outcome instead of throwing.
 *
 * Next.js replaces the message of errors thrown from server actions with a
 * generic English text in production, so expected errors travel as a return
 * value. Its own control-flow errors (redirect, notFound) are re-thrown so
 * they still work inside the operation.
 */
export async function actionState(
  operation: () => Promise<void>,
): Promise<AdminFormState> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}

/** actionState for actions that also return data on success. */
export async function actionResult<T>(
  operation: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);

  if (!value) {
    throw new Error(`El campo ${key} es requerido.`);
  }

  return value;
}

export function optionalId(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === "none" ? null : value;
}
