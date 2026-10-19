// Pure financial calculations. No Prisma here: the queries load and filter the
// rows, these functions only add them up, so the rules can be tested directly.
//
// Vocabulary kept apart on purpose:
// - contratado: Project.budget, what was agreed.
// - facturado: invoices issued (not cancelled). Includes IVA.
// - cobrado: Payment rows, money actually received.
// - saldo: what clients still owe on open milestones.
// - retenciones: withheld by the client. Not cash, never added to cobrado.
// - egresos registrados: expenses dated in the period, paid or pending.
// - egresos pagados: expenses actually paid in the period (by paidAt).

import {
  type MoneyInput,
  fromCents,
  percentOfCents,
  sumCents,
  toCents,
} from "@/lib/admin/finance/money";

export const NO_PROJECT = "__none__";

/** Base, IVA and total for a base amount and the rate the invoice carries. */
export function invoiceBreakdown({
  subtotal,
  vatRate,
}: {
  subtotal: MoneyInput;
  vatRate: MoneyInput;
}) {
  const base = toCents(subtotal);
  const iva = vatRate == null || vatRate === "" ? null : percentOfCents(base, vatRate);

  return {
    base: fromCents(base),
    iva: iva == null ? null : fromCents(iva),
    total: iva == null ? null : fromCents(base + iva),
  };
}

/** Whether the stored subtotal + IVA add up to the stored total. */
export function checkInvoiceTotals({
  subtotal,
  taxAmount,
  total,
}: {
  subtotal: MoneyInput;
  taxAmount: MoneyInput;
  total: MoneyInput;
}) {
  if (subtotal == null) return { complete: false, difference: null };
  const difference = toCents(total) - toCents(subtotal) - toCents(taxAmount);
  return { complete: true, difference: fromCents(difference) };
}

/**
 * What a milestone still owes: amount − cash received − withholdings applied
 * to it. Never negative: an overpayment owes nothing.
 */
export function receivableBalanceCents(
  amount: MoneyInput,
  paidAmount: MoneyInput,
  withheldAmount: MoneyInput = 0,
) {
  return Math.max(0, toCents(amount) - toCents(paidAmount) - toCents(withheldAmount));
}

/** Same balance as a "123.45" string, for display code. */
export function receivableBalance(r: {
  amount: MoneyInput;
  paidAmount: MoneyInput;
  withheldAmount?: MoneyInput;
}) {
  return fromCents(receivableBalanceCents(r.amount, r.paidAmount, r.withheldAmount));
}

type AllocationReceivable = {
  id: string;
  amount: MoneyInput;
  paidAmount: MoneyInput;
  status: string;
};

/**
 * Spreads the withholdings applied to an invoice over its milestones, oldest
 * first, up to what each one still owes in cash. Cancelled milestones take
 * nothing, and any excess (the client withheld more than was left) stays
 * unallocated rather than inflating a balance.
 */
export function allocateWithholdings(
  receivables: AllocationReceivable[],
  appliedTotal: MoneyInput,
) {
  let left = toCents(appliedTotal);
  return receivables.map((r) => {
    if (r.status === "CANCELLED") return { id: r.id, withheld: 0 };
    const open = receivableBalanceCents(r.amount, r.paidAmount);
    const withheld = Math.min(open, Math.max(0, left));
    left -= withheld;
    return { id: r.id, withheld };
  });
}

/**
 * Status of a milestone from what covers it. Mirrors the rule the payment
 * actions already used (paid ≥ amount → PAID, some paid → PARTIALLY_PAID)
 * with withholdings counted as covering the balance. A milestone that is no
 * longer covered at all falls back to INVOICED/PLANNED; any other manual
 * status (OVERDUE, CANCELLED...) is kept.
 */
export function coveredStatus(r: {
  amount: MoneyInput;
  paidAmount: MoneyInput;
  withheldAmount: MoneyInput;
  status: string;
  invoiceId: string | null;
}) {
  if (r.status === "CANCELLED") return r.status;
  const covered = toCents(r.paidAmount) + toCents(r.withheldAmount);
  if (covered >= toCents(r.amount) && covered > 0) return "PAID";
  if (covered > 0) return "PARTIALLY_PAID";
  if (r.status === "PAID" || r.status === "PARTIALLY_PAID") {
    return r.invoiceId ? "INVOICED" : "PLANNED";
  }
  return r.status;
}

