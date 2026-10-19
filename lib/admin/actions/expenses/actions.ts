"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  expenseSchema,
  markExpensePaidSchema,
  parseForm,
} from "@/lib/admin/schemas";
import { fileMetaFromForm } from "@/lib/admin/services/drive-files";

function revalidateExpenses(projectIds: Array<string | null | undefined>) {
  revalidatePath("/admin/egresos");
  revalidatePath("/admin/finanzas/resumen");
  for (const projectId of new Set(projectIds)) {
    if (projectId) revalidatePath(`/admin/proyectos/${projectId}`);
  }
}

/**
 * Registers the uploaded receipt (already in R2 through the presigned flow) in
 * the same transaction as the expense, so a failed save leaves no orphan row.
 */
async function receiptFileId(
  tx: Prisma.TransactionClient,
  formData: FormData,
  projectId: string | null,
) {
  const meta = fileMetaFromForm(formData, "receipt");
  if (!meta) return undefined;

  const project = projectId
    ? await tx.project.findUnique({
        where: { id: projectId },
        select: { clientId: true },
      })
    : null;

  const file = await tx.driveFile.create({
    data: { ...meta, projectId, clientId: project?.clientId ?? null },
  });
  return file.id;
}

export async function createExpense(formData: FormData) {
  await requireAdmin();
  const data = parseForm(expenseSchema, formData);

  await prisma.$transaction(async (tx) => {
    const fileId = await receiptFileId(tx, formData, data.projectId);
    await tx.expense.create({
      data: { ...data, receiptFileId: fileId ?? null },
    });
  });

  revalidateExpenses([data.projectId]);
}

export async function updateExpense(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(expenseSchema, formData);

  const previous = await prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUniqueOrThrow({
      where: { id },
      select: { projectId: true },
    });
    const fileId = await receiptFileId(tx, formData, data.projectId);
    await tx.expense.update({
      where: { id },
      data: { ...data, ...(fileId ? { receiptFileId: fileId } : {}) },
    });
    return before;
  });

  revalidateExpenses([previous.projectId, data.projectId]);
}

export async function markExpensePaid(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(markExpensePaidSchema, formData);

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: data.paidAt,
      ...(data.method ? { method: data.method } : {}),
      ...(data.reference ? { reference: data.reference } : {}),
    },
    select: { projectId: true },
  });

  revalidateExpenses([expense.projectId]);
}

export async function deleteExpense(id: string) {
  await requireAdmin();

  // The receipt stays in Drive: it is a supporting document in its own right.
  const expense = await prisma.expense.delete({
    where: { id },
    select: { projectId: true },
  });

  revalidateExpenses([expense.projectId]);
}
