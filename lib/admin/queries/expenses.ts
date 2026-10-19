import type { Prisma } from "@/app/generated/prisma/client";
import type { ExpenseStatus, PayeeKind } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";
import { PAYEE_KINDS } from "@/lib/admin/schemas";
import { resolvePeriod } from "@/lib/admin/finance/period";
import { fromCents, toCents } from "@/lib/admin/finance/money";
import { duePeriods, nextDueDate } from "@/lib/admin/finance/recurrence";
import { dayStartUtc } from "@/lib/admin/format";

const EXPENSES_PAGE_SIZE = 20;

export type ExpenseFilters = {
  page?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  categoria?: string;
  proyecto?: string;
  beneficiario?: string;
  clasificacion?: string;
};

export async function getExpenseFormOptions() {
  const [categories, payees, projects] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: [{ archived: "asc" }, { name: "asc" }],
      select: { id: true, name: true, archived: true },
    }),
    prisma.payee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { categories, payees, projects };
}

/** The filters of the expenses page as a Prisma where, shared with export. */
export function expenseWhere(filters: ExpenseFilters) {
  const period = resolvePeriod(filters);
  const where: Prisma.ExpenseWhereInput = {
    expenseDate: period.range,
    ...(filters.estado === "PENDING" || filters.estado === "PAID"
      ? { status: filters.estado as ExpenseStatus }
      : {}),
    ...(filters.categoria
      ? { categoryId: filters.categoria === "none" ? null : filters.categoria }
      : {}),
    ...(filters.proyecto
      ? { projectId: filters.proyecto === "none" ? null : filters.proyecto }
      : {}),
    ...(filters.beneficiario ? { payeeId: filters.beneficiario } : {}),
    ...(PAYEE_KINDS.includes(filters.clasificacion as PayeeKind)
      ? { payeeKind: filters.clasificacion as PayeeKind }
      : {}),
  };

  return { period, where };
}

export async function getExpensesPageData(filters: ExpenseFilters) {
  const page = getPage(filters.page);
  const { period, where } = expenseWhere(filters);

  const [expenses, total, byStatus] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * EXPENSES_PAGE_SIZE,
      take: EXPENSES_PAGE_SIZE,
      include: {
        category: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiptFile: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({
      by: ["status"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const paid = toCents(byStatus.find((s) => s.status === "PAID")?._sum.amount);
  const pending = toCents(
    byStatus.find((s) => s.status === "PENDING")?._sum.amount,
  );

  return {
    page,
    pageSize: EXPENSES_PAGE_SIZE,
    period,
    expenses,
    total,
    totals: {
      registered: fromCents(paid + pending),
      paid: fromCents(paid),
      pending: fromCents(pending),
    },
  };
}

export async function getPayeesWithUsage() {
  return prisma.payee.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });
}

export async function getCategoriesWithUsage() {
  return prisma.expenseCategory.findMany({
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: { _count: { select: { expenses: true } } },
  });
}

/** Templates with how many due periods have not been generated yet. */
export async function getRecurringExpenses() {
  const today = dayStartUtc(new Date());
  const templates = await prisma.recurringExpense.findMany({
    orderBy: [{ active: "desc" }, { description: "asc" }],
    include: {
      category: { select: { name: true } },
      payee: { select: { name: true } },
      project: { select: { name: true } },
      expenses: { select: { recurrencePeriod: true } },
    },
  });

  return templates.map(({ expenses, ...t }) => {
    const done = new Set(expenses.map((e) => e.recurrencePeriod));
    return {
      ...t,
      generatedCount: expenses.length,
      missing: t.active
        ? duePeriods(t, today).filter((p) => !done.has(p.period)).length
        : 0,
      nextDue: t.active ? nextDueDate(t, today) : null,
    };
  });
}

/** Every expense matching the page filters, for the CSV export. */
export async function getExpensesForExport(filters: ExpenseFilters) {
  const { period, where } = expenseWhere(filters);
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
    include: {
      category: { select: { name: true } },
      payee: { select: { name: true, taxId: true } },
      project: { select: { name: true, client: { select: { name: true } } } },
    },
  });
  return { period, expenses };
}
