import prisma from "@/lib/db/prisma";
import { getCurrentTaxProfile } from "@/lib/admin/queries/tax-profiles";
import { vatOptions } from "@/lib/sri/invoice-calc";

/** Catalogue items, active first, as plain values for client components. */
export async function getCatalogItems({ includeArchived = false } = {}) {
  const rows = await prisma.catalogItem.findMany({
    where: includeArchived ? {} : { active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    // Decimal(18,6) → shortest text ("120", "33.333333").
    unitPrice: row.unitPrice.toString(),
    vatCode: row.vatCode,
    notes: row.notes,
    active: row.active,
  }));
}

/** IVA choices under the profile in force today (empty without one). */
export async function getCurrentVatOptions() {
  const profile = await getCurrentTaxProfile();
  return vatOptions(profile ? profile.vatRates.map((rate) => Number(rate.toString())) : []);
}