/**
 * Base of an invoice for margin purposes. Falls back to total − IVA when only
 * those were stored, and to the total (flagged) when nothing was broken down.
 */
function invoiceBaseCents(invoice: SummaryInvoice) {
  if (invoice.subtotal != null) return { cents: toCents(invoice.subtotal), exact: true };
  if (invoice.taxAmount != null) {
    return { cents: toCents(invoice.total) - toCents(invoice.taxAmount), exact: true };
  }
  return { cents: toCents(invoice.total), exact: false };
}

export type SummaryProject = {
  id: string;
  name: string;
  clientName: string | null;
  budget: MoneyInput;
};

export type SummaryInvoice = {
  projectId: string | null;
  status: string;
  subtotal: MoneyInput;
  taxAmount: MoneyInput;
  total: MoneyInput;
};

export type SummaryPayment = { projectId: string | null; amount: MoneyInput };

export type SummaryReceivable = {
  projectId: string | null;
  amount: MoneyInput;
  paidAmount: MoneyInput;
  withheldAmount?: MoneyInput;
  status: string;
};

export type SummaryExpense = {
  projectId: string | null;
  amount: MoneyInput;
  taxAmount: MoneyInput;
  status: string;
  payeeKind: string | null;
  categoryName: string | null;
};

export type SummaryWithholding = {
  projectId: string | null;
  kind: string;
  amount: MoneyInput;
};

export type SummaryInput = {
  projects: SummaryProject[];
  /** Issued in the period. Cancelled ones are dropped here. */
  invoices: SummaryInvoice[];
  /** Received in the period. */
  payments: SummaryPayment[];
  /** Milestones as they stand today; the balance is not a period figure. */
  receivables: SummaryReceivable[];
  /** Dated (expenseDate) in the period, any status. */
  expensesRegistered: SummaryExpense[];
  /** Paid (paidAt) in the period. */
  expensesPaid: SummaryExpense[];
  /** Received in the period. */
  withholdings: SummaryWithholding[];
  /**
   * Withholdings on still-open invoices that were NOT applied to the balance,
   * for the "net of withholdings" estimate.
   */
  openWithholdings: SummaryWithholding[];
};

type Totals = {
  contracted: number;
  invoiced: number;
  invoicedBase: number;
  invoicedTax: number;
  invoicesWithoutBreakdown: number;
  collected: number;
  receivableBalance: number;
  withheld: number;
  withheldVat: number;
  withheldIncome: number;
  openWithheld: number;
  expensesRegistered: number;
  expensesRegisteredPaid: number;
  expensesPending: number;
  expensesTax: number;
  collaboratorPayments: number;
  expensesPaidInPeriod: number;
};

function emptyTotals(): Totals {
  return {
    contracted: 0,
    invoiced: 0,
    invoicedBase: 0,
    invoicedTax: 0,
    invoicesWithoutBreakdown: 0,
    collected: 0,
    receivableBalance: 0,
    withheld: 0,
    withheldVat: 0,
    withheldIncome: 0,
    openWithheld: 0,
    expensesRegistered: 0,
    expensesRegisteredPaid: 0,
    expensesPending: 0,
    expensesTax: 0,
    collaboratorPayments: 0,
    expensesPaidInPeriod: 0,
  };
}

function accumulate(totals: Totals, input: SummaryInput, projects: SummaryProject[]) {
  totals.contracted += sumCents(projects, (p) => p.budget);

  for (const invoice of input.invoices) {
    if (invoice.status === "CANCELLED") continue;
    const base = invoiceBaseCents(invoice);
    totals.invoiced += toCents(invoice.total);
    totals.invoicedBase += base.cents;
    totals.invoicedTax += toCents(invoice.taxAmount);
    if (!base.exact) totals.invoicesWithoutBreakdown += 1;
  }

  totals.collected += sumCents(input.payments, (p) => p.amount);

  for (const r of input.receivables) {
    if (r.status === "PAID" || r.status === "CANCELLED") continue;
    totals.receivableBalance += receivableBalanceCents(
      r.amount,
      r.paidAmount,
      r.withheldAmount,
    );
  }

  for (const w of input.withholdings) {
    const cents = toCents(w.amount);
    totals.withheld += cents;
    if (w.kind === "VAT") totals.withheldVat += cents;
    else totals.withheldIncome += cents;
  }
  totals.openWithheld += sumCents(input.openWithholdings, (w) => w.amount);

  for (const e of input.expensesRegistered) {
    const cents = toCents(e.amount);
    totals.expensesRegistered += cents;
    if (e.status === "PAID") totals.expensesRegisteredPaid += cents;
    else totals.expensesPending += cents;
    totals.expensesTax += toCents(e.taxAmount);
    if (e.payeeKind === "COLLABORATOR") totals.collaboratorPayments += cents;
  }

  totals.expensesPaidInPeriod += sumCents(input.expensesPaid, (e) => e.amount);
}

