import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { toCents } from "@/lib/admin/finance/money";
import { parseDayParam, resolvePeriod } from "@/lib/admin/finance/period";
import {
  type ProjectStatementSummary,
  summarizeProjectMilestones,
} from "@/lib/admin/receipts/project-summary";

const DAY_MS = 86_400_000;

class FolioTaken extends Error {}

/**
 * Folio of a payment's receipt. Assigned the first time the receipt is
 * issued, from a per-year counter, and kept for every later download or
 * email. The counter and the payment update commit together, so a number is
 * never handed out twice; deleting a payment leaves a visible gap.
 */
export async function ensureReceiptFolio(paymentId: string) {
  const existing = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { receiptFolio: true },
  });
  if (existing.receiptFolio) return existing.receiptFolio;

  const year = dayKeyInAppZone(new Date()).slice(0, 4);
  const key = `RC-${year}`;

  try {
    return await prisma.$transaction(async (tx) => {
      const sequence = await tx.documentSequence.upsert({
        where: { key },
        create: { key, value: 1 },
        update: { value: { increment: 1 } },
      });
      const folio = `${key}-${String(sequence.value).padStart(4, "0")}`;
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, receiptFolio: null },
        data: { receiptFolio: folio, receiptIssuedAt: new Date() },
      });
      // Someone issued it a moment ago: roll the counter back and use theirs.
      if (updated.count === 0) throw new FolioTaken();
      return folio;
    });
  } catch (error) {
    if (!(error instanceof FolioTaken)) throw error;
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { receiptFolio: true },
    });
    return payment.receiptFolio!;
  }
}

export type ReceiptParty = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type PaymentReceiptData = {
  folio: string;
  issuedAt: Date;
  paidAt: Date;
  amountCents: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  client: ReceiptParty;
  project: string | null;
  concept: string;
  conceptDetail: string | null;
  milestone: {
    amountCents: number;
    withheldCents: number;
    paidBeforeCents: number;
    balanceAfterCents: number;
    /** Payment number within the milestone (1st, 2nd...) and the total. */
    position: number;
    count: number;
  };
  isFullPayment: boolean;
  invoice: { number: string | null; accessKey: string | null } | null;
  currency: string;
  recipientEmail: string | null;
};

