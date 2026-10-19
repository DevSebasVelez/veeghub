"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { parseForm, withholdingSchema } from "@/lib/admin/schemas";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";
import { syncInvoicePaidStatus } from "@/lib/admin/services/invoice-sync";
import { syncInvoiceWithholdings } from "@/lib/admin/services/withholding-sync";

// Withholdings never count as cash received and never touch paidAmount.
// Those marked appliesToBalance settle the invoice's milestones: their share
// is kept in Receivable.withheldAmount and the statuses follow.

async function settle(tx: Prisma.TransactionClient, invoiceId: string) {
  await syncInvoiceWithholdings(tx, invoiceId);
  await syncInvoicePaidStatus(tx, invoiceId);
}

function revalidateInvoice(invoiceId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${invoiceId}`);
  revalidatePath("/admin/finanzas/resumen");
  revalidatePath("/admin/proyectos", "layout");
  revalidatePath("/admin/clientes", "layout");
}

async function assertWithinInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amount: number,
  excludeId?: string,
) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      total: true,
      withholdings: {
        where: excludeId ? { id: { not: excludeId } } : undefined,
        select: { amount: true },
      },
    },
  });
  const existing = sumCents(invoice.withholdings, (w) => w.amount);
  const total = toCents(invoice.total);
  if (existing + toCents(amount) > total) {
    throw new Error(
      `Las retenciones superarían el total de la factura (${fromCents(total)}).`,
    );
  }
}

export async function createWithholding(
  invoiceId: string,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(withholdingSchema, formData);

    await prisma.$transaction(async (tx) => {
      await assertWithinInvoice(tx, invoiceId, data.amount);
      await tx.withholding.create({ data: { ...data, invoiceId } });
      await settle(tx, invoiceId);
    });

    revalidateInvoice(invoiceId);
  });
}

export async function updateWithholding(
  id: string,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(withholdingSchema, formData);

    const invoiceId = await prisma.$transaction(async (tx) => {
      const current = await tx.withholding.findUniqueOrThrow({
        where: { id },
        select: { invoiceId: true },
      });
      await assertWithinInvoice(tx, current.invoiceId, data.amount, id);
      await tx.withholding.update({ where: { id }, data });
      await settle(tx, current.invoiceId);
      return current.invoiceId;
    });

    revalidateInvoice(invoiceId);
  });
}

export async function deleteWithholding(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const invoiceId = await prisma.$transaction(async (tx) => {
      const withholding = await tx.withholding.delete({
        where: { id },
        select: { invoiceId: true },
      });
      await settle(tx, withholding.invoiceId);
      return withholding.invoiceId;
    });

    revalidateInvoice(invoiceId);
  });
}
