"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { compactId, slugify } from "@/lib/admin/slug";
import { uploadToR2, getR2ObjectBuffer } from "@/lib/storage/r2";
import { sendInvoiceEmail as sendWithResend } from "@/lib/email/resend";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import type {
  CredentialKind,
  ProjectStatus,
  ReceivableStatus,
  TaskPriority,
  TaskStatus,
} from "@/app/generated/prisma/enums";

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

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(value) : null;
}

function decimalValue(formData: FormData, key: string) {
  return requiredText(formData, key).replace(",", ".");
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

  await prisma.client.create({
    data: {
      name: requiredText(formData, "name"),
      legalName: text(formData, "legalName"),
      taxId: text(formData, "taxId"),
      email: text(formData, "email"),
      billingEmail: text(formData, "billingEmail"),
      phone: text(formData, "phone"),
      website: text(formData, "website"),
      address: text(formData, "address"),
      notes: text(formData, "notes"),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function createProject(formData: FormData) {
  await requireAdmin();

  const name = requiredText(formData, "name");
  const baseSlug = slugify(name) || compactId();
  const slug = `${baseSlug}-${compactId()}`;

  await prisma.project.create({
    data: {
      name,
      slug,
      clientId: optionalId(formData, "clientId"),
      status: requiredText(formData, "status") as ProjectStatus,
      description: text(formData, "description"),
      stack: text(formData, "stack"),
      repositoryUrl: text(formData, "repositoryUrl"),
      productionUrl: text(formData, "productionUrl"),
      budget: text(formData, "budget")?.replace(",", "."),
      startDate: dateValue(formData, "startDate"),
      dueDate: dateValue(formData, "dueDate"),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
}

export async function createTask(formData: FormData) {
  await requireAdmin();

  await prisma.task.create({
    data: {
      projectId: requiredText(formData, "projectId"),
      title: requiredText(formData, "title"),
      description: text(formData, "description"),
      status: requiredText(formData, "status") as TaskStatus,
      priority: requiredText(formData, "priority") as TaskPriority,
      dueDate: dateValue(formData, "dueDate"),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/proyectos");
}

export async function createReceivable(formData: FormData) {
  await requireAdmin();

  await prisma.receivable.create({
    data: {
      clientId: requiredText(formData, "clientId"),
      projectId: optionalId(formData, "projectId"),
      title: requiredText(formData, "title"),
      description: text(formData, "description"),
      amount: decimalValue(formData, "amount"),
      dueDate: dateValue(formData, "dueDate"),
      status: requiredText(formData, "status") as ReceivableStatus,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function recordPayment(formData: FormData) {
  await requireAdmin();

  const receivableId = requiredText(formData, "receivableId");
  const amount = Number(decimalValue(formData, "amount"));

  await prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUniqueOrThrow({
      where: { id: receivableId },
    });
    const paidAmount = Number(receivable.paidAmount) + amount;
    const status = (
      paidAmount >= Number(receivable.amount) ? "PAID" : "PARTIALLY_PAID"
    ) as ReceivableStatus;

    await tx.payment.create({
      data: {
        receivableId,
        amount,
        paidAt: dateValue(formData, "paidAt") ?? new Date(),
        method: text(formData, "method"),
        reference: text(formData, "reference"),
        notes: text(formData, "notes"),
      },
    });

    await tx.receivable.update({
      where: { id: receivableId },
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

  const clientId = requiredText(formData, "clientId");
  const projectId = optionalId(formData, "projectId");
  const receivableId = optionalId(formData, "receivableId");
  const xml = formData.get("xml") as File | null;
  const ride = formData.get("ride") as File | null;

  const xmlFile = xml
    ? await uploadFileRecord({
        file: xml,
        clientId,
        projectId,
        prefix: "invoices/xml",
      })
    : null;
  const rideFile = ride
    ? await uploadFileRecord({
        file: ride,
        clientId,
        projectId,
        prefix: "invoices/ride",
      })
    : null;

  await prisma.invoice.create({
    data: {
      clientId,
      projectId,
      receivableId,
      invoiceNumber: text(formData, "invoiceNumber"),
      accessKey: text(formData, "accessKey"),
      subtotal: text(formData, "subtotal")?.replace(",", "."),
      taxAmount: text(formData, "taxAmount")?.replace(",", "."),
      total: decimalValue(formData, "total"),
      issueDate: dateValue(formData, "issueDate"),
      xmlFileId: xmlFile?.id,
      rideFileId: rideFile?.id,
    },
  });

  if (receivableId) {
    await prisma.receivable.update({
      where: { id: receivableId },
      data: { status: "INVOICED" },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/facturas");
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

  await prisma.driveFolder.create({
    data: {
      name: requiredText(formData, "name"),
      parentId: optionalId(formData, "parentId"),
      clientId: optionalId(formData, "clientId"),
      projectId: optionalId(formData, "projectId"),
    },
  });

  revalidatePath("/admin/drive");
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

  const secret = requiredText(formData, "secret");
  const encrypted = encryptSecret(secret);

  await prisma.credential.create({
    data: {
      clientId: optionalId(formData, "clientId"),
      projectId: optionalId(formData, "projectId"),
      title: requiredText(formData, "title"),
      kind: requiredText(formData, "kind") as CredentialKind,
      url: text(formData, "url"),
      username: text(formData, "username"),
      notes: text(formData, "notes"),
      ...encrypted,
    },
  });

  revalidatePath("/admin/credenciales");
}

export async function revealCredential(id: string) {
  await requireAdmin();

  const credential = await prisma.credential.update({
    where: { id },
    data: { lastViewedAt: new Date() },
  });

  return decryptSecret(credential);
}

export async function downloadDriveFile(formData: FormData) {
  await requireAdmin();
  redirect(`/admin/drive/download/${requiredText(formData, "fileId")}`);
}
