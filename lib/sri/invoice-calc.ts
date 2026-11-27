import { percentOfCents } from "@/lib/admin/finance/money";

// The arithmetic of a factura, apart from the XML so the browser can run it:
// the «Emitir factura» screen shows live totals with this exact code, and
// buildInvoiceXml signs what it computes. No Node-only imports here.
//
// - Money is integer cents end to end. Quantity and unit price keep up to six
//   decimals (as the XSD allows) and are multiplied exactly with BigInt; the
//   line is then rounded once to the cent.
// - IVA per line is rounded on the line's base; IVA per rate in
//   totalConImpuestos is rounded on the summed base of that rate.

export class SriBuildError extends Error {}

/** Tabla 17: IVA codigoPorcentaje → rate %. 6 (no objeto) and 7 (exento) are 0 %. */
export const VAT_CODE_RATES: Record<string, number> = {
  "0": 0,
  "2": 12,
  "3": 14,
  "4": 15,
  "5": 5,
  "6": 0,
  "7": 0,
  "10": 13,
};

/** codigoPorcentaje for a plain rate (0 → "0", 15 → "4"...), or null if none. */
export function vatCodeForRate(rate: number) {
  const found = Object.entries(VAT_CODE_RATES).find(
    ([code, value]) => value === rate && code !== "6" && code !== "7",
  );
  return found ? found[0] : null;
}

/**
 * IVA choices a line may take under the rates the TaxProfile allows: each
 * rate, plus «no objeto» and «exento» when 0 % is allowed.
 */
export function vatOptions(allowedRates: number[]) {
  const options: Array<{ code: string; label: string; rate: number }> = [];
  for (const rate of [...allowedRates].sort((a, b) => b - a)) {
    const code = vatCodeForRate(rate);
    if (code) options.push({ code, label: `${rate} %`, rate });
  }
  if (allowedRates.includes(0)) {
    options.push({ code: "6", label: "No objeto de IVA", rate: 0 });
    options.push({ code: "7", label: "Exento de IVA", rate: 0 });
  }
  return options;
}

/** Tabla 6: tipoIdentificacionComprador. */
export const BUYER_ID_TYPES = {
  RUC: "04",
  CEDULA: "05",
  PASAPORTE: "06",
  CONSUMIDOR_FINAL: "07",
  EXTERIOR: "08",
} as const;
export type BuyerIdType = (typeof BUYER_ID_TYPES)[keyof typeof BUYER_ID_TYPES];

export const BUYER_ID_LABELS: Record<BuyerIdType, string> = {
  "04": "RUC",
  "05": "Cédula",
  "06": "Pasaporte",
  "07": "Consumidor final",
  "08": "Identificación del exterior",
};

/** Tabla 24: formaPago. */
export const PAYMENT_METHODS = {
  "01": "Sin utilización del sistema financiero",
  "15": "Compensación de deudas",
  "16": "Tarjeta de débito",
  "17": "Dinero electrónico",
  "18": "Tarjeta prepago",
  "19": "Tarjeta de crédito",
  "20": "Otros con utilización del sistema financiero",
  "21": "Endoso de títulos",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const CONSUMER_ID = "9999999999999";
/** A consumidor final invoice may not exceed USD 50 (Reglamento de comprobantes, art. 8). */
export const CONSUMER_MAX_CENTS = 5000;

export type BuildInvoiceItem = {
  code?: string | null;
  description: string;
  /** Decimal string, up to 6 decimals ("1", "2.5"). */
  quantity: string;
  /** Decimal string, up to 6 decimals. */
  unitPrice: string;
  /** Money, up to 2 decimals. Default 0. */
  discount?: string;
  /** Tabla 17 codigoPorcentaje. */
  vatCode: string;
};

export type BuiltInvoiceLine = {
  code: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountCents: number;
  baseCents: number;
  vatCode: string;
  vatRate: number;
  vatCents: number;
};

export type BuiltInvoiceTax = {
  vatCode: string;
  vatRate: number;
  baseCents: number;
  valueCents: number;
};

export type InvoiceTotals = {
  lines: BuiltInvoiceLine[];
  taxes: BuiltInvoiceTax[];
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
};

// ─── Numbers ──────────────────────────────────────────────────────────────

// BigInt() instead of literals: tsconfig targets ES2017.
const ZERO = BigInt(0);
const SCALE = BigInt(1_000_000);
const CENTS_PER_MILLIONTH = BigInt(10_000);
/** millionths × millionths are 10⁻¹² units; this many make a cent. */
const PICO_PER_CENT = BigInt(10_000_000_000);
const HALF_CENT = BigInt(5_000_000_000);
const SIX_DECIMALS = /^(\d+)(?:\.(\d{1,6}))?$/;
const TWO_DECIMALS = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "2.5" → 2_500_000n (millionths). */
function toMillionths(value: string, field: string) {
  const match = SIX_DECIMALS.exec(value.trim());
  if (!match) throw new SriBuildError(`${field} debe ser un número con hasta 6 decimales: «${value}».`);
  return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(6, "0"));
}

