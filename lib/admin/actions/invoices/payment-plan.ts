"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";
import { syncInvoicePaidStatus, syncInvoiceReceivables } from "@/lib/admin/services/invoice-sync";

// Milestones of an invoice issued from VeegHub: its payment plan. Its XML
// cannot change, but which milestones collect it can, so an invoice issued
// without milestones can be paid in parts agreed later. Payments are still
// recorded on the milestones («Cobrar»); the invoice is paid when they reach
// its total (syncInvoicePaidStatus).

async function loadIssued(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      source: true,
      sriStatus: true,
      clientId: true,
      projectId: true,
      invoiceNumber: true,
      total: true,
      receivables: { select: { id: true, amount: true } },
    },
  });
  if (!invoice) throw new Error("La factura ya no existe.");
  if (invoice.source !== "ISSUED") throw new Error("Los hitos de una factura registrada se eligen con «Editar».");
  if (invoice.sriStatus !== "AUTHORIZED") throw new Error("Primero el SRI debe autorizar la factura.");
  return invoice;
}

function revalidate(invoice: { id: string; clientId: string; projectId: string | null }) {
  revalidatePath(`/admin/facturas/${invoice.id}`);
  revalidatePath("/admin/facturas");
  revalidatePath("/admin/finanzas");
  revalidatePath(`/admin/clientes/${invoice.clientId}`);
  if (invoice.projectId) revalidatePath(`/admin/proyectos/${invoice.projectId}`);
}

/** Sets exactly which of the client's milestones collect the invoice. */
export async function setInvoiceReceivables(invoiceId: string, receivableIds: string[]): Promise<AdminFormState> {
  await requireAdmin();
  return actionState(async () => {
    const invoice = await loadIssued(invoiceId);
    const ids = [...new Set(receivableIds)];
    if (ids.length) {
      const usable = await prisma.receivable.count({
        where: {
          id: { in: ids },
          clientId: invoice.clientId,
          status: { not: "CANCELLED" },
          OR: [{ invoiceId: null }, { invoiceId }],
        },
      });
      if (usable !== ids.length) throw new Error("Algún hito no es del cliente o ya tiene otra factura.");
    }
    await prisma.$transaction(async (tx) => {
      await syncInvoiceReceivables(tx, invoiceId, ids);
      await syncInvoicePaidStatus(tx, invoiceId);
    });
    revalidate(invoice);
  });
}

const planSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1, "Cada cuota necesita un nombre.").max(200),
      amount: z.string().trim(),
      /** "yyyy-MM-dd" or empty. */
      dueDate: z.string().trim(),
    }),
  )
  .min(1, "Agrega al menos una cuota.")
  .max(24, "Hasta 24 cuotas.");

/**
 * Creates milestones for the part of the invoice no milestone covers yet,
 * already linked to it. The amounts may add up to less than that balance
 * (the rest can be planned later), never to more.
 */
export async function createInvoicePaymentPlan(invoiceId: string, raw: unknown): Promise<AdminFormState> {
  await requireAdmin();
  return actionState(async () => {
    const invoice = await loadIssued(invoiceId);
    const plan = planSchema.parse(raw).map((row) => {
      const cents = toCents(row.amount.replace(",", "."));
      if (!/^\d+([.,]\d{1,2})?$/.test(row.amount) || cents <= 0) {
        throw new Error(`«${row.title}»: el monto debe ser mayor que cero, con hasta 2 decimales.`);
      }
      if (row.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) throw new Error(`«${row.title}»: fecha inválida.`);
      return { ...row, cents };
    });

    const balance = toCents(invoice.total) - sumCents(invoice.receivables, (r) => r.amount);
    const planned = plan.reduce((sum, row) => sum + row.cents, 0);
    if (planned > balance) {
      throw new Error(
        `Las cuotas suman ${fromCents(planned)} y lo que falta planificar es ${fromCents(Math.max(balance, 0))}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const row of plan) {
        await tx.receivable.create({
          data: {
            clientId: invoice.clientId,
            projectId: invoice.projectId,
            invoiceId,
            title: row.title,
            amount: fromCents(row.cents),
            dueDate: row.dueDate ? new Date(`${row.dueDate}T00:00:00.000Z`) : null,
            status: "INVOICED",
          },
        });
      }
      // Re-spread withholdings over the new milestones and recheck «Pagada».
      const ids = (await tx.receivable.findMany({ where: { invoiceId }, select: { id: true } })).map((r) => r.id);
      await syncInvoiceReceivables(tx, invoiceId, ids);
      await syncInvoicePaidStatus(tx, invoiceId);
    });
    revalidate(invoice);
  });
}