/** Everything the receipt prints, with the folio assigned. */
export async function getPaymentReceiptData(paymentId: string): Promise<PaymentReceiptData> {
  const folio = await ensureReceiptFolio(paymentId);
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      receivable: {
        include: {
          client: true,
          project: { select: { name: true } },
          invoice: { select: { invoiceNumber: true, accessKey: true } },
          payments: {
            select: { id: true, amount: true, paidAt: true, createdAt: true },
            orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  const { receivable } = payment;
  const { client } = receivable;
  // The balance as of this payment, not as of today, so an early receipt
  // reissued later still tells the same story.
  const index = receivable.payments.findIndex((p) => p.id === payment.id);
  const paidBeforeCents = receivable.payments
    .slice(0, index)
    .reduce((total, p) => total + toCents(p.amount), 0);
  const amountCents = toCents(payment.amount);
  const milestoneCents = toCents(receivable.amount);
  const withheldCents = toCents(receivable.withheldAmount);
  const balanceAfterCents = Math.max(
    0,
    milestoneCents - withheldCents - paidBeforeCents - amountCents,
  );

  return {
    folio,
    issuedAt: payment.receiptIssuedAt ?? new Date(),
    paidAt: payment.paidAt,
    amountCents,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    client: {
      name: client.name,
      legalName: client.legalName,
      taxId: client.taxId,
      email: client.billingEmail ?? client.email,
      phone: client.phone,
      address: client.address,
    },
    project: receivable.project?.name ?? null,
    concept: receivable.title,
    conceptDetail: receivable.description,
    milestone: {
      amountCents: milestoneCents,
      withheldCents,
      paidBeforeCents,
      balanceAfterCents,
      position: index + 1,
      count: receivable.payments.length,
    },
    isFullPayment: balanceAfterCents === 0,
    invoice: receivable.invoice
      ? {
          number: receivable.invoice.invoiceNumber,
          accessKey: receivable.invoice.accessKey,
        }
      : null,
    currency: receivable.currency,
    recipientEmail: client.billingEmail ?? client.email,
  };
}

export type StatementPayment = {
  id: string;
  paidAt: Date;
  concept: string;
  project: string | null;
  method: string | null;
  reference: string | null;
  folio: string | null;
  amountCents: number;
};

export type StatementPending = {
  id: string;
  concept: string;
  detail: string | null;
  project: string | null;
  dueDate: Date | null;
  amountCents: number;
  coveredCents: number;
  balanceCents: number;
  /** Negative: days left; positive: days overdue; null: no due date. */
  daysOverdue: number | null;
};

export type AccountStatementData = {
  code: string;
  issuedAt: Date;
  from: Date;
  to: Date;
  /** Today in the business zone, as a UTC-midnight date. */
  cutoff: Date;
  client: ReceiptParty;
  project: string | null;
  /** Whole-project view (every milestone, paid or not); only for one project. */
  projectSummary: ProjectStatementSummary | null;
  payments: StatementPayment[];
  paidCents: number;
  pending: StatementPending[];
  pendingCents: number;
  overdueCents: number;
  recipientEmail: string | null;
};

export type StatementFilters = {
  clientId: string;
  projectId?: string | null;
  desde?: string;
  hasta?: string;
  /** "todo": from the client's first payment. */
  all?: boolean;
};

/**
 * Account statement of a client: payments received in the period, plus every
 * milestone still open at the cutoff (today), whatever its due date, so the
 * same document proves what was paid and asks for what is owed.
 *
 * Narrowed to one project it also carries the whole project (every
 * milestone, paid or not) in `projectSummary`.
 */
export async function getAccountStatementData(
  filters: StatementFilters,
): Promise<AccountStatementData> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: filters.clientId } });
  const project = filters.projectId
    ? await prisma.project.findFirst({
        where: { id: filters.projectId, clientId: client.id },
        select: { id: true, name: true },
      })
    : null;

  const receivableWhere = {
    clientId: client.id,
    ...(project ? { projectId: project.id } : {}),
  };

  let period = resolvePeriod({ desde: filters.desde, hasta: filters.hasta });
  if (filters.all) {
    const first = await prisma.payment.findFirst({
      where: { receivable: receivableWhere },
      orderBy: { paidAt: "asc" },
      select: { paidAt: true },
    });
    if (first) {
      period = resolvePeriod({
        desde: first.paidAt.toISOString().slice(0, 10),
        hasta: filters.hasta,
      });
    }
  }

  const [payments, open, projectMilestones] = await Promise.all([
    prisma.payment.findMany({
      where: { receivable: receivableWhere, paidAt: period.range },
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      include: {
        receivable: {
          select: { title: true, project: { select: { name: true } } },
        },
      },
    }),
    prisma.receivable.findMany({
      where: { ...receivableWhere, status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: { project: { select: { name: true } } },
    }),
    project
      ? prisma.receivable.findMany({
          where: { projectId: project.id, clientId: client.id },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          include: { invoice: { select: { invoiceNumber: true } } },
        })
      : Promise.resolve(null),
  ]);

  const todayKey = dayKeyInAppZone(new Date());
  const cutoff = parseDayParam(todayKey)!;

  const pending = open
    .map((r): StatementPending => {
      const amountCents = toCents(r.amount);
      const coveredCents = toCents(r.paidAmount) + toCents(r.withheldAmount);
      return {
        id: r.id,
        concept: r.title,
        detail: r.description,
        project: r.project?.name ?? null,
        dueDate: r.dueDate,
        amountCents,
        coveredCents,
        balanceCents: Math.max(0, amountCents - coveredCents),
        daysOverdue: r.dueDate
          ? Math.round((cutoff.getTime() - r.dueDate.getTime()) / DAY_MS)
          : null,
      };
    })
    .filter((r) => r.balanceCents > 0);

  const rows = payments.map(
    (p): StatementPayment => ({
      id: p.id,
      paidAt: p.paidAt,
      concept: p.receivable.title,
      project: p.receivable.project?.name ?? null,
      method: p.method,
      reference: p.reference,
      folio: p.receiptFolio,
      amountCents: toCents(p.amount),
    }),
  );

  const owner = project ?? client;
  return {
    code: `EC-${todayKey.replaceAll("-", "")}-${owner.id.slice(-4).toUpperCase()}`,
    issuedAt: new Date(),
    from: period.from,
    to: period.to,
    cutoff,
    client: {
      name: client.name,
      legalName: client.legalName,
      taxId: client.taxId,
      email: client.billingEmail ?? client.email,
      phone: client.phone,
      address: client.address,
    },
    project: project?.name ?? null,
    projectSummary: projectMilestones ? summarizeProjectMilestones(projectMilestones, cutoff) : null,
    payments: rows,
    paidCents: rows.reduce((total, p) => total + p.amountCents, 0),
    pending,
    pendingCents: pending.reduce((total, r) => total + r.balanceCents, 0),
    overdueCents: pending
      .filter((r) => (r.daysOverdue ?? 0) > 0)
      .reduce((total, r) => total + r.balanceCents, 0),
    recipientEmail: client.billingEmail ?? client.email,
  };
}
