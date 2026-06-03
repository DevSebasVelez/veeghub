"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { compactId, slugify } from "@/lib/admin/slug";
import { uploadToR2, getR2ObjectBuffer } from "@/lib/storage/r2";
import { sendInvoiceEmail as sendWithResend } from "@/lib/email/resend";
import { buildInvoiceEmailHtml } from "@/lib/email/invoice-template";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import {
  clientSchema,
  credentialSchema,
  driveFileSchema,
  folderSchema,
  invoiceSchema,
  formErrorMessage,
  parseForm,
  paymentSchema,
  paymentUpdateSchema,
  projectSchema,
  receivableSchema,
  taskSchema,
} from "@/lib/admin/schemas";
import type {
  CredentialKind,
  ReceivableStatus,
} from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";

// Recomputes an invoice's status from the payment state of ALL its receivables.
// An invoice is PAID only when every linked hito is fully paid; if that stops
// being true (payment edited/deleted) it reverts to SENT/READY_TO_SEND.
async function syncInvoicePaidStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string | null | undefined,
) {
  if (!invoiceId) return;
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      emailLogs: { select: { id: true }, take: 1 },
    },
  });
  if (!invoice || invoice.status === "CANCELLED") return;

  const hitos = await tx.receivable.findMany({
    where: { invoiceId },
    select: { amount: true, paidAmount: true },
  });
  const allPaid =
    hitos.length > 0 &&
    hitos.every((h) => Number(h.paidAmount) >= Number(h.amount));

  if (allPaid && invoice.status !== "PAID") {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    });
  } else if (!allPaid && invoice.status === "PAID") {
    const wasSent = invoice.emailLogs.length > 0;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: wasSent ? "SENT" : "READY_TO_SEND", paidAt: null },
    });
  }
}

// Reconciles the set of receivables (hitos) covered by an invoice: links the
// new set, marks PLANNED ones as INVOICED, and unlinks dropped ones (reverting
// the ones we had marked INVOICED back to PLANNED).
async function syncInvoiceReceivables(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  receivableIds: string[],
) {
  // Unlink hitos no longer covered by this invoice.
  await tx.receivable.updateMany({
    where: { invoiceId, id: { notIn: receivableIds }, status: "INVOICED" },
    data: { status: "PLANNED" },
  });
  await tx.receivable.updateMany({
    where: { invoiceId, id: { notIn: receivableIds } },
    data: { invoiceId: null },
  });

  if (receivableIds.length) {
    // Link the selected hitos and flag the untouched (PLANNED) ones as INVOICED.
    await tx.receivable.updateMany({
      where: { id: { in: receivableIds } },
      data: { invoiceId },
    });
    await tx.receivable.updateMany({
      where: { id: { in: receivableIds }, status: "PLANNED" },
      data: { status: "INVOICED" },
    });
  }
}

export type AdminFormState = {
  ok?: boolean;
  error?: string;
};

async function actionState(
  operation: () => Promise<void>,
): Promise<AdminFormState> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formErrorMessage(error) };
  }
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);

  if (!value) {
    throw new Error(`El campo ${key} es requerido.`);
  }

  return value;
}

