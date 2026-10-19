"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseForm, withholdingSchema } from "@/lib/admin/schemas";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";

// Withholdings are recorded for information only: they never touch the
// milestones' paidAmount or status, and never count as cash received.

function revalidateInvoice(invoiceId: string) {
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${invoiceId}`);
  revalidatePath("/admin/finanzas/resumen");
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

export async function createWithholding(invoiceId: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(withholdingSchema, formData);

  await prisma.$transaction(async (tx) => {
    await assertWithinInvoice(tx, invoiceId, data.amount);
    await tx.withholding.create({ data: { ...data, invoiceId } });
  });

  revalidateInvoice(invoiceId);
}

export async function updateWithholding(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(withholdingSchema, formData);

  const invoiceId = await prisma.$transaction(async (tx) => {
    const current = await tx.withholding.findUniqueOrThrow({
      where: { id },
      select: { invoiceId: true },
    });
    await assertWithinInvoice(tx, current.invoiceId, data.amount, id);
    await tx.withholding.update({ where: { id }, data });
    return current.invoiceId;
  });

  revalidateInvoice(invoiceId);
}

export async function deleteWithholding(id: string) {
  await requireAdmin();

  const withholding = await prisma.withholding.delete({
    where: { id },
    select: { invoiceId: true },
  });

  revalidateInvoice(withholding.invoiceId);
}
