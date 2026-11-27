import { type MoneyInput, toCents } from "@/lib/admin/finance/money";

// Project view of an account statement: every milestone of the project, paid
// or not, so the client sees what the whole project is worth, what has been
// covered and what is left. Pure, so it is tested without a database.

const DAY_MS = 86_400_000;

/** How a milestone reads on the statement, from its figures at the cutoff. */
export type MilestoneStanding = "PAID" | "PARTIAL" | "OVERDUE" | "PENDING";

export type StatementMilestone = {
  id: string;
  concept: string;
  detail: string | null;
  dueDate: Date | null;
  invoiceNumber: string | null;
  amountCents: number;
  paidCents: number;
  withheldCents: number;
  balanceCents: number;
  /** Negative: days left; positive: days overdue; null: no due date. */
  daysOverdue: number | null;
  standing: MilestoneStanding;
};

export type ProjectStatementSummary = {
  /** Sum of the project's milestones, cancelled ones aside. */
  valueCents: number;
  paidCents: number;
  withheldCents: number;
  balanceCents: number;
  overdueCents: number;
  milestones: StatementMilestone[];
};

export type SummaryMilestoneInput = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  amount: MoneyInput;
  paidAmount: MoneyInput;
  withheldAmount: MoneyInput;
  dueDate: Date | null;
  invoice: { invoiceNumber: string | null } | null;
};

/**
 * @param cutoff today in the business zone as a UTC-midnight date, the same
 *   form as every @db.Date column, so day differences are whole days.
 */
export function summarizeProjectMilestones(
  receivables: SummaryMilestoneInput[],
  cutoff: Date,
): ProjectStatementSummary {
  const milestones = receivables
    .filter((r) => r.status !== "CANCELLED")
    .map((r): StatementMilestone => {
      const amountCents = toCents(r.amount);
      const paidCents = toCents(r.paidAmount);
      const withheldCents = toCents(r.withheldAmount);
      const balanceCents = Math.max(0, amountCents - paidCents - withheldCents);
      const daysOverdue = r.dueDate
        ? Math.round((cutoff.getTime() - r.dueDate.getTime()) / DAY_MS)
        : null;

      let standing: MilestoneStanding = "PENDING";
      if (balanceCents === 0) standing = "PAID";
      else if ((daysOverdue ?? 0) > 0) standing = "OVERDUE";
      else if (paidCents + withheldCents > 0) standing = "PARTIAL";

      return {
        id: r.id,
        concept: r.title,
        detail: r.description,
        dueDate: r.dueDate,
        invoiceNumber: r.invoice?.invoiceNumber ?? null,
        amountCents,
        paidCents,
        withheldCents,
        balanceCents,
        daysOverdue,
        standing,
      };
    });

  const sum = (pick: (m: StatementMilestone) => number) =>
    milestones.reduce((total, m) => total + pick(m), 0);

  return {
    valueCents: sum((m) => m.amountCents),
    paidCents: sum((m) => m.paidCents),
    withheldCents: sum((m) => m.withheldCents),
    balanceCents: sum((m) => m.balanceCents),
    overdueCents: sum((m) => (m.standing === "OVERDUE" ? m.balanceCents : 0)),
    milestones,
  };
}
