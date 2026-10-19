import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { fromCents, toCents } from "@/lib/admin/finance/money";

/**
 * This month's real cash movements (collections − paid expenses, by payment
 * date) and what is still owed to people/suppliers. Calendar days follow the
 * business timezone, like the rest of the finance views.
 */
async function getCashThisMonth() {
  const today = dayKeyInAppZone(new Date());
  const [year, month] = today.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const range = { gte: from, lte: to };

  const [collected, paidOut, pending, overduePending] = await Promise.all([
    prisma.payment.aggregate({
      where: { paidAt: range },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { status: "PAID", paidAt: range },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.count({
      where: {
        status: "PENDING",
        expenseDate: { lt: new Date(`${today}T00:00:00.000Z`) },
      },
    }),
  ]);

  const collectedCents = toCents(collected._sum.amount);
  const paidOutCents = toCents(paidOut._sum.amount);

  return {
    monthLabel: new Intl.DateTimeFormat("es-EC", {
      month: "long",
      timeZone: "UTC",
    }).format(from),
    fromKey: from.toISOString().slice(0, 10),
    toKey: to.toISOString().slice(0, 10),
    collected: fromCents(collectedCents),
    paidOut: fromCents(paidOutCents),
    netCashFlow: fromCents(collectedCents - paidOutCents),
    pendingExpenses: fromCents(toCents(pending._sum.amount)),
    pendingExpensesCount: pending._count,
    overduePendingExpenses: overduePending,
  };
}

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
    upcomingMeetings,
    newLeads,
    uncontactedLeads,
    cash,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.receivable.aggregate({
      where: { status: { not: "PAID" } },
      _sum: { amount: true, paidAmount: true, withheldAmount: true },
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
    prisma.meeting.findMany({
      where: {
        status: "SCHEDULED",
        endsAt: { gte: now },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
    prisma.lead.count({ where: { stage: "NEW" } }),
    prisma.lead.findMany({
      where: { stage: "NEW" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        serviceTag: true,
        metaCampaignName: true,
        createdAt: true,
      },
    }),
    getCashThisMonth(),
  ]);

  const receivableBalance =
    Number(receivableTotals._sum.amount ?? 0) -
    Number(receivableTotals._sum.paidAmount ?? 0) -
    Number(receivableTotals._sum.withheldAmount ?? 0);

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
    upcomingMeetings,
    newLeads,
    uncontactedLeads,
    cash,
  };
}
