import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Invoices with tax value: uploaded ones (no environment) and those issued in
 * PRODUCCION. Invoices issued in PRUEBAS (celcer) are kept and listed, tagged,
 * but never add up in figures, reports or exports: a test invoice never mixes
 * with the real ones (plan §0, golden rule).
 */
export const REAL_INVOICES = {
  OR: [{ environment: null }, { environment: "PRODUCCION" }],
} satisfies Prisma.InvoiceWhereInput;
