"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult } from "@/lib/admin/actions/shared";
import { SriEmissionError } from "@/lib/sri/emission";
import { advanceInvoice, createIssuedInvoice } from "@/lib/sri/issue";
import { resolveIssueRequest } from "@/lib/sri/issue-request";

// «Emitir factura»: the human click of the golden rule. createIssued takes
// the secuencial and stores the DRAFT; the screen then calls sendIssued,
// which signs, sends and asks for the authorization while the screen polls
// /admin/facturas/[id]/estado to show the progress.

function revalidateInvoice(id: string, clientId?: string, projectId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${id}`);
  revalidatePath("/admin/finanzas");
  if (clientId) revalidatePath(`/admin/clientes/${clientId}`);
  if (projectId) revalidatePath(`/admin/proyectos/${projectId}`);
}

export async function createIssued(raw: unknown) {
  await requireAdmin();

  return actionResult(async () => {
    const { request, input } = await resolveIssueRequest(raw);
    const invoice = await createIssuedInvoice(input);

    if (request.updateClient && request.buyer.idType !== "07") {
      await prisma.client.update({
        where: { id: request.clientId },
        data: {
          taxId: input.buyer.id,
          legalName: input.buyer.name,
          ...(input.buyer.address ? { address: input.buyer.address } : {}),
          ...(request.buyer.email.trim() ? { billingEmail: request.buyer.email.trim() } : {}),
        },
      });
    }

    revalidateInvoice(invoice.id, request.clientId, request.projectId);
    return { id: invoice.id, number: invoice.invoiceNumber };
  });
}

export async function sendIssued(invoiceId: string) {
  await requireAdmin();

  return actionResult(async () => {
    const result = await advanceInvoice(invoiceId);
    if (result.busy) throw new SriEmissionError("Ya se está procesando esta factura. Espera unos segundos.");
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { clientId: true, projectId: true },
    });
    revalidateInvoice(invoiceId, invoice?.clientId, invoice?.projectId);
    return result;
  });
}
