"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseForm, taxProfileSchema } from "@/lib/admin/schemas";

// Administrative reference only. Changing a profile never rewrites invoices:
// each invoice keeps the IVA rate it was issued with.

function revalidateTaxProfiles() {
  revalidatePath("/admin/finanzas/impuestos");
  revalidatePath("/admin/finanzas/resumen");
}

export async function createTaxProfile(formData: FormData) {
  await requireAdmin();
  const data = parseForm(taxProfileSchema, formData);

  await prisma.taxProfile.create({ data });

  revalidateTaxProfiles();
}

export async function updateTaxProfile(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(taxProfileSchema, formData);

  await prisma.taxProfile.update({ where: { id }, data });

  revalidateTaxProfiles();
}

export async function deleteTaxProfile(id: string) {
  await requireAdmin();

  await prisma.taxProfile.delete({ where: { id } });

  revalidateTaxProfiles();
}