function optionalId(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === "none" ? null : value;
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uploadFileRecord({
  file,
  folderId,
  clientId,
  projectId,
  prefix,
}: {
  file: File;
  folderId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  prefix: string;
}) {
  if (!file.size) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const objectKey = `${prefix}/${Date.now()}-${compactId()}-${safeFileName(file.name)}`;

  await uploadToR2({
    key: objectKey,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  return prisma.driveFile.create({
    data: {
      name: file.name,
      objectKey,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      folderId,
      clientId,
      projectId,
    },
  });
}

export async function createClient(formData: FormData) {
  await requireAdmin();
  const data = parseForm(clientSchema, formData);

  await prisma.client.create({
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function updateClient(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(clientSchema, formData);

  await prisma.client.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
}

export async function createProject(formData: FormData) {
  await requireAdmin();
  const data = parseForm(projectSchema, formData);

  const baseSlug = slugify(data.name) || compactId();
  const slug = `${baseSlug}-${compactId()}`;

  await prisma.project.create({
    data: {
      ...data,
      slug,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
}

export async function updateProject(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(projectSchema, formData);

  await prisma.project.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
}

export async function createTask(formData: FormData) {
  await requireAdmin();
  const data = parseForm(taskSchema, formData);

  await prisma.task.create({
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
}

export async function updateTask(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(taskSchema, formData);

  await prisma.task.update({
    where: { id },
    data: {
      ...data,
      completedAt: data.status === "DONE" ? new Date() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
}

export async function createReceivable(formData: FormData) {
  await requireAdmin();
  const data = parseForm(receivableSchema, formData);

  await prisma.receivable.create({
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function updateReceivable(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(receivableSchema, formData);

  await prisma.receivable.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
}

export async function recordPayment(formData: FormData) {
  await requireAdmin();
  const data = parseForm(paymentSchema, formData);

  await prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: data.receivableId },
      select: { amount: true, paidAmount: true, invoiceId: true },
    });
    const paidAmount = Number(receivable.paidAmount) + data.amount;
    const status = (
      paidAmount >= Number(receivable.amount) ? "PAID" : "PARTIALLY_PAID"
    ) as ReceivableStatus;

    await tx.payment.create({
      data: { ...data, paidAt: data.paidAt ?? new Date() },
    });

    await tx.receivable.update({
      where: { id: data.receivableId },
      data: { paidAmount, status },
    });

    // Sync the linked invoice: PAID only when ALL its hitos are fully paid.
    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

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
  revalidatePath(`/admin/clientes/${data.clientId}`);
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

export async function createFolder(formData: FormData) {
  await requireAdmin();
  const data = parseForm(folderSchema, formData);

  await prisma.driveFolder.create({
    data,
  });

  revalidatePath("/admin/drive");
}

export async function updateFolder(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(folderSchema, formData);

  await prisma.driveFolder.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/drive");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
}

export async function uploadDriveFile(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File | null;

  if (!file || !file.size) {
    throw new Error("Selecciona un archivo para subir.");
  }

  await uploadFileRecord({
    file,
    folderId: optionalId(formData, "folderId"),
    clientId: optionalId(formData, "clientId"),
    projectId: optionalId(formData, "projectId"),
    prefix: "drive",
  });

  revalidatePath("/admin/drive");
}

export async function createCredential(formData: FormData) {
  await requireAdmin();
  const data = parseForm(credentialSchema, formData);

  const encrypted = data.secret ? encryptSecret(data.secret) : {};

  await prisma.credential.create({
    data: {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      kind: data.kind as CredentialKind,
      url: data.url,
      username: data.username,
      accessMethod: data.accessMethod,
      notes: data.notes,
      ...encrypted,
    },
  });

  revalidatePath("/admin/credenciales");
}

export async function updateCredential(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(credentialSchema, formData);
  const encrypted = data.secret ? encryptSecret(data.secret) : {};

  await prisma.credential.update({
    where: { id },
    data: {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      kind: data.kind as CredentialKind,
      url: data.url,
      username: data.username,
      accessMethod: data.accessMethod,
      notes: data.notes,
      ...encrypted,
    },
  });

  revalidatePath("/admin/credenciales");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
}

export async function revealCredential(id: string) {
  await requireAdmin();

  const credential = await prisma.credential.update({
    where: { id },
    data: { lastViewedAt: new Date() },
  });

  if (
    !credential.encryptedSecret ||
    !credential.secretIv ||
    !credential.secretTag
  ) {
    return credential.accessMethod ?? "Sin secreto guardado";
  }

  return decryptSecret({
    encryptedSecret: credential.encryptedSecret,
    secretIv: credential.secretIv,
    secretTag: credential.secretTag,
  });
}

// ── Invoice with pre-uploaded R2 keys ─────────────────────────────────────

function fileMetaFromForm(
  formData: FormData,
  prefix: string,
): { objectKey: string; name: string; mimeType: string; size: number } | null {
  const objectKey = text(formData, `${prefix}ObjectKey`);
  const name = text(formData, `${prefix}Name`);
  const mimeType = text(formData, `${prefix}MimeType`);
  const sizeRaw = text(formData, `${prefix}Size`);
  if (!objectKey || !name || !mimeType || !sizeRaw) return null;
  const size = parseInt(sizeRaw, 10);
  if (!Number.isFinite(size) || size <= 0) return null;
  return { objectKey, name, mimeType, size };
}

async function registerFileKey({
  objectKey,
  name,
  mimeType,
  size,
  clientId,
  projectId,
}: {
  objectKey: string;
  name: string;
  mimeType: string;
  size: number;
  clientId: string | null;
  projectId: string | null;
}) {
  return prisma.driveFile.create({
    data: { name, objectKey, mimeType, size, clientId, projectId },
  });
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

  revalidatePath("/admin/facturas");
  revalidatePath(`/admin/facturas/${id}`);
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

// ── Comments ───────────────────────────────────────────────────────────────

export async function createComment(formData: FormData) {
  await requireAdmin();
  const body = requiredText(formData, "body");
  const clientId = optionalId(formData, "clientId");
  const projectId = optionalId(formData, "projectId");

  await prisma.comment.create({ data: { body, clientId, projectId } });

  if (clientId) revalidatePath(`/admin/clientes/${clientId}`);
  if (projectId) revalidatePath(`/admin/proyectos/${projectId}`);
}

export async function deleteComment(id: string) {
  await requireAdmin();
  const comment = await prisma.comment.delete({ where: { id } });

  if (comment.clientId) revalidatePath(`/admin/clientes/${comment.clientId}`);
  if (comment.projectId)
    revalidatePath(`/admin/proyectos/${comment.projectId}`);
}

export async function downloadDriveFile(formData: FormData) {
  await requireAdmin();
  redirect(`/admin/drive/download/${requiredText(formData, "fileId")}`);
}

export async function updateDriveFile(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(driveFileSchema, formData);

  await prisma.driveFile.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/drive");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
}

export async function createProjectState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createProject(formData));
}

export async function updateProjectState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateProject(id, formData));
}

export async function createTaskState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createTask(formData));
}

export async function updateTaskState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateTask(id, formData));
}

export async function updateClientState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateClient(id, formData));
}

export async function createReceivableState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createReceivable(formData));
}

export async function updateReceivableState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateReceivable(id, formData));
}

export async function createCredentialState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createCredential(formData));
}

