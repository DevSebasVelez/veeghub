import type { Prisma, SriEnvironment, SriOperation } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { fromCents } from "@/lib/admin/finance/money";
import {
  type BuildInvoiceInput,
  type BuildInvoiceItem,
  buildInvoiceXml,
} from "@/lib/sri/build-invoice";
import { SriEmissionError, getSriTaxContext, takeSequential } from "@/lib/sri/emission";
import { SRI_EMITTER } from "@/lib/sri/emitter";
import { selfCheckInvoiceXml } from "@/lib/sri/self-check";
import { signStoredInvoice } from "@/lib/sri/signing";
import {
  type Decision,
  FINAL_STATUSES,
  type SriStatus,
  afterAuthorization,
  afterReception,
  retryDelayMs,
} from "@/lib/sri/state";
import {
  type AuthorizationAnswer,
  type ReceptionResult,
  type SriMessage,
  queryAuthorization,
  sendToReception,
} from "@/lib/sri/ws";

// Issuing an invoice from VeegHub (plan B4): create it as DRAFT with its own
// secuencial, then advance it DRAFT → SIGNED → RECEIVED → AUTHORIZED.
//
// - Golden rule: production is refused unless SRI_ALLOW_PRODUCTION=true.
//   Until go-live (B7) everything runs against celcer.
// - advanceInvoice is safe to call any number of times, from the button or
//   the cron: a lease keeps two runs off the same invoice, and every call to
//   the SRI is logged in SriSubmission.

// ─── Create ───────────────────────────────────────────────────────────────

export type IssueItem = BuildInvoiceItem & { receivableId?: string | null };

export type CreateIssuedInvoiceInput = {
  clientId: string;
  projectId?: string | null;
  emissionPointId: string;
  environment: SriEnvironment;
  /** Calendar day "yyyy-MM-dd". */
  issueDay: string;
  buyer: BuildInvoiceInput["buyer"];
  items: IssueItem[];
  payments: BuildInvoiceInput["payments"];
  additionalInfo?: BuildInvoiceInput["additionalInfo"];
};

/**
 * Creates the invoice as DRAFT: takes the secuencial, builds the unsigned XML
 * (which validates every figure) and stores it with its items, all in one
 * transaction. A failure leaves no invoice and gives the number back.
 */
