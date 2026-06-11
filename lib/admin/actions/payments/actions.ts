"use server";

import { revalidatePath } from "next/cache";

import type { ReceivableStatus } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  parseForm,
  paymentSchema,
  paymentUpdateSchema,
} from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { syncInvoicePaidStatus } from "@/lib/admin/services/invoice-sync";

export async function recordPayment(formData: FormData) {
  await requireAdmin();
  const data = parseForm(paymentSchema, formData);

  await prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: data.receivableId },
      select: { amount: true, paidAmount: true, invoiceId: true },
    });
    const paidAmount = Number(receivable.paidAmount) + data.amount;
    const status = (
      paidAmount >= Number(receivable.amount) ? "PAID" : "PARTIALLY_PAID"
    ) as ReceivableStatus;

    await tx.payment.create({
      data: { ...data, paidAt: data.paidAt ?? new Date() },
    });

    await tx.receivable.update({
      where: { id: data.receivableId },
      data: { paidAmount, status },
    });

    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function deletePayment(id: string) {
  await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

    const remaining = await tx.payment.aggregate({
      where: { receivableId: payment.receivableId, id: { not: id } },
      _sum: { amount: true },
    });

    const newPaidAmount = Number(remaining._sum.amount ?? 0);
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: payment.receivableId },
      select: { amount: true, status: true, invoiceId: true },
    });
    const receivableAmount = Number(receivable.amount);

    let newStatus: ReceivableStatus;
    if (newPaidAmount >= receivableAmount) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID";
    } else if (
      receivable.status === "PAID" ||
      receivable.status === "PARTIALLY_PAID"
    ) {
      newStatus = receivable.invoiceId ? "INVOICED" : "PLANNED";
    } else {
      newStatus = receivable.status;
    }

    await tx.payment.delete({ where: { id } });
    await tx.receivable.update({
      where: { id: payment.receivableId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function updatePayment(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(paymentUpdateSchema, formData);

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

    await tx.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        paidAt: data.paidAt ?? payment.paidAt,
        method: data.method ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      },
    });

    const aggregate = await tx.payment.aggregate({
      where: { receivableId: payment.receivableId },
      _sum: { amount: true },
    });

    const newPaidAmount = Number(aggregate._sum.amount ?? 0);
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: payment.receivableId },
      select: { amount: true, invoiceId: true },
    });

    let newStatus: ReceivableStatus;
    if (newPaidAmount >= Number(receivable.amount)) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID";
    } else {
      newStatus = receivable.invoiceId ? "INVOICED" : "PLANNED";
    }

    await tx.receivable.update({
      where: { id: payment.receivableId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function recordPaymentState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => recordPayment(formData));
}
