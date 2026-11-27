import prisma from "@/lib/db/prisma";
import { compactId } from "@/lib/admin/slug";
import { syncInvoicePaidStatus, syncInvoiceReceivables } from "@/lib/admin/services/invoice-sync";
import { renderRide } from "@/lib/pdf/ride";
import { uploadToR2 } from "@/lib/storage/r2";

// What happens once the SRI authorizes an invoice issued from VeegHub:
//
// 1. The authorized XML (the SRI's <autorizacion>, which wraps the signed
//    factura) and the RIDE are stored as the invoice's files, so it can be
//    sent to the client and listed like any uploaded invoice.
// 2. The milestones its lines bill are linked to it, and its paid status is
//    synced as for any invoice.
//
// Idempotent: each step checks what is already done, so the cron can call it
// again after a failure (R2 down, for example).

async function storeFile(input: {
  name: string;
  body: Buffer;
  mimeType: string;
  prefix: string;
  clientId: string;
  projectId: string | null;
}) {
  const objectKey = `${input.prefix}/${Date.now()}-${compactId()}-${input.name}`;
  await uploadToR2({ key: objectKey, body: input.body, contentType: input.mimeType });
  return prisma.driveFile.create({
    data: {
      name: input.name,
      objectKey,
      mimeType: input.mimeType,
      size: input.body.length,
      clientId: input.clientId,
      projectId: input.projectId,
    },
    select: { id: true },
  });
}

/** Attaches the XML and RIDE and links the milestones. Throws on failure. */
export async function finalizeAuthorizedInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      id: true,
      source: true,
      sriStatus: true,
      sriXml: true,
      sriAuthorizedXml: true,
      authorizedAt: true,
      invoiceNumber: true,
      clientId: true,
      projectId: true,
      xmlFileId: true,
      rideFileId: true,
      items: { select: { receivableId: true } },
    },
  });
  if (invoice.source !== "ISSUED" || invoice.sriStatus !== "AUTHORIZED" || !invoice.sriXml) return;

  const base = `Factura-${invoice.invoiceNumber ?? invoice.id}`;

  if (!invoice.xmlFileId) {
    const xml = invoice.sriAuthorizedXml ?? invoice.sriXml;
    const file = await storeFile({
      name: `${base}.xml`,
      body: Buffer.from(xml, "utf8"),
      mimeType: "application/xml",
      prefix: "invoices/xml",
      clientId: invoice.clientId,
      projectId: invoice.projectId,
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { xmlFileId: file.id } });
  }

  if (!invoice.rideFileId) {
    const pdf = await renderRide(invoice.sriXml, {
      kind: "authorized",
      authorizedAt: invoice.authorizedAt ?? new Date(),
    });
    const file = await storeFile({
      name: `RIDE-${invoice.invoiceNumber ?? invoice.id}.pdf`,
      body: pdf,
      mimeType: "application/pdf",
      prefix: "invoices/ride",
      clientId: invoice.clientId,
      projectId: invoice.projectId,
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { rideFileId: file.id } });
  }

  const wanted = [...new Set(invoice.items.map((i) => i.receivableId).filter((id): id is string => Boolean(id)))];
  if (wanted.length) {
    await prisma.$transaction(async (tx) => {
      // Never take a milestone another invoice already covers.
      const free = await tx.receivable.findMany({
        where: { id: { in: wanted }, clientId: invoice.clientId, OR: [{ invoiceId: null }, { invoiceId: invoice.id }] },
        select: { id: true },
      });
      await syncInvoiceReceivables(
        tx,
        invoice.id,
        free.map((r) => r.id),
      );
      await syncInvoicePaidStatus(tx, invoice.id);
    });
  }
}
