"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { formErrorMessage, parseForm, recurringExpenseSchema } from "@/lib/admin/schemas";
import { dayStartUtc } from "@/lib/admin/format";
import { duePeriods } from "@/lib/admin/finance/recurrence";

function revalidateRecurring() {
  revalidatePath("/admin/egresos");
  revalidatePath("/admin/finanzas/resumen");
  revalidatePath("/admin");
}

export async function createRecurringExpense(
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(recurringExpenseSchema, formData);
    await prisma.recurringExpense.create({ data });
    revalidateRecurring();
  });
}

export async function updateRecurringExpense(
  id: string,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(recurringExpenseSchema, formData);
    // Expenses already generated keep their own values.
    await prisma.recurringExpense.update({ where: { id }, data });
    revalidateRecurring();
  });
}

export async function setRecurringExpenseActive(
  id: string,
  active: boolean,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await prisma.recurringExpense.update({ where: { id }, data: { active } });
    revalidateRecurring();
  });
}

export async function deleteRecurringExpense(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    // Generated expenses stay in the ledger; only their link is cleared.
    await prisma.recurringExpense.delete({ where: { id } });
    revalidateRecurring();
  });
}

/**
 * Creates the pending expenses of every active template for the periods due
 * so far. Idempotent: the (template, period) unique key skips periods that
 * were already generated, even if this runs twice at the same time.
 */
export async function generateRecurringExpenses(): Promise<AdminFormState> {
  await requireAdmin();

  try {
    const today = dayStartUtc(new Date());
    const templates = await prisma.recurringExpense.findMany({
      where: { active: true },
    });

    const rows = templates.flatMap((t) =>
      duePeriods(t, today).map((p) => ({
        description: t.description,
        categoryId: t.categoryId,
        payeeId: t.payeeId,
        payeeKind: t.payeeKind,
        projectId: t.projectId,
        amount: t.amount,
        taxAmount: t.taxAmount,
        currency: t.currency,
        method: t.method,
        taxTreatment: t.taxTreatment,
        notes: t.notes,
        status: "PENDING" as const,
        expenseDate: p.expenseDate,
        recurringExpenseId: t.id,
        recurrencePeriod: p.period,
      })),
    );

    const { count } = rows.length
      ? await prisma.expense.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };

    revalidateRecurring();
    return {
      ok: true,
      message:
        count === 0
          ? "No había egresos pendientes por generar."
          : `Se generaron ${count} egreso(s) pendiente(s).`,
    };
  } catch (error) {
    return { ok: false, error: formErrorMessage(error) };
  }
}