export function moneyToCents(value: string, field: string) {
  const match = TWO_DECIMALS.exec(value.trim());
  if (!match) throw new SriBuildError(`${field} debe ser un monto con hasta 2 decimales: «${value}».`);
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Millionths back to the shortest decimal: 1_000_000n → "1", 2_500_000n → "2.5". */
function formatMillionths(value: bigint) {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

/** Cents as the shortest decimal ("0", "1.5"), like the facturador's descuento. */
export function shortMoney(cents: number) {
  return formatMillionths(BigInt(cents) * CENTS_PER_MILLIONTH);
}

/**
 * Line base in cents: quantity × unit price (six decimals each, exact) rounded
 * once, minus the discount. The same rule the builder uses, for re-checking.
 */
export function lineBaseCents(quantity: string, unitPrice: string, discountCents: number) {
  const product = toMillionths(quantity, "La cantidad") * toMillionths(unitPrice, "El precio unitario");
  return Number((product + HALF_CENT) / PICO_PER_CENT) - discountCents;
}

function requireText(value: string | null | undefined, field: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) throw new SriBuildError(`Falta ${field}.`);
  if (text.length > max) throw new SriBuildError(`${field} supera ${max} caracteres.`);
  return value!;
}

// ─── Totals ───────────────────────────────────────────────────────────────

/**
 * Lines, totals per IVA code and invoice totals. Throws SriBuildError, in
 * Spanish and naming the item, on the first figure that does not hold.
 */
export function computeInvoiceTotals(items: BuildInvoiceItem[], allowedVatRates: number[]): InvoiceTotals {
  if (items.length === 0) throw new SriBuildError("La factura no tiene ítems.");

  const lines: BuiltInvoiceLine[] = items.map((item, index) => {
    const label = `Ítem ${index + 1}`;
    const quantity = toMillionths(item.quantity, `${label}: la cantidad`);
    const unitPrice = toMillionths(item.unitPrice, `${label}: el precio unitario`);
    if (quantity <= ZERO) throw new SriBuildError(`${label}: la cantidad debe ser mayor que cero.`);

    // Exact product, rounded half up to the cent once.
    const grossCents = Number((quantity * unitPrice + HALF_CENT) / PICO_PER_CENT);
    const discountCents = moneyToCents(item.discount ?? "0", `${label}: el descuento`);
    if (discountCents > grossCents) {
      throw new SriBuildError(`${label}: el descuento supera el valor del ítem.`);
    }

    const vatRate = VAT_CODE_RATES[item.vatCode];
    if (vatRate === undefined) {
      throw new SriBuildError(`${label}: código de IVA desconocido «${item.vatCode}».`);
    }
    if (!allowedVatRates.includes(vatRate)) {
      throw new SriBuildError(
        `${label}: la tarifa de IVA ${vatRate} % no está en la configuración tributaria vigente.`,
      );
    }

    const baseCents = grossCents - discountCents;
    return {
      code: item.code?.trim() || null,
      description: requireText(item.description, `${label}: la descripción`, 300),
      quantity: formatMillionths(quantity),
      unitPrice: formatMillionths(unitPrice),
      discountCents,
      baseCents,
      vatCode: item.vatCode,
      vatRate,
      vatCents: percentOfCents(baseCents, vatRate),
    };
  });

  // Totals per IVA code, in the order the codes first appear.
  const taxes: BuiltInvoiceTax[] = [];
  for (const line of lines) {
    const tax = taxes.find((t) => t.vatCode === line.vatCode);
    if (tax) tax.baseCents += line.baseCents;
    else taxes.push({ vatCode: line.vatCode, vatRate: line.vatRate, baseCents: line.baseCents, valueCents: 0 });
  }
  for (const tax of taxes) tax.valueCents = percentOfCents(tax.baseCents, tax.vatRate);

  const subtotalCents = lines.reduce((sum, line) => sum + line.baseCents, 0);
  const discountCents = lines.reduce((sum, line) => sum + line.discountCents, 0);
  const vatCents = taxes.reduce((sum, tax) => sum + tax.valueCents, 0);
  return { lines, taxes, subtotalCents, discountCents, vatCents, totalCents: subtotalCents + vatCents };
}
