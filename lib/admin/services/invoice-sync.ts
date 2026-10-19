import type { Prisma } from "@/app/generated/prisma/client";
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
      emailLogs: { select: { id: true }, take: 1 },
    },
  });
  if (!invoice || invoice.status === "CANCELLED") return;

  const hitos = await tx.receivable.findMany({
    where: { invoiceId },
    select: { amount: true, paidAmount: true, withheldAmount: true },
  });
  // Applied withholdings settle a milestone just like cash does.
  const allPaid =
    hitos.length > 0 &&
    hitos.every(
      (h) => Number(h.paidAmount) + Number(h.withheldAmount) >= Number(h.amount),
    );

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
