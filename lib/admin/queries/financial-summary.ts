import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { summarize } from "@/lib/admin/finance/calc";
import { resolvePeriod } from "@/lib/admin/finance/period";
import { monthBounds, monthsEndingAt } from "@/lib/admin/finance/month";
import { toCents } from "@/lib/admin/finance/money";

export type SummaryFilters = {
  desde?: string;
  hasta?: string;
  cliente?: string;
  proyecto?: string;
};

/**
 * Loads every movement the summary needs, already narrowed to the period,
 * client and project, and hands them to `summarize`. Each kind of movement is
 * read from its own table exactly once, so nothing is counted twice.
 *
 * Dates: invoices by issueDate, collections by paidAt, expenses registered by
 * expenseDate and expenses paid by paidAt. The client balance is how things
 * stand today, not a period figure.
 */
/**
 * Where clauses for the period, client and project filters. Shared by the
 * summary and its CSV export so both always select the same movements.
 */
function summaryScope(filters: SummaryFilters) {
  const period = resolvePeriod(filters);
  const clientId = filters.cliente || null;
  const projectId = filters.proyecto || null;

  const projectWhere: Prisma.ProjectWhereInput = {
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { id: projectId } : {}),
  };
  // Movements tied to a project via their own projectId. With a client filter,
  // expenses without a project can't be attributed to it and are left out.
  const byProject = <T extends object>(extra: T) => ({
    ...(projectId ? { projectId } : {}),
    ...(clientId ? { project: { clientId } } : {}),
    ...extra,
  });

  const invoiceScope: Prisma.InvoiceWhereInput = {
    status: { not: "CANCELLED" },
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
  };

  const paymentsInPeriod: Prisma.PaymentWhereInput = {
    paidAt: period.range,
    receivable: {
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
    },
  };

  const withholdingsInPeriod: Prisma.WithholdingWhereInput = {
    invoice: invoiceScope,
    OR: [
      { issueDate: period.range },
      { issueDate: null, invoice: { issueDate: period.range } },
    ],
  };

  return {
    period,
    clientId,
    projectId,
    projectWhere,
    byProject,
    invoiceScope,
    paymentsInPeriod,
    withholdingsInPeriod,
  };
}

export async function getFinancialSummary(filters: SummaryFilters) {
  const {
    period,
    clientId,
    projectId,
    projectWhere,
    byProject,
    invoiceScope,
    paymentsInPeriod,
    withholdingsInPeriod,
  } = summaryScope(filters);

  const [
    projects,
    invoices,
    undatedInvoices,
    payments,
    receivables,
    expensesRegistered,
    expensesPaid,
    withholdings,
    openWithholdings,
  ] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        budget: true,
        client: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { ...invoiceScope, issueDate: period.range },
      select: {
        projectId: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        total: true,
      },
    }),
    prisma.invoice.count({ where: { ...invoiceScope, issueDate: null } }),
    prisma.payment.findMany({
      where: paymentsInPeriod,
      select: { amount: true, receivable: { select: { projectId: true } } },
    }),
    prisma.receivable.findMany({
      where: {
        status: { notIn: ["PAID", "CANCELLED"] },
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      select: {
        projectId: true,
        amount: true,
        paidAmount: true,
        withheldAmount: true,
        status: true,
      },
    }),
    prisma.expense.findMany({
      where: byProject({ expenseDate: period.range }),
      select: {
        projectId: true,
        amount: true,
        taxAmount: true,
        status: true,
        payeeKind: true,
        category: { select: { name: true } },
      },
    }),
    prisma.expense.findMany({
      where: byProject({ status: "PAID" as const, paidAt: period.range }),
      select: {
        projectId: true,
        amount: true,
        taxAmount: true,
        status: true,
        payeeKind: true,
      },
    }),
    prisma.withholding.findMany({
      where: withholdingsInPeriod,
      select: { kind: true, amount: true, invoice: { select: { projectId: true } } },
    }),
    prisma.withholding.findMany({
      // Applied ones already reduce the milestones' balance; only the rest
      // feed the "net of withholdings" estimate.
      where: {
        appliesToBalance: false,
        invoice: { ...invoiceScope, status: { notIn: ["PAID", "CANCELLED"] } },
      },
      select: { kind: true, amount: true, invoice: { select: { projectId: true } } },
    }),
  ]);

  // Show a project when it moved in the period or is still running; listing
  // every archived project would only add rows of zeros.
  const active = new Set<string>();
  for (const row of [
    ...invoices,
    ...expensesRegistered,
    ...expensesPaid,
    ...receivables,
  ]) {
    if (row.projectId) active.add(row.projectId);
  }
  for (const p of payments) if (p.receivable.projectId) active.add(p.receivable.projectId);
  for (const w of withholdings) if (w.invoice.projectId) active.add(w.invoice.projectId);

  const shownProjects = projects.filter(
    (p) =>
      active.has(p.id) ||
      p.id === projectId ||
      p.status === "ACTIVE" ||
      p.status === "PAUSED",
  );

  const summary = summarize({
    projects: shownProjects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client?.name ?? null,
      budget: p.budget,
    })),
    invoices,
    payments: payments.map((p) => ({
      projectId: p.receivable.projectId,
      amount: p.amount,
    })),
    receivables,
    expensesRegistered: expensesRegistered.map((e) => ({
      ...e,
      categoryName: e.category?.name ?? null,
    })),
    expensesPaid: expensesPaid.map((e) => ({ ...e, categoryName: null })),
    withholdings: withholdings.map((w) => ({
      projectId: w.invoice.projectId,
      kind: w.kind,
      amount: w.amount,
    })),
    openWithholdings: openWithholdings.map((w) => ({
      projectId: w.invoice.projectId,
      kind: w.kind,
      amount: w.amount,
    })),
  });

  return {
    period,
    summary,
    undatedInvoices,
    filters: { clientId, projectId },
  };
}

