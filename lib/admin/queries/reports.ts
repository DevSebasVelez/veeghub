import prisma from "@/lib/db/prisma";

export async function getReportsData({
  firstChartMonth,
  selectedStart,
  selectedEnd,
  now,
}: {
  firstChartMonth: Date;
  selectedStart: Date;
  selectedEnd: Date;
  now: Date;
}) {
  const [
    earliestInvoice,
    invoices,
    payments,
    receivables,
    selectedInvoices,
    selectedPayments,
    pendingReceivableTotals,
    openReceivablesCount,
    overdueReceivablesCount,
    criticalReceivables,
  ] = await Promise.all([
    prisma.invoice.findFirst({
      select: { issueDate: true },
      where: { issueDate: { not: null } },
      orderBy: { issueDate: "asc" },
    }),
    prisma.invoice.findMany({
      where: { issueDate: { gte: firstChartMonth } },
      select: { issueDate: true, total: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: firstChartMonth } },
      select: { paidAt: true, amount: true },
    }),
    prisma.receivable.findMany({
      where: { createdAt: { gte: firstChartMonth } },
      select: { createdAt: true, amount: true, paidAmount: true },
    }),
    prisma.invoice.findMany({
      where: { issueDate: { gte: selectedStart, lte: selectedEnd } },
      include: { client: true, project: true },
      orderBy: { issueDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: selectedStart, lte: selectedEnd } },
      include: { receivable: { include: { client: true, project: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.receivable.aggregate({
      where: { status: { not: "PAID" } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.receivable.count({
      where: { status: { not: "PAID" } },
    }),
    prisma.receivable.count({
      where: {
        status: { not: "PAID" },
        dueDate: { lt: now },
      },
    }),
    prisma.receivable.findMany({
      where: { status: { not: "PAID" } },
      include: { client: true, project: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
  ]);

  return {
    earliestInvoice,
    invoices,
    payments,
    receivables,
    selectedInvoices,
    selectedPayments,
    totalPending:
      Number(pendingReceivableTotals._sum.amount ?? 0) -
      Number(pendingReceivableTotals._sum.paidAmount ?? 0),
    openReceivablesCount,
    overdueReceivablesCount,
    criticalReceivables,
  };
}
