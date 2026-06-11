import { formErrorMessage } from "@/lib/admin/schemas";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function actionState(
  operation: () => Promise<void>,
): Promise<AdminFormState> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formErrorMessage(error) };
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