export async function updateCredentialState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateCredential(id, formData));
}

export async function updateInvoiceState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateInvoice(id, formData));
}

export async function updateFolderState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateFolder(id, formData));
}

export async function createFolderState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createFolder(formData));
}

export async function updateDriveFileState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateDriveFile(id, formData));
}

export async function recordPaymentState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => recordPayment(formData));
}

export async function updateReceivableStatus(id: string, status: string) {
  await requireAdmin();

  await prisma.receivable.update({
    where: { id },
    data: { status: status as ReceivableStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function deletePayment(id: string) {
  await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

    const remaining = await tx.payment.aggregate({
      where: { receivableId: payment.receivableId, id: { not: id } },
      _sum: { amount: true },
    });

    const newPaidAmount = Number(remaining._sum.amount ?? 0);
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: payment.receivableId },
      select: { amount: true, status: true, invoiceId: true },
    });
    const receivableAmount = Number(receivable.amount);

    let newStatus: ReceivableStatus;
    if (newPaidAmount >= receivableAmount) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID";
    } else if (
      receivable.status === "PAID" ||
      receivable.status === "PARTIALLY_PAID"
    ) {
      newStatus = receivable.invoiceId ? "INVOICED" : "PLANNED";
    } else {
      newStatus = receivable.status;
    }

    await tx.payment.delete({ where: { id } });
    await tx.receivable.update({
      where: { id: payment.receivableId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    // Sync the linked invoice back if its hitos are no longer all paid.
    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function updatePayment(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(paymentUpdateSchema, formData);

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });

    await tx.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        paidAt: data.paidAt ?? payment.paidAt,
        method: data.method ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      },
    });

    const aggregate = await tx.payment.aggregate({
      where: { receivableId: payment.receivableId },
      _sum: { amount: true },
    });

    const newPaidAmount = Number(aggregate._sum.amount ?? 0);
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: payment.receivableId },
      select: { amount: true, invoiceId: true },
    });

    let newStatus: ReceivableStatus;
    if (newPaidAmount >= Number(receivable.amount)) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID";
    } else {
      newStatus = receivable.invoiceId ? "INVOICED" : "PLANNED";
    }

    await tx.receivable.update({
      where: { id: payment.receivableId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });

    // Sync the linked invoice: PAID only when ALL its hitos are fully paid.
    await syncInvoicePaidStatus(tx, receivable.invoiceId);
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function toggleTaskStatus(id: string, done: boolean) {
  await requireAdmin();

  await prisma.task.update({
    where: { id },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/proyectos");
}

export async function renameTask(id: string, title: string) {
  await requireAdmin();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("El título no puede estar vacío");

  const task = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true },
  });

  await prisma.task.update({
    where: { id },
    data: { title: trimmed },
  });

  revalidatePath("/admin/tareas");
  if (task?.projectId) revalidatePath(`/admin/proyectos/${task.projectId}`);
}

export async function deleteFolder(id: string) {
  await requireAdmin();
  await prisma.driveFolder.delete({ where: { id } });
  revalidatePath("/admin/drive");
  revalidatePath("/admin");
}

export async function deleteDriveFile(id: string) {
  await requireAdmin();
  await prisma.driveFile.delete({ where: { id } });
  revalidatePath("/admin/drive");
  revalidatePath("/admin");
}

export async function registerDriveFile(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const objectKey = String(formData.get("objectKey") ?? "").trim();
  const mimeType =
    String(formData.get("mimeType") ?? "").trim() || "application/octet-stream";
  const size = parseInt(String(formData.get("size") ?? "0"), 10);
  const folderId = optionalId(formData, "folderId");
  const clientId = optionalId(formData, "clientId");
  const projectId = optionalId(formData, "projectId");

  if (!name || !objectKey) {
    throw new Error("Datos de archivo incompletos.");
  }

  await prisma.driveFile.create({
    data: { name, objectKey, mimeType, size, folderId, clientId, projectId },
  });

  revalidatePath("/admin/drive");
}
