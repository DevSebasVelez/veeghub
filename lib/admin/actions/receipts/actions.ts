"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState, optionalId, requiredText, text } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { cleanParam } from "@/lib/admin/finance/period";
import {
  getAccountStatementData,
  getPaymentReceiptData,
} from "@/lib/admin/receipts/data";
import { buildDocumentEmailHtml } from "@/lib/email/document-template";
import { sendInvoiceEmail as sendWithResend } from "@/lib/email/resend";
import { renderAccountStatement } from "@/lib/pdf/account-statement";
import { longDay, money, shortDay } from "@/lib/pdf/components";
import { receiptFilename, statementFilename } from "@/lib/pdf/files";
import { renderPaymentReceipt } from "@/lib/pdf/payment-receipt";

type Delivery = {
  kind: "RECEIPT" | "STATEMENT";
  paymentId?: string;
  clientId: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
};

/** Sends through Resend and leaves an EmailDelivery row either way. */
async function deliver(
  delivery: Delivery,
  html: string,
  attachment: { filename: string; content: Buffer },
) {
  const { kind, paymentId, clientId, to, cc, subject, body } = delivery;
  try {
    const providerMessageId = await sendWithResend({
      to,
      cc,
      subject,
      html,
      attachments: [attachment],
    });
    await prisma.emailDelivery.create({
      data: { kind, paymentId, clientId, to, cc, subject, body, providerMessageId, sentAt: new Date() },
    });
  } catch (error) {
    await prisma.emailDelivery.create({
      data: {
        kind,
        paymentId,
        clientId,
        to,
        cc,
        subject,
        body,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });
    throw error;
  }
}

export async function sendPaymentReceipt(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const paymentId = requiredText(formData, "paymentId");
    const to = requiredText(formData, "to");
    const cc = text(formData, "cc") ?? undefined;
    const customMessage = text(formData, "customMessage");

    const data = await getPaymentReceiptData(paymentId);
    const { clientId, projectId } = await prisma.payment
      .findUniqueOrThrow({
        where: { id: paymentId },
        select: { receivable: { select: { clientId: true, projectId: true } } },
      })
      .then((p) => p.receivable);

    const subject =
      text(formData, "subject") ?? `Comprobante de pago ${data.folio} · ${data.client.name}`;
    const filename = receiptFilename(data);
    const html = buildDocumentEmailHtml({
      clientName: data.client.name,
      intro: `Confirmamos la recepción de su pago del ${longDay(data.paidAt)}. Adjuntamos el comprobante en PDF para sus registros.`,
      customMessage,
      figureLabel: "Monto recibido",
      figure: money(data.amountCents),
      figureTone: "emerald",
      rows: [
        { label: "Concepto", value: data.concept },
        ...(data.project ? [{ label: "Proyecto", value: data.project }] : []),
        { label: "Fecha de pago", value: longDay(data.paidAt) },
        ...(data.reference ? [{ label: "Referencia", value: data.reference, mono: true }] : []),
        { label: "Saldo del hito", value: money(data.milestone.balanceAfterCents) },
      ],
      attachmentName: filename,
      docLabel: "Comprobante de pago",
      docCode: data.folio,
    });

    await deliver(
      { kind: "RECEIPT", paymentId, clientId, to, cc, subject, body: customMessage ?? "" },
      html,
      { filename, content: await renderPaymentReceipt(data) },
    );

    revalidatePath("/admin/finanzas");
    revalidatePath(`/admin/clientes/${clientId}`);
    if (projectId) revalidatePath(`/admin/proyectos/${projectId}`);
  });
}

export async function sendAccountStatement(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const clientId = requiredText(formData, "clientId");
    const to = requiredText(formData, "to");
    const cc = text(formData, "cc") ?? undefined;
    const customMessage = text(formData, "customMessage");

    const data = await getAccountStatementData({
      clientId,
      projectId: optionalId(formData, "proyecto"),
      desde: cleanParam(text(formData, "desde") ?? undefined),
      hasta: cleanParam(text(formData, "hasta") ?? undefined),
      all: text(formData, "todo") === "1",
    });

    const owes = data.pendingCents > 0;
    const subject = text(formData, "subject") ?? `Estado de cuenta · ${data.client.name}`;
    const filename = statementFilename(data);
    const period = `${shortDay(data.from)} – ${shortDay(data.to)}`;
    const html = buildDocumentEmailHtml({
      clientName: data.client.name,
      intro: owes
        ? `Le compartimos su estado de cuenta con corte al ${longDay(data.cutoff)}. Incluye los pagos recibidos en el periodo y el detalle de los valores pendientes con sus fechas de vencimiento.`
        : `Le compartimos su estado de cuenta con corte al ${longDay(data.cutoff)}, con el detalle de los pagos recibidos en el periodo. No registra valores pendientes.`,
      customMessage,
      figureLabel: owes ? "Saldo pendiente" : "Pagado en el periodo",
      figure: money(owes ? data.pendingCents : data.paidCents),
      figureTone: owes ? (data.overdueCents > 0 ? "red" : "ink") : "emerald",
      rows: [
        { label: "Periodo", value: period },
        ...(data.project ? [{ label: "Proyecto", value: data.project }] : []),
        { label: "Pagado en el periodo", value: money(data.paidCents) },
        ...(owes ? [{ label: "Vencido", value: money(data.overdueCents) }] : []),
      ],
      attachmentName: filename,
      docLabel: "Estado de cuenta",
      docCode: data.code,
    });

    await deliver(
      { kind: "STATEMENT", clientId, to, cc, subject, body: customMessage ?? "" },
      html,
      { filename, content: await renderAccountStatement(data) },
    );

    revalidatePath(`/admin/clientes/${clientId}`);
  });
}
