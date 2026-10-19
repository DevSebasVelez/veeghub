"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { expenseCategorySchema, parseForm } from "@/lib/admin/schemas";

function revalidateCategories() {
  revalidatePath("/admin/egresos");
  revalidatePath("/admin/finanzas/resumen");
}

export async function createExpenseCategory(
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(expenseCategorySchema, formData);

    await prisma.expenseCategory.create({ data });

    revalidateCategories();
  });
}

export async function updateExpenseCategory(
  id: string,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(expenseCategorySchema, formData);

    await prisma.expenseCategory.update({ where: { id }, data });

    revalidateCategories();
  });
}

/**
 * Archiving hides a category from new expenses without touching the ones
 * already filed under it. Unused categories are deleted outright.
 */
export async function setExpenseCategoryArchived(
  id: string,
  archived: boolean,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await prisma.expenseCategory.update({ where: { id }, data: { archived } });

    revalidateCategories();
  });
}

export async function deleteExpenseCategory(
  id: string,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const used = await prisma.expense.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new Error("La categoría tiene egresos; archívala en su lugar.");
    }

    await prisma.expenseCategory.delete({ where: { id } });

    revalidateCategories();
  });
}
