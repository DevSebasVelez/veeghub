"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { catalogItemSchema, parseForm } from "@/lib/admin/schemas";

// The invoicing catalogue. Items are archived, never deleted: an issued
// invoice copies the values, so nothing points back here, but archiving keeps
// the list of what was offered.

function revalidate() {
  revalidatePath("/admin/facturas/catalogo");
  revalidatePath("/admin/facturas/nueva");
}

export async function createCatalogItem(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  return actionState(async () => {
    const data = parseForm(catalogItemSchema, formData);
    await prisma.catalogItem.create({ data });
    revalidate();
  });
}

export async function updateCatalogItem(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  return actionState(async () => {
    const data = parseForm(catalogItemSchema, formData);
    await prisma.catalogItem.update({ where: { id }, data });
    revalidate();
  });
}

export async function setCatalogItemActive(id: string, active: boolean): Promise<AdminFormState> {
  await requireAdmin();
  return actionState(async () => {
    await prisma.catalogItem.update({ where: { id }, data: { active } });
    revalidate();
  });
}
