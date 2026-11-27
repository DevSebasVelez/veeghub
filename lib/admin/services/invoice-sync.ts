import type { Prisma } from "@/app/generated/prisma/client";
import { sumCents, toCents } from "@/lib/admin/finance/money";
import {
  releaseWithholdings,
  syncInvoiceWithholdings,
} from "@/lib/admin/services/withholding-sync";

export async function syncInvoicePaidStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string | null | undefined,
) {
  if (!invoiceId) return;
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      source: true,
      total: true,
      emailLogs: { select: { id: true }, take: 1 },
    },
  });
  if (!invoice || invoice.status === "CANCELLED") return;

  const hitos = await tx.receivable.findMany({
    where: { invoiceId },
    select: { amount: true, paidAmount: true, withheldAmount: true },
  });
  // Applied withholdings settle a milestone just like cash does.
  const hitosSettled =
    hitos.length > 0 &&
    hitos.every(
      (h) => Number(h.paidAmount) + Number(h.withheldAmount) >= Number(h.amount),
    );
  // An issued invoice's milestones are its payment plan and may cover only
  // part of it: it is paid when what they collected reaches its total.
  const allPaid =
    hitosSettled &&
    (invoice.source !== "ISSUED" ||
      sumCents(hitos, (h) => h.paidAmount) + sumCents(hitos, (h) => h.withheldAmount) >=
        toCents(invoice.total));

  if (allPaid && invoice.status !== "PAID") {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    });
  } else if (!allPaid && invoice.status === "PAID") {
    const wasSent = invoice.emailLogs.length > 0;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: wasSent ? "SENT" : "READY_TO_SEND", paidAt: null },
    });
  }
}

export async function syncInvoiceReceivables(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  receivableIds: string[],
) {
  await releaseWithholdings(tx, { invoiceId, id: { notIn: receivableIds } });
  await tx.receivable.updateMany({
    where: { invoiceId, id: { notIn: receivableIds }, status: "INVOICED" },
    data: { status: "PLANNED" },
  });
  await tx.receivable.updateMany({
    where: { invoiceId, id: { notIn: receivableIds } },
    data: { invoiceId: null },
  });

  if (receivableIds.length) {
    await tx.receivable.updateMany({
      where: { id: { in: receivableIds } },
      data: { invoiceId },
    });
    await tx.receivable.updateMany({
      where: { id: { in: receivableIds }, status: "PLANNED" },
      data: { status: "INVOICED" },
    });
  }

  await syncInvoiceWithholdings(tx, invoiceId);
}
