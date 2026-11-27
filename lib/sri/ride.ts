import { type AccessKeyParts, findAccessKey, parseAccessKey } from "@/lib/sri/access-key";
import { toCents } from "@/lib/admin/finance/money";

// Reader for the text of a RIDE (the PDF of an SRI invoice). The clave de
// acceso is certain (49 digits with a valid DV); everything else comes from
// labels and is a best effort the person confirms. PDF text extractors put a
// value before or after its label depending on the generator ("1.00VALOR
// TOTAL" or "VALOR TOTAL 1.00"), so both sides are accepted on the same line.

export type SriRide = {
  accessKey: string;
  key: AccessKeyParts;
  /** "001-001-000000001" */
  number: string;
  /** "dd/mm/aaaa hh:mm:ss" as printed, when found. */
  authorizedAt: string | null;
  buyer: { id: string | null; name: string | null };
  subtotalCents: number | null;
  vatCents: number | null;
  vatRate: number | null;
  totalCents: number | null;
  warnings: string[];
};

const AMOUNT = String.raw`\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}`;

/** "1,234.56" / "1.234,56" / "1234.56" → cents. */
function amountCents(raw: string) {
  const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const whole = raw.slice(0, lastSep).replace(/[.,]/g, "");
  return toCents(`${whole}.${raw.slice(lastSep + 1)}`);
}

/** Amount on the same line as a label, before or after it. */
function labeled(lines: string[], label: RegExp) {
  for (const line of lines) {
    const match = new RegExp(
      String.raw`^\s*(?:(${AMOUNT})\s*)?${label.source}\s*:?\s*(?:(${AMOUNT}))?\s*$`,
      "i",
    ).exec(line);
    if (match && (match[1] || match[2])) return amountCents(match[1] ?? match[2]);
  }
  return null;
}

export function parseRideText(text: string): SriRide | null {
  const accessKey = findAccessKey(text);
  if (!accessKey) return null;
  const key = parseAccessKey(accessKey)!;
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const serie = `${key.establishment}-${key.emissionPoint}-${key.sequential}`;
  const printedNumber = /(\d{3}-\d{3}-\d{9})/.exec(text)?.[1] ?? null;
  if (printedNumber && printedNumber !== serie) {
    warnings.push(`El número impreso (${printedNumber}) no coincide con la clave de acceso (${serie}).`);
  }

  const authorizedAt = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/.exec(text)?.[1] ?? null;

  // Buyer: a standalone 10/13-digit line that is not the emitter's RUC.
  let buyerId: string | null = null;
  let buyerName: string | null = null;
  const inline = /Identificaci[oó]n\s*:?\s*(\d{10}(?:\d{3})?)\b/i.exec(text);
  if (inline && inline[1] !== key.ruc) buyerId = inline[1];
  const idIndex = lines.findIndex((l) => {
    if (!/^\d{10}(\d{3})?$/.test(l) || l === key.ruc) return false;
    return buyerId ? l === buyerId : true;
  });
  if (idIndex >= 0) {
    buyerId ??= lines[idIndex];
    const previous = lines[idIndex - 1];
    if (previous && /^[A-ZÁÉÍÓÚÑÜ0-9 .,&'-]{3,}$/.test(previous) && !/^(FECHA|IDENTIFICACI)/i.test(previous)) {
      buyerName = previous;
    }
  }
  const nameInline = /Raz[oó]n Social \/ Nombres y Apellidos:\s*([^\n]+)/i.exec(text)?.[1]?.trim();
  if (nameInline && /[A-ZÁÉÍÓÚÑ]{3}/.test(nameInline)) buyerName = nameInline;

  const subtotalCents = labeled(lines, /SUBTOTAL SIN IMPUESTOS/);
  const totalCents = labeled(lines, /VALOR TOTAL/);

  // IVA line ("IVA 15% 15.00" or "15.00IVA 15%") and the rate with a base.
  let vatCents: number | null = null;
  let vatRate: number | null = null;
  for (const line of lines) {
    const m = new RegExp(String.raw`^\s*(?:(${AMOUNT})\s*)?IVA\s+(\d+(?:[.,]\d+)?)\s*%\s*(?:(${AMOUNT}))?\s*$`, "i").exec(line);
    if (m && (m[1] || m[3])) {
      vatCents = (vatCents ?? 0) + amountCents(m[1] ?? m[3]);
      vatRate = Number(m[2].replace(",", "."));
    }
  }
  if (vatRate == null) {
    for (const line of lines) {
      const m = new RegExp(String.raw`^\s*(?:(${AMOUNT})\s*)?SUBTOTAL\s+(\d+(?:[.,]\d+)?)\s*%\s*(?:(${AMOUNT}))?\s*$`, "i").exec(line);
      if (m && amountCents(m[1] ?? m[3] ?? "0.00") > 0) {
        vatRate = Number(m[2].replace(",", "."));
        if (vatRate === 0) vatCents = 0;
        break;
      }
    }
  }

  if (subtotalCents != null && totalCents != null && vatCents != null && subtotalCents + vatCents > totalCents) {
    warnings.push("Los montos leídos del RIDE no cuadran: revísalos.");
  }
  if (totalCents == null) warnings.push("No se encontró el valor total en el RIDE: complétalo a mano.");
  if (key.environment === "PRUEBAS") {
    warnings.push("La factura es del ambiente de PRUEBAS del SRI: no tiene validez tributaria.");
  }

  return {
    accessKey,
    key,
    number: serie,
    authorizedAt,
    buyer: { id: buyerId, name: buyerName },
    subtotalCents,
    vatCents,
    vatRate,
    totalCents,
    warnings,
  };
}