export async function createIssuedInvoice(input: CreateIssuedInvoiceInput) {
  const issueDate = new Date(`${input.issueDay}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    const tax = await getSriTaxContext(issueDate, tx);
    const point = await tx.emissionPoint.findUniqueOrThrow({
      where: { id: input.emissionPointId },
      select: { address: true },
    });
    const taken = await takeSequential(tx, input.emissionPointId, input.environment);

    const built = buildInvoiceXml({
      environment: input.environment,
      emitter: SRI_EMITTER,
      rimpeLegend: tax.legend,
      allowedVatRates: tax.vatRates,
      establishment: taken.establishment,
      emissionPoint: taken.emissionPoint,
      establishmentAddress: point.address,
      sequential: taken.sequential,
      issueDay: input.issueDay,
      buyer: input.buyer,
      items: input.items,
      payments: input.payments,
      additionalInfo: input.additionalInfo,
    });

    const rates = [...new Set(built.lines.map((l) => l.vatRate))];
    return tx.invoice.create({
      data: {
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        source: "ISSUED",
        sriStatus: "DRAFT",
        environment: input.environment,
        emissionPointId: input.emissionPointId,
        sequential: taken.sequential,
        invoiceNumber: built.number,
        accessKey: built.accessKey,
        issueDate,
        subtotal: fromCents(built.subtotalCents),
        taxAmount: fromCents(built.vatCents),
        vatRate: rates.length === 1 ? rates[0] : null,
        total: fromCents(built.totalCents),
        sriXml: built.xml,
        items: {
          create: built.lines.map((line, index) => ({
            position: index + 1,
            code: line.code,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: fromCents(line.discountCents),
            vatCode: line.vatCode,
            vatRate: line.vatRate,
            receivableId: input.items[index].receivableId ?? null,
          })),
        },
      },
      select: { id: true, invoiceNumber: true, accessKey: true, total: true },
    });
  });
}

// ─── Advance ──────────────────────────────────────────────────────────────

type IssuedInvoice = {
  id: string;
  accessKey: string;
  environment: SriEnvironment;
  sriStatus: SriStatus;
  sriXml: string;
  sriAttempts: number;
};

/** What advanceInvoice talks to; tests and the campaign script swap pieces. */
export type IssueDeps = {
  sign: (xml: string, invoice: IssuedInvoice) => Promise<string>;
  send: (xml: string, env: SriEnvironment) => Promise<ReceptionResult>;
  query: (accessKey: string, env: SriEnvironment) => Promise<AuthorizationAnswer>;
  sleep: (ms: number) => Promise<void>;
};

const defaultDeps: IssueDeps = {
  sign: (xml, invoice) =>
    signStoredInvoice(xml, {
      accessKey: invoice.accessKey,
      environment: invoice.environment,
      invoiceId: invoice.id,
      purpose: "invoice",
    }),
  send: sendToReception,
  query: queryAuthorization,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const LEASE_MS = 90_000;
/** Authorization polls within one run before leaving it to the cron. */
const POLLS_PER_RUN = 3;

export type AdvanceResult =
  | { busy: true }
  | { busy: false; status: SriStatus; problem: string | null; pending: boolean };

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function productionAllowed(env: SriEnvironment) {
  return env === "PRUEBAS" || process.env.SRI_ALLOW_PRODUCTION === "true";
}

async function logCall<T extends { state: string | null; messages: SriMessage[] }>(
  invoice: IssuedInvoice,
  operation: SriOperation,
  call: () => Promise<T>,
): Promise<{ result: T | null; error?: string }> {
  const started = Date.now();
  try {
    const result = await call();
    await prisma.sriSubmission.create({
      data: {
        invoiceId: invoice.id,
        operation,
        environment: invoice.environment,
        accessKey: invoice.accessKey,
        status: result.state ?? "SIN REGISTRO",
        messages: result.messages as unknown as Prisma.InputJsonValue,
        durationMs: Date.now() - started,
      },
    });
    return { result };
  } catch (error) {
    await prisma.sriSubmission.create({
      data: {
        invoiceId: invoice.id,
        operation,
        environment: invoice.environment,
        accessKey: invoice.accessKey,
        status: "ERROR",
        error: errorText(error),
        durationMs: Date.now() - started,
      },
    });
    return { result: null, error: errorText(error) };
  }
}

/**
 * Moves an issued invoice as far as the SRI lets it in one run. Returns the
 * status it ended in and whether it still needs another run.
 */
export async function advanceInvoice(invoiceId: string, deps: IssueDeps = defaultDeps): Promise<AdvanceResult> {
  const now = new Date();
  const leased = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      source: "ISSUED",
      OR: [{ sriLeaseUntil: null }, { sriLeaseUntil: { lt: now } }],
    },
    data: { sriLeaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (leased.count === 0) return { busy: true };

  try {
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!row.accessKey || !row.environment || !row.sriStatus || !row.sriXml) {
      throw new SriEmissionError("La factura emitida está incompleta: falta clave, ambiente, estado o XML.");
    }
    const invoice: IssuedInvoice = {
      id: row.id,
      accessKey: row.accessKey,
      environment: row.environment,
      sriStatus: row.sriStatus,
      sriXml: row.sriXml,
      sriAttempts: row.sriAttempts,
    };

    let last: Decision = { status: invoice.sriStatus, retry: false, problem: row.sriLastError };
    let polls = 0;
    let justReceived = false;

    /** Persists a decision after an SRI call. */
    const apply = async (decision: Decision, extra: Prisma.InvoiceUpdateInput = {}) => {
      invoice.sriAttempts += 1;
      invoice.sriStatus = decision.status;
      last = decision;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          sriStatus: decision.status,
          sriAttempts: invoice.sriAttempts,
          sriLastError: decision.problem,
          sriNextAttemptAt: decision.retry
            ? new Date(Date.now() + retryDelayMs(invoice.sriAttempts))
            : null,
          ...extra,
        },
      });
    };

    /** VeegHub's own review; true when the document may go on. */
    const reviewed = async () => {
      const problems = selfCheckInvoiceXml(invoice.sriXml, {
        accessKey: invoice.accessKey,
        environment: invoice.environment,
      });
      if (problems.length === 0) return true;
      last = { status: invoice.sriStatus, retry: false, problem: `Revisión interna: ${problems.join(" ")}` };
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { sriLastError: last.problem, sriNextAttemptAt: null },
      });
      return false;
    };

    const send = async () => {
      if (!(await reviewed())) return false;
      if (!productionAllowed(invoice.environment)) {
        last = {
          status: invoice.sriStatus,
          retry: false,
          problem: "El envío a producción está deshabilitado (SRI_ALLOW_PRODUCTION).",
        };
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { sriLastError: last.problem, sriNextAttemptAt: null },
        });
        return false;
      }
      const { result, error } = await logCall(invoice, "RECEPTION", () => deps.send(invoice.sriXml, invoice.environment));
      const decision = afterReception(result, error);
      await apply(decision);
      justReceived = decision.status === "RECEIVED";
      return true;
    };

    const authorize = async (from: "SIGNED" | "RECEIVED") => {
      const { result, error } = await logCall(invoice, "AUTHORIZATION", () =>
        deps.query(invoice.accessKey, invoice.environment),
      );
      const decision = afterAuthorization(result, from, error);
      if (decision.send) return "send" as const;
      await apply(
        decision,
        decision.status === "AUTHORIZED" && result
          ? {
              authorizedAt: result.authorizedAt ? new Date(result.authorizedAt) : new Date(),
              sriAuthorizedXml: result.xml,
            }
          : {},
      );
      return decision.status === "RECEIVED" && decision.retry ? ("wait" as const) : ("done" as const);
    };

    for (let step = 0; step < 8; step += 1) {
      if (FINAL_STATUSES.includes(invoice.sriStatus)) break;

      if (invoice.sriStatus === "DRAFT") {
        if (!(await reviewed())) break;
        try {
          const signed = await deps.sign(invoice.sriXml, invoice);
          invoice.sriXml = signed;
          invoice.sriStatus = "SIGNED";
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { sriXml: signed, sriStatus: "SIGNED", sriLastError: null },
          });
          last = { status: "SIGNED", retry: true, problem: null };
        } catch (error) {
          last = { status: "DRAFT", retry: false, problem: `No se pudo firmar: ${errorText(error)}` };
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { sriLastError: last.problem, sriNextAttemptAt: null },
          });
          break;
        }
        continue;
      }

      if (invoice.sriStatus === "SIGNED") {
        // A previous send ended without an answer: the SRI may have it.
        if (invoice.sriAttempts > 0) {
          const outcome = await authorize("SIGNED");
          if (outcome !== "send") {
            if (invoice.sriStatus === "SIGNED") break; // still no answer: leave it to the cron
            continue;
          }
        }
        if (!(await send())) break;
        if (invoice.sriStatus === "SIGNED") break; // no answer this time either
        continue;
      }

      if (invoice.sriStatus === "RECEIVED") {
        if (polls >= POLLS_PER_RUN) break;
        // The SRI needs a moment between reception and authorization.
        await deps.sleep(justReceived || polls > 0 ? 2500 + polls * 1500 : 0);
        polls += 1;
        justReceived = false;
        await authorize("RECEIVED");
      }
    }

    return {
      busy: false,
      status: invoice.sriStatus,
      problem: last.problem,
      pending: !FINAL_STATUSES.includes(invoice.sriStatus) && last.retry,
    };
  } finally {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { sriLeaseUntil: null } });
  }
}

/**
 * Cron step: advances the issued invoices whose next attempt is due, oldest
 * first, within a time budget. DRAFTs are not picked up: signing and sending
 * start only from the human «Emitir» click.
 */
export async function processPendingInvoices({ limit = 10, budgetMs = 40_000 } = {}) {
  const started = Date.now();
  const due = await prisma.invoice.findMany({
    where: {
      source: "ISSUED",
      sriStatus: { in: ["SIGNED", "RECEIVED"] },
      sriNextAttemptAt: { lte: new Date() },
    },
    orderBy: { sriNextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: Array<{ id: string; status: string }> = [];
  for (const { id } of due) {
    if (Date.now() - started > budgetMs) break;
    try {
      const result = await advanceInvoice(id);
      results.push({ id, status: result.busy ? "busy" : result.status });
    } catch (error) {
      console.error("[sri] advance failed", id, error);
      results.push({ id, status: "error" });
    }
  }
  return { due: due.length, processed: results };
}

/**
 * Invoices issued by VeegHub are what their signed XML says: number, clave,
 * client and amounts cannot be edited afterwards (a correction is a nota de
 * crédito, B8). Called by every action that edits an invoice.
 */
export async function assertNotIssued(invoiceId: string, db: Prisma.TransactionClient = prisma) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { source: true } });
  if (invoice?.source === "ISSUED") {
    throw new SriEmissionError(
      "Esta factura se emitió desde VeegHub: sus datos son los del XML firmado y no se editan.",
    );
  }
}
