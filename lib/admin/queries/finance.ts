import prisma from "@/lib/db/prisma";

export async function getFinanceHeaderData() {
  const [
    clients,
    projects,
    pendingForPayment,
    pendingAgg,
    collectedAgg,
    overdueCount,
  ] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.receivable.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.receivable.aggregate({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.receivable.count({
      where: {
        status: { notIn: ["PAID", "CANCELLED"] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  return {
    clients,
    projects,
    pendingForPayment,
    totalPending:
      Number(pendingAgg._sum.amount ?? 0) -
      Number(pendingAgg._sum.paidAmount ?? 0),
    totalCollected: Number(collectedAgg._sum.amount ?? 0),
    overdueCount,
  };
}
