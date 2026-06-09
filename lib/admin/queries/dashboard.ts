import prisma from "@/lib/db/prisma";

export async function getAdminDashboardData() {
  const now = new Date();

  const [
    clients,
    activeProjects,
    openTasks,
    receivableTotals,
    pendingInvoices,
    credentials,
    recentTasks,
    upcomingReceivables,
    overdueCount,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.receivable.aggregate({
      where: { status: { not: "PAID" } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.invoice.count({ where: { status: "READY_TO_SEND" } }),
    prisma.credential.count(),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { project: { select: { name: true } } },
    }),
    prisma.receivable.findMany({
      where: { status: { not: "PAID" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.receivable.count({
      where: {
        status: { not: "PAID" },
        dueDate: { lt: now },
      },
    }),
  ]);

  const receivableBalance =
    Number(receivableTotals._sum.amount ?? 0) -
    Number(receivableTotals._sum.paidAmount ?? 0);

  return {
    now,
    clients,
    activeProjects,
    openTasks,
    receivableBalance,
    pendingInvoices,
    credentials,
    recentTasks,
    upcomingReceivables,
    overdueCount,
  };
}
