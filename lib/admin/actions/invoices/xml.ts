"use server";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionResult } from "@/lib/admin/actions/shared";
import { fromCents } from "@/lib/admin/finance/money";
import { COMPANY } from "@/lib/company";
import { SriXmlError, parseSriInvoiceXml } from "@/lib/sri/invoice-xml";

export type InvoiceXmlAnalysis = {
  number: string;
  accessKey: string;
  /** "yyyy-MM-dd" */
  issueDay: string;
  environment: "PRUEBAS" | "PRODUCCION";
  subtotal: string;
  taxAmount: string;
  vatRate: string | null;
  total: string;
  buyer: { id: string | null; name: string | null };
  items: Array<{ description: string; total: string }>;
  rimpeLegend: string | null;
  /** Client whose RUC/cédula matches the buyer, if any. */
  client: { id: string; name: string } | null;
  /** Another invoice already registered with this clave. */
  duplicate: { id: string; number: string | null } | null;
  warnings: string[];
};

const MAX_XML_BYTES = 512 * 1024;

/**
 * Reads an SRI invoice XML picked in the invoice dialog and returns what to
 * prefill, plus everything the person should double-check before saving.
 * Nothing is stored here.
 */
export async function analyzeInvoiceXml(xml: string, currentInvoiceId?: string | null) {
  await requireAdmin();

  return actionResult<InvoiceXmlAnalysis>(async () => {
    if (xml.length > MAX_XML_BYTES) throw new SriXmlError("El XML es demasiado grande.");

    const inv = parseSriInvoiceXml(xml);
    const warnings = [...inv.warnings];

    if (COMPANY.taxId && inv.emitter.ruc !== COMPANY.taxId) {
      warnings.unshift(
        `La factura fue emitida por ${inv.emitter.legalName} (RUC ${inv.emitter.ruc}), no por ${COMPANY.brand}.`,
      );
    }

    // RUC of a persona natural = cédula + "001": match either form.
    const buyerId = inv.buyer.id;
    const ids = buyerId ? [...new Set([buyerId, buyerId.slice(0, 10)])] : [];
    const [client, duplicate] = await Promise.all([
      ids.length
        ? prisma.client.findFirst({
            where: {
              OR: [{ taxId: { in: ids } }, ...ids.map((id) => ({ taxId: { startsWith: id } }))],
            },
            select: { id: true, name: true },
          })
        : null,
      prisma.invoice.findFirst({
        where: {
          accessKey: inv.accessKey,
          ...(currentInvoiceId ? { id: { not: currentInvoiceId } } : {}),
        },
        select: { id: true, invoiceNumber: true },
      }),
    ]);

    if (buyerId && !client) {
      warnings.push(
        `Ningún cliente tiene el RUC o cédula ${buyerId} (${inv.buyer.name ?? "comprador"}). Elige el cliente a mano o agrégale el RUC.`,
      );
    }

    return {
      number: inv.number,
      accessKey: inv.accessKey,
      issueDay: inv.issueDay,
      environment: inv.environment,
      subtotal: fromCents(inv.subtotalCents),
      taxAmount: fromCents(inv.vatCents),
      vatRate: inv.vatRate == null ? null : String(inv.vatRate),
      total: fromCents(inv.totalCents),
      buyer: { id: buyerId, name: inv.buyer.name },
      items: inv.items.map((i) => ({ description: i.description, total: fromCents(i.totalCents) })),
      rimpeLegend: inv.emitter.rimpeLegend,
      client,
      duplicate: duplicate ? { id: duplicate.id, number: duplicate.invoiceNumber } : null,
      warnings,
    };
  });
}