function present(totals: Totals) {
  const marginEstimate = totals.invoicedBase - totals.expensesRegistered;

  return {
    contracted: fromCents(totals.contracted),
    invoiced: fromCents(totals.invoiced),
    invoicedBase: fromCents(totals.invoicedBase),
    invoicedTax: fromCents(totals.invoicedTax),
    invoicesWithoutBreakdown: totals.invoicesWithoutBreakdown,
    collected: fromCents(totals.collected),
    receivableBalance: fromCents(totals.receivableBalance),
    receivableBalanceNetOfWithholdings: fromCents(
      Math.max(0, totals.receivableBalance - totals.openWithheld),
    ),
    withheld: fromCents(totals.withheld),
    withheldVat: fromCents(totals.withheldVat),
    withheldIncome: fromCents(totals.withheldIncome),
    expensesRegistered: fromCents(totals.expensesRegistered),
    expensesRegisteredPaid: fromCents(totals.expensesRegisteredPaid),
    expensesPending: fromCents(totals.expensesPending),
    expensesTax: fromCents(totals.expensesTax),
    collaboratorPayments: fromCents(totals.collaboratorPayments),
    expensesPaidInPeriod: fromCents(totals.expensesPaidInPeriod),
    netCashFlow: fromCents(totals.collected - totals.expensesPaidInPeriod),
    marginEstimate: fromCents(marginEstimate),
    /** Margin is only an estimate when some invoice has no base recorded. */
    marginIncomplete: totals.invoicesWithoutBreakdown > 0,
  };
}

export type SummaryFigures = ReturnType<typeof present>;

function byProject<T extends { projectId: string | null }>(items: T[], key: string) {
  return items.filter((item) => (item.projectId ?? NO_PROJECT) === key);
}

/**
 * Totals for the whole selection plus one row per project and a "sin
 * proyecto" row. The overall figures are computed from the flat lists once,
 * never by adding the rows up, so a row can't be counted twice.
 */
export function summarize(input: SummaryInput) {
  const overall = emptyTotals();
  accumulate(overall, input, input.projects);

  const keys = [...input.projects.map((p) => p.id), NO_PROJECT];
  const rows = keys.map((key) => {
    const project = input.projects.find((p) => p.id === key) ?? null;
    const totals = emptyTotals();
    accumulate(
      totals,
      {
        projects: [],
        invoices: byProject(input.invoices, key),
        payments: byProject(input.payments, key),
        receivables: byProject(input.receivables, key),
        expensesRegistered: byProject(input.expensesRegistered, key),
        expensesPaid: byProject(input.expensesPaid, key),
        withholdings: byProject(input.withholdings, key),
        openWithholdings: byProject(input.openWithholdings, key),
      },
      project ? [project] : [],
    );

    return {
      key,
      projectId: project?.id ?? null,
      name: project?.name ?? "Sin proyecto",
      clientName: project?.clientName ?? null,
      hasBudget: project?.budget != null,
      figures: present(totals),
    };
  });

  const categories = new Map<string, number>();
  for (const e of input.expensesRegistered) {
    const name = e.categoryName ?? "Sin categoría";
    categories.set(name, (categories.get(name) ?? 0) + toCents(e.amount));
  }

  return {
    overall: present(overall),
    rows,
    byCategory: [...categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, cents]) => ({ name, amount: fromCents(cents) })),
  };
}

export type FinancialSummary = ReturnType<typeof summarize>;
