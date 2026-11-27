import { lineBaseCents } from "@/lib/sri/build-invoice";
import type { SriEnvironment } from "@/lib/sri/access-key";
import { parseSriInvoiceXml } from "@/lib/sri/invoice-xml";

// VeegHub's own review of a factura before signing and before each send.
//
// Needed because the SRI test environment (celcer) does not check the
// arithmetic: on 2026-11-27 it authorized a USD 2.00 total over a USD 1.00
// base and a line of 1 × 5.00 declared as 1.00. Production would answer 52
// (or worse, authorize a wrong invoice), so nothing leaves without this.

/** Problems found, in Spanish; empty when the document is consistent. */
export function selfCheckInvoiceXml(
  xml: string,
  expected: { accessKey: string; environment: SriEnvironment },
): string[] {
  let invoice;
  try {
    invoice = parseSriInvoiceXml(xml);
  } catch (error) {
    return [`El XML no se puede leer: ${error instanceof Error ? error.message : String(error)}`];
  }

  const problems = invoice.warnings.filter((w) => !w.includes("ambiente de PRUEBAS"));

  if (invoice.accessKey !== expected.accessKey) problems.push("La clave del XML no es la de la factura.");
  if (invoice.environment !== expected.environment) problems.push("El ambiente del XML no es el de la factura.");

  invoice.items.forEach((item, index) => {
    let base: number;
    try {
      base = lineBaseCents(item.quantity, item.unitPrice, item.discountCents);
    } catch {
      problems.push(`Ítem ${index + 1}: cantidad o precio con formato inválido.`);
      return;
    }
    if (base !== item.totalCents) {
      problems.push(`Ítem ${index + 1}: cantidad × precio − descuento no da el total de la línea.`);
    }
  });

  return problems;
}
