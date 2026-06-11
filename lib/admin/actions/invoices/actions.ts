"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { invoiceSchema, parseForm } from "@/lib/admin/schemas";
import { requiredText, text, actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { sendInvoiceEmail as sendWithResend } from "@/lib/email/resend";
import { buildInvoiceEmailHtml } from "@/lib/email/invoice-template";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { getR2ObjectBuffer } from "@/lib/storage/r2";
import {
  fileMetaFromForm,
  registerFileKey,
  uploadFileRecord,
} from "@/lib/admin/services/drive-files";
import {
  syncInvoicePaidStatus,
  syncInvoiceReceivables,
} from "@/lib/admin/services/invoice-sync";

export async function createInvoice(formData: FormData) {
  await requireAdmin();
  const { receivableIds, ...data } = parseForm(invoiceSchema, formData);

  const xml = formData.get("xml") as File | null;
  const ride = formData.get("ride") as File | null;

  const xmlFile = xml
    ? await uploadFileRecord({
        file: xml,
        clientId: data.clientId,
        projectId: data.projectId,
        prefix: "invoices/xml",
      })
    : null;
  const rideFile = ride
    ? await uploadFileRecord({
        file: ride,
        clientId: data.clientId,
        projectId: data.projectId,
        prefix: "invoices/ride",
      })
    : null;

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        ...data,
        xmlFileId: xmlFile?.id,
        rideFileId: rideFile?.id,
      },
    });
    await syncInvoiceReceivables(tx, invoice.id, receivableIds);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
}

export async function updateInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const { receivableIds, ...data } = parseForm(invoiceSchema, formData);

  const xml = formData.get("xml") as File | null;
  const ride = formData.get("ride") as File | null;

  const xmlFile = xml?.size
    ? await uploadFileRecord({
        file: xml,
        clientId: data.clientId,
        projectId: data.projectId,
        prefix: "invoices/xml",
      })
    : null;
  const rideFile = ride?.size
    ? await uploadFileRecord({
        file: ride,
        clientId: data.clientId,
        projectId: data.projectId,
        prefix: "invoices/ride",
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        ...data,
        ...(xmlFile ? { xmlFileId: xmlFile.id } : {}),
        ...(rideFile ? { rideFileId: rideFile.id } : {}),
      },
    });
    await syncInvoiceReceivables(tx, id, receivableIds);
    await syncInvoicePaidStatus(tx, id);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${id}`);
  revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

export async function sendInvoiceEmail(formData: FormData) {
  await requireAdmin();

  const invoiceId = requiredText(formData, "invoiceId");
  const to = requiredText(formData, "to");
  const cc = text(formData, "cc") ?? undefined;
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: true,
      project: true,
      xmlFile: true,
      rideFile: true,
    },
  });

  if (!invoice.xmlFile || !invoice.rideFile) {
    throw new Error("La factura necesita XML y RIDE antes de enviarse.");
  }

  const subject =
    text(formData, "subject") ??
    `Factura ${invoice.invoiceNumber ?? ""} · ${invoice.client.name}`.trim();
  const customMessage = text(formData, "customMessage") ?? undefined;

  const html = buildInvoiceEmailHtml({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    projectName: invoice.project?.name,
    issueDate: invoice.issueDate ? formatDateOnly(invoice.issueDate) : null,
    subtotal: invoice.subtotal
      ? formatCurrency(invoice.subtotal.toString())
      : null,
    taxAmount: invoice.taxAmount
      ? formatCurrency(invoice.taxAmount.toString())
      : null,
    total: formatCurrency(invoice.total.toString()),
    accessKey: invoice.accessKey,
    customMessage,
  });

  try {
    const [xmlBuffer, rideBuffer] = await Promise.all([
      getR2ObjectBuffer(invoice.xmlFile.objectKey),
      getR2ObjectBuffer(invoice.rideFile.objectKey),
    ]);
    const providerMessageId = await sendWithResend({
      to,
      cc,
      subject,
      html,
      attachments: [
        { filename: invoice.xmlFile.name, content: xmlBuffer },
        { filename: invoice.rideFile.name, content: rideBuffer },
      ],
    });

    await prisma.$transaction([
      prisma.emailDelivery.create({
        data: {
          invoiceId,
          to,
          cc,
          subject,
          body: customMessage ?? "",
          providerMessageId,
          sentAt: new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    await prisma.emailDelivery.create({
      data: {
        invoiceId,
        to,
        cc,
        subject,
        body: customMessage ?? "",
        status: "FAILED",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${invoiceId}`);
}

export async function createInvoiceWithKeys(formData: FormData) {
  await requireAdmin();
  const { receivableIds, ...data } = parseForm(invoiceSchema, formData);

  const xmlMeta = fileMetaFromForm(formData, "xml");
  const rideMeta = fileMetaFromForm(formData, "ride");

  const [xmlFile, rideFile] = await Promise.all([
    xmlMeta
      ? registerFileKey({
          ...xmlMeta,
          clientId: data.clientId,
          projectId: data.projectId,
        })
      : null,
    rideMeta
      ? registerFileKey({
          ...rideMeta,
          clientId: data.clientId,
          projectId: data.projectId,
        })
      : null,
  ]);

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        ...data,
        xmlFileId: xmlFile?.id ?? null,
        rideFileId: rideFile?.id ?? null,
      },
    });
    await syncInvoiceReceivables(tx, invoice.id, receivableIds);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

export async function updateInvoiceWithKeys(id: string, formData: FormData) {
  await requireAdmin();
  const { receivableIds, ...data } = parseForm(invoiceSchema, formData);

  const xmlMeta = fileMetaFromForm(formData, "xml");
  const rideMeta = fileMetaFromForm(formData, "ride");

  const [xmlFile, rideFile] = await Promise.all([
    xmlMeta
      ? registerFileKey({
          ...xmlMeta,
          clientId: data.clientId,
          projectId: data.projectId,
        })
      : null,
    rideMeta
      ? registerFileKey({
          ...rideMeta,
          clientId: data.clientId,
          projectId: data.projectId,
        })
      : null,
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        ...data,
        ...(xmlFile ? { xmlFileId: xmlFile.id } : {}),
        ...(rideFile ? { rideFileId: rideFile.id } : {}),
      },
    });
    await syncInvoiceReceivables(tx, id, receivableIds);
    await syncInvoicePaidStatus(tx, id);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${id}`);
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

export async function updateInvoiceState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateInvoice(id, formData));
}
