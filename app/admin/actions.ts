"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { compactId, slugify } from "@/lib/admin/slug";
import { uploadToR2, getR2ObjectBuffer } from "@/lib/storage/r2";
import { sendInvoiceEmail as sendWithResend } from "@/lib/email/resend";
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
  projectSchema,
  receivableSchema,
  taskSchema,
} from "@/lib/admin/schemas";
import type {
  CredentialKind,
  ReceivableStatus,
} from "@/app/generated/prisma/enums";

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
    });
    const paidAmount = Number(receivable.paidAmount) + data.amount;
    const status = (
      paidAmount >= Number(receivable.amount) ? "PAID" : "PARTIALLY_PAID"
    ) as ReceivableStatus;

    await tx.payment.create({
      data: {
        ...data,
        paidAt: data.paidAt ?? new Date(),
      },
    });

    await tx.receivable.update({
      where: { id: data.receivableId },
      data: {
        paidAmount,
        status,
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function createInvoice(formData: FormData) {
  await requireAdmin();
  const data = parseForm(invoiceSchema, formData);

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

  await prisma.invoice.create({
    data: {
      ...data,
      xmlFileId: xmlFile?.id,
      rideFileId: rideFile?.id,
    },
  });

  if (data.receivableId) {
    await prisma.receivable.update({
      where: { id: data.receivableId },
      data: { status: "INVOICED" },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
}

export async function updateInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(invoiceSchema, formData);

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

  await prisma.invoice.update({
    where: { id },
    data: {
      ...data,
      ...(xmlFile ? { xmlFileId: xmlFile.id } : {}),
      ...(rideFile ? { rideFileId: rideFile.id } : {}),
    },
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
    `Factura ${invoice.invoiceNumber ?? ""} - Veeghub`.trim();
  const body =
    text(formData, "body") ??
    `Hola ${invoice.client.name}, adjunto el XML y RIDE de la factura emitida.`;

  try {
    const [xmlBuffer, rideBuffer] = await Promise.all([
      getR2ObjectBuffer(invoice.xmlFile.objectKey),
      getR2ObjectBuffer(invoice.rideFile.objectKey),
    ]);
    const providerMessageId = await sendWithResend({
      to,
      cc,
      subject,
      html: `<p>${body.replace(/\n/g, "<br />")}</p>`,
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
          body,
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
        body,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
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
      newStatus = "PLANNED";
    } else {
      newStatus = receivable.status;
    }

    await tx.payment.delete({ where: { id } });
    await tx.receivable.update({
      where: { id: payment.receivableId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    });
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
  revalidatePath("/admin/proyectos");
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