/**
 * Every movement of the summary's selection as rows for the accountant:
 * invoices issued, collections, withholdings and expenses, each read once
 * with the same filters as the summary.
 */
export async function getMovementsForExport(filters: SummaryFilters) {
  const { period, byProject, invoiceScope, paymentsInPeriod, withholdingsInPeriod } =
    summaryScope(filters);

  const [invoices, payments, withholdings, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...invoiceScope, issueDate: period.range },
      orderBy: { issueDate: "asc" },
      include: {
        client: { select: { name: true, taxId: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: paymentsInPeriod,
      orderBy: { paidAt: "asc" },
      include: {
        receivable: {
          select: {
            title: true,
            client: { select: { name: true, taxId: true } },
            project: { select: { name: true } },
            invoice: { select: { invoiceNumber: true } },
          },
        },
      },
    }),
    prisma.withholding.findMany({
      where: withholdingsInPeriod,
      orderBy: { issueDate: "asc" },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            issueDate: true,
            client: { select: { name: true, taxId: true } },
            project: { select: { name: true } },
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: byProject({ expenseDate: period.range }),
      orderBy: { expenseDate: "asc" },
      include: {
        category: { select: { name: true } },
        payee: { select: { name: true, taxId: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  return { period, invoices, payments, withholdings, expenses };
}

/**
 * Cash in (collections) and cash out (paid expenses) per month, by payment
 * date, for the trailing `months` ending at `endKey`. Feeds the month-by-month
 * chart and the "vs previous month" deltas.
 */
export async function getMonthlyCashSeries({
  endKey,
  months = 6,
  cliente,
  proyecto,
}: {
  endKey: string;
  months?: number;
  cliente?: string;
  proyecto?: string;
}) {
  const keys = monthsEndingAt(endKey, months);
  const from = monthBounds(keys[0]).from;
  const to = monthBounds(endKey).to;
  const { paymentsInPeriod, byProject } = summaryScope({
    desde: from.toISOString().slice(0, 10),
    hasta: to.toISOString().slice(0, 10),
    cliente,
    proyecto,
  });

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: paymentsInPeriod,
      select: { paidAt: true, amount: true },
    }),
    prisma.expense.findMany({
      where: byProject({ status: "PAID" as const, paidAt: { gte: from, lte: to } }),
      select: { paidAt: true, amount: true },
    }),
  ]);

  const bucket = new Map(keys.map((k) => [k, { cobrado: 0, pagado: 0 }]));
  for (const p of payments) {
    const b = bucket.get(p.paidAt.toISOString().slice(0, 7));
    if (b) b.cobrado += toCents(p.amount);
  }
  for (const e of expenses) {
    if (!e.paidAt) continue;
    const b = bucket.get(e.paidAt.toISOString().slice(0, 7));
    if (b) b.pagado += toCents(e.amount);
  }

  return keys.map((key) => {
    const b = bucket.get(key)!;
    return { key, cobradoCents: b.cobrado, pagadoCents: b.pagado };
  });
}
