"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { assertNotIssued } from "@/lib/sri/issue";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult, actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { fromCents, toCents } from "@/lib/admin/finance/money";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { syncInvoicePaidStatus } from "@/lib/admin/services/invoice-sync";
import { getR2ObjectBuffer } from "@/lib/storage/r2";
import { parseSriInvoiceXml } from "@/lib/sri/invoice-xml";
import { parseRideText } from "@/lib/sri/ride";

// Compares a saved invoice with its own SRI documents and fixes what differs.
// The XML is the source of truth; without it, the RIDE gives the clave,
// number and date for sure and its amounts as a best effort.

const FIELDS = ["invoiceNumber", "accessKey", "issueDate", "subtotal", "taxAmount", "vatRate", "total"] as const;
type Field = (typeof FIELDS)[number];

const LABELS: Record<Field, string> = {
  invoiceNumber: "Número",
  accessKey: "Clave de acceso",
  issueDate: "Fecha de emisión",
  subtotal: "Subtotal",
  taxAmount: "IVA",
  vatRate: "Tarifa IVA",
  total: "Total",
};

export type InvoiceDiff = {
  field: Field;
  label: string;
  /** Display values. */
  saved: string;
  document: string;
  /** Raw value to store. */
  value: string;
};

export type InvoiceReconciliation = {
  source: "XML" | "RIDE";
  fileName: string;
  diffs: InvoiceDiff[];
  warnings: string[];
};

type DocValues = Partial<Record<Field, string | null>>;

async function readDocuments(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { xmlFile: true, rideFile: true },
  });

  if (invoice.xmlFile) {
    const xml = (await getR2ObjectBuffer(invoice.xmlFile.objectKey)).toString("utf8");
    const inv = parseSriInvoiceXml(xml);
    const values: DocValues = {
      invoiceNumber: inv.number,
      accessKey: inv.accessKey,
      issueDate: inv.issueDay,
      subtotal: fromCents(inv.subtotalCents),
      taxAmount: fromCents(inv.vatCents),
      vatRate: inv.vatRate == null ? null : String(inv.vatRate),
      total: fromCents(inv.totalCents),
    };
    return { invoice, source: "XML" as const, fileName: invoice.xmlFile.name, values, warnings: inv.warnings };
  }

  if (invoice.rideFile) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buffer = await getR2ObjectBuffer(invoice.rideFile.objectKey);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const ride = parseRideText((await extractText(pdf, { mergePages: true })).text);
    if (!ride) throw new Error("No se encontró una clave de acceso válida en el RIDE.");
    const values: DocValues = {
      invoiceNumber: ride.number,
      accessKey: ride.accessKey,
      issueDate: ride.key.issueDay,
      subtotal: ride.subtotalCents == null ? null : fromCents(ride.subtotalCents),
      taxAmount: ride.vatCents == null ? null : fromCents(ride.vatCents),
      vatRate: ride.vatRate == null ? null : String(ride.vatRate),
      total: ride.totalCents == null ? null : fromCents(ride.totalCents),
    };
    return {
      invoice,
      source: "RIDE" as const,
      fileName: invoice.rideFile.name,
      values,
      warnings: [...ride.warnings, "Sin XML: los montos salen del texto del RIDE."],
    };
  }

  throw new Error("La factura no tiene XML ni RIDE para comparar.");
}

function savedValue(
  invoice: Awaited<ReturnType<typeof readDocuments>>["invoice"],
  field: Field,
): string | null {
  const v = invoice[field];
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v.toString();
}

function same(field: Field, a: string | null, b: string) {
  if (a == null) return false;
  if (field === "subtotal" || field === "taxAmount" || field === "total" || field === "vatRate") {
    return toCents(a) === toCents(b);
  }
  return a === b;
}

function display(field: Field, value: string | null) {
  if (value == null || value === "") return "—";
  if (field === "issueDate") return formatDateOnly(new Date(`${value}T00:00:00.000Z`));
  if (field === "subtotal" || field === "taxAmount" || field === "total") return formatCurrency(value);
  if (field === "vatRate") return `${Number(value)} %`;
  return value;
}

export async function compareInvoiceWithDocuments(invoiceId: string) {
  await requireAdmin();

  return actionResult<InvoiceReconciliation>(async () => {
    const { invoice, source, fileName, values, warnings } = await readDocuments(invoiceId);
    const diffs: InvoiceDiff[] = [];
    for (const field of FIELDS) {
      const doc = values[field];
      if (doc == null) continue;
      const saved = savedValue(invoice, field);
      if (same(field, saved, doc)) continue;
      diffs.push({ field, label: LABELS[field], saved: display(field, saved), document: display(field, doc), value: doc });
    }
    return { source, fileName, diffs, warnings };
  });
}

/**
 * Applies the chosen corrections, re-reading the document on the server so
 * only values that really come from it are stored.
 */
export async function applyDocumentCorrections(invoiceId: string, fields: string[]): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await assertNotIssued(invoiceId);
    const chosen = FIELDS.filter((f) => fields.includes(f));
    if (!chosen.length) throw new Error("Elige al menos un dato para corregir.");

    const { invoice, values } = await readDocuments(invoiceId);
    const data: Record<string, unknown> = {};
    for (const field of chosen) {
      const value = values[field];
      if (value == null) continue;
      data[field] = field === "issueDate" ? new Date(`${value}T00:00:00.000Z`) : value;
    }

    if (data.accessKey) {
      const other = await prisma.invoice.findFirst({
        where: { accessKey: data.accessKey as string, id: { not: invoiceId } },
        select: { invoiceNumber: true },
      });
      if (other) throw new Error(`Esa clave ya está en otra factura${other.invoiceNumber ? ` (${other.invoiceNumber})` : ""}.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoiceId }, data });
      await syncInvoicePaidStatus(tx, invoiceId);
    });

    revalidatePath("/admin/facturas");
    revalidatePath(`/admin/facturas/${invoiceId}`);
    revalidatePath(`/admin/clientes/${invoice.clientId}`);
    if (invoice.projectId) revalidatePath(`/admin/proyectos/${invoice.projectId}`);
  });
}
