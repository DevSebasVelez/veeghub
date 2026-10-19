export type AdminFormState = {
  ok?: boolean;
  error?: string;
};

/**
 * Client-side: turns a failed action result into a thrown Error so dialogs
 * can keep their try/catch + toast flow. The message travels as a return
 * value from the server, which unlike a thrown error is not masked in
 * production builds.
 */
export function unwrap(state: AdminFormState) {
  if (!state.ok) {
    throw new Error(state.error ?? "No se pudo guardar. Intenta de nuevo.");
  }
}
