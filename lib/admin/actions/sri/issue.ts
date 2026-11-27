"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { advanceInvoice } from "@/lib/sri/issue";

/**
 * «Reintentar» / «Consultar estado»: moves an issued invoice as far as the
 * SRI allows right now. Safe to press twice: the second waits for the first.
 */
export async function advanceSriInvoice(invoiceId: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const result = await advanceInvoice(invoiceId);
    if (result.busy) throw new Error("Ya se está procesando esta factura. Espera unos segundos.");
    revalidatePath(`/admin/facturas/${invoiceId}`);
    revalidatePath("/admin/facturas");
    if (result.problem && !result.pending) throw new Error(result.problem);
  });
}
