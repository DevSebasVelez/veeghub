"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { storeCertificate } from "@/lib/sri/signing";

/** A .p12 is a few KB; anything this large is not one. */
const MAX_BYTES = 200 * 1024;

/**
 * Uploads the electronic signature with its password. Both are checked (the
 * .p12 must open and sign) and stored encrypted; the password is never sent
 * back to the browser.
 */
export async function uploadSriCertificate(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const file = formData.get("p12");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Elige el archivo .p12 de tu firma electrónica.");
    }
    if (file.size > MAX_BYTES) throw new Error("Ese archivo es demasiado grande para ser un .p12.");
    if (!/\.(p12|pfx)$/i.test(file.name)) throw new Error("El archivo debe ser .p12 o .pfx.");
    const password = formData.get("password");
    if (typeof password !== "string" || password === "") {
      throw new Error("Escribe la clave de la firma electrónica.");
    }

    await storeCertificate(Buffer.from(await file.arrayBuffer()), password);

    revalidatePath("/admin/finanzas/impuestos");
  });
}
