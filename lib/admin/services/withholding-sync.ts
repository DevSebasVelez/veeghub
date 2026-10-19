import type { Prisma } from "@/app/generated/prisma/client";
import type { ReceivableStatus } from "@/app/generated/prisma/enums";
import {
  allocateWithholdings,
  coveredStatus,
} from "@/lib/admin/finance/calc";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";

/**
 * Re-spreads the invoice's applied withholdings over its milestones and fixes
 * the status of every milestone whose share changed. Milestones whose share
 * is unchanged are left alone, so a manual status is never overwritten here.
 */
export async function syncInvoiceWithholdings(
  tx: Prisma.TransactionClient,
  invoiceId: string | null | undefined,
) {
  if (!invoiceId) return;

  const [receivables, applied] = await Promise.all([
    tx.receivable.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        withheldAmount: true,
        status: true,
        invoiceId: true,
      },
    }),
    tx.withholding.findMany({
      where: { invoiceId, appliesToBalance: true },
      select: { amount: true },
    }),
  ]);

  const allocation = allocateWithholdings(
    receivables,
    fromCents(sumCents(applied, (w) => w.amount)),
  );

  for (const r of receivables) {
    const withheld = allocation.find((a) => a.id === r.id)?.withheld ?? 0;
    if (withheld === toCents(r.withheldAmount)) continue;

    const withheldAmount = fromCents(withheld);
    await tx.receivable.update({
      where: { id: r.id },
      data: {
        withheldAmount,
        status: coveredStatus({ ...r, withheldAmount }) as ReceivableStatus,
      },
    });
  }
}

/**
 * Milestones leaving an invoice stop carrying its withholdings: their share
 * goes back to zero and the status is recomputed from cash alone.
 */
export async function releaseWithholdings(
  tx: Prisma.TransactionClient,
  where: Prisma.ReceivableWhereInput,
) {
  const receivables = await tx.receivable.findMany({
    where: { ...where, withheldAmount: { gt: 0 } },
    select: { id: true, amount: true, paidAmount: true, status: true, invoiceId: true },
  });

  for (const r of receivables) {
    await tx.receivable.update({
      where: { id: r.id },
      data: {
        withheldAmount: 0,
        status: coveredStatus({ ...r, withheldAmount: 0 }) as ReceivableStatus,
      },
    });
  }
}
