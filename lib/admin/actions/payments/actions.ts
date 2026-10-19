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
import { syncInvoiceWithholdings } from "@/lib/admin/services/withholding-sync";
import { coveredStatus } from "@/lib/admin/finance/calc";

export async function recordPayment(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(paymentSchema, formData);

    await prisma.$transaction(async (tx) => {
      const receivable = await tx.receivable.findUniqueOrThrow({
        where: { id: data.receivableId },
        select: {
          amount: true,
          paidAmount: true,
          withheldAmount: true,
          invoiceId: true,
        },
      });
      const paidAmount = Number(receivable.paidAmount) + data.amount;
      // Withholdings applied to this milestone also cover its balance.
      const covered = paidAmount + Number(receivable.withheldAmount);
      const status = (
        covered >= Number(receivable.amount) ? "PAID" : "PARTIALLY_PAID"
      ) as ReceivableStatus;

      await tx.payment.create({
        data: { ...data, paidAt: data.paidAt ?? new Date() },
      });

      await tx.receivable.update({
        where: { id: data.receivableId },
        data: { paidAmount, status },
      });

      await syncInvoiceWithholdings(tx, receivable.invoiceId);
      await syncInvoicePaidStatus(tx, receivable.invoiceId);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/finanzas");
  });
}

export async function deletePayment(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

      const remaining = await tx.payment.aggregate({
        where: { receivableId: payment.receivableId, id: { not: id } },
        _sum: { amount: true },
      });

      const newPaidAmount = Number(remaining._sum.amount ?? 0);
      const receivable = await tx.receivable.findUniqueOrThrow({
        where: { id: payment.receivableId },
        select: {
          amount: true,
          status: true,
          invoiceId: true,
          withheldAmount: true,
        },
      });

      const newStatus = coveredStatus({
        ...receivable,
        paidAmount: newPaidAmount,
      }) as ReceivableStatus;

      await tx.payment.delete({ where: { id } });
      await tx.receivable.update({
        where: { id: payment.receivableId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });

      await syncInvoiceWithholdings(tx, receivable.invoiceId);
      await syncInvoicePaidStatus(tx, receivable.invoiceId);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/finanzas");
  });
}

export async function updatePayment(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
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
        select: {
          amount: true,
          status: true,
          invoiceId: true,
          withheldAmount: true,
        },
      });

      const newStatus = coveredStatus({
        ...receivable,
        paidAmount: newPaidAmount,
      }) as ReceivableStatus;

      await tx.receivable.update({
        where: { id: payment.receivableId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });

      await syncInvoiceWithholdings(tx, receivable.invoiceId);
      await syncInvoicePaidStatus(tx, receivable.invoiceId);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/finanzas");
  });
}

export async function recordPaymentState(
  _state: AdminFormState,
  formData: FormData,
) {
  return recordPayment(formData);
}
