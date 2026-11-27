import { randomInt } from "node:crypto";

import { percentOfCents } from "@/lib/admin/finance/money";
import { type SriEnvironment, buildAccessKey } from "@/lib/sri/access-key";
import type { SriEmitter } from "@/lib/sri/emitter";

// Builds the unsigned <factura version="1.1.0"> of the SRI offline scheme
// (Ficha Técnica v2.34, Anexo 3) from typed data.
//
// - Nodes go in the XSD's order; optional ones are left out when empty.
// - Money is integer cents end to end. Quantity and unit price keep up to six
//   decimals (as the XSD allows) and are multiplied exactly with BigInt; the
//   line is then rounded once to the cent.
// - IVA per line is rounded on the line's base; IVA per rate in
//   totalConImpuestos is rounded on the summed base of that rate.
// - The regime legend comes from the caller (TaxProfile), never from here.
//
// Signing (B3) takes this string as is.

export class SriBuildError extends Error {}

/** Tabla 17: IVA codigoPorcentaje → rate %. 6 (no objeto) and 7 (exento) are 0 %. */
const VAT_CODE_RATES: Record<string, number> = {
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

/** Tabla 6: tipoIdentificacionComprador. */
export const BUYER_ID_TYPES = {
  RUC: "04",
  CEDULA: "05",
  PASAPORTE: "06",
  CONSUMIDOR_FINAL: "07",
  EXTERIOR: "08",
} as const;
export type BuyerIdType = (typeof BUYER_ID_TYPES)[keyof typeof BUYER_ID_TYPES];

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

const CONSUMER_ID = "9999999999999";
/** A consumidor final invoice may not exceed USD 50 (Reglamento de comprobantes, art. 8). */
const CONSUMER_MAX_CENTS = 5000;

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

export type BuildInvoiceInput = {
  environment: SriEnvironment;
  emitter: SriEmitter;
  /** contribuyenteRimpe from the TaxProfile in force; null leaves the node out. */
  rimpeLegend: string | null;
  /** IVA rates the TaxProfile allows; every line must use one of them. */
  allowedVatRates: number[];
  establishment: string;
  emissionPoint: string;
  /** dirEstablecimiento; left out when empty. */
  establishmentAddress?: string | null;
  sequential: number;
  /** Calendar day "yyyy-MM-dd". */
  issueDay: string;
  /** 8 digits; random when omitted. Only tests pin it. */
  numericCode?: string;
  buyer: {
    idType: BuyerIdType;
    id: string;
    name: string;
    address?: string | null;
  };
  items: BuildInvoiceItem[];
  /** One entry pays the whole total when `totalCents` is omitted. */
  payments: { method: PaymentMethod; totalCents?: number }[];
  /** campoAdicional, in order. At most 15. */
  additionalInfo?: { name: string; value: string }[];
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

export type BuiltInvoice = {
  xml: string;
  accessKey: string;
  /** "001-002-000000001". */
  number: string;
  lines: BuiltInvoiceLine[];
  taxes: BuiltInvoiceTax[];
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
};

export function randomNumericCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

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

function moneyToCents(value: string, field: string) {
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

/** Cents as "1.00", the form every money total takes. */
function money(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Cents as the shortest decimal ("0", "1.5"), like the facturador's descuento. */
function shortMoney(cents: number) {
  return formatMillionths(BigInt(cents) * CENTS_PER_MILLIONTH);
}

/** Rate with at least one decimal ("0.0", "15.0"), like the facturador's tarifa. */
function rate(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

// ─── XML ──────────────────────────────────────────────────────────────────

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type Node = string | null | undefined | false;

function el(name: string, content: string | number) {
  return `<${name}>${escapeXml(String(content))}</${name}>`;
}

function group(name: string, children: Node[], attrs = "") {
  return `<${name}${attrs}>${children.filter(Boolean).join("")}</${name}>`;
}

function optional(name: string, value: string | null | undefined) {
  return value != null && value.trim() !== "" ? el(name, value) : null;
}

// ─── Validation ───────────────────────────────────────────────────────────

function requireText(value: string | null | undefined, field: string, max: number) {
  const text = value?.trim() ?? "";
  if (!text) throw new SriBuildError(`Falta ${field}.`);
  if (text.length > max) throw new SriBuildError(`${field} supera ${max} caracteres.`);
  return value!;
}

function checkBuyer(buyer: BuildInvoiceInput["buyer"]) {
  const id = buyer.id.trim();
  switch (buyer.idType) {
    case BUYER_ID_TYPES.RUC:
      if (!/^\d{13}$/.test(id)) throw new SriBuildError("El RUC del comprador debe tener 13 dígitos.");
      break;
    case BUYER_ID_TYPES.CEDULA:
      if (!/^\d{10}$/.test(id)) throw new SriBuildError("La cédula del comprador debe tener 10 dígitos.");
      break;
    case BUYER_ID_TYPES.CONSUMIDOR_FINAL:
      if (id !== CONSUMER_ID) {
        throw new SriBuildError(`Consumidor final se identifica con ${CONSUMER_ID}.`);
      }
      break;
    case BUYER_ID_TYPES.PASAPORTE:
    case BUYER_ID_TYPES.EXTERIOR:
      requireText(id, "la identificación del comprador", 20);
      break;
    default:
      throw new SriBuildError(`Tipo de identificación desconocido: ${buyer.idType as string}.`);
  }
  requireText(buyer.name, "la razón social del comprador", 300);
}

// ─── Builder ──────────────────────────────────────────────────────────────

export function buildInvoiceXml(input: BuildInvoiceInput): BuiltInvoice {
  const { emitter } = input;
  if (!/^\d{13}$/.test(emitter.ruc)) throw new SriBuildError("El RUC del emisor no es válido.");
  if (!Number.isInteger(input.sequential) || input.sequential < 1 || input.sequential > 999_999_999) {
    throw new SriBuildError(`Secuencial fuera de rango: ${input.sequential}.`);
  }
  checkBuyer(input.buyer);
  if (input.items.length === 0) throw new SriBuildError("La factura no tiene ítems.");
  if ((input.additionalInfo?.length ?? 0) > 15) {
    throw new SriBuildError("La información adicional admite hasta 15 campos.");
  }

  // Lines.
  const lines: BuiltInvoiceLine[] = input.items.map((item, index) => {
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
    if (!input.allowedVatRates.includes(vatRate)) {
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
  const totalCents = subtotalCents + vatCents;

  if (input.buyer.idType === BUYER_ID_TYPES.CONSUMIDOR_FINAL && totalCents > CONSUMER_MAX_CENTS) {
    throw new SriBuildError("Una factura a consumidor final no puede superar USD 50.");
  }

  // Payments.
  if (input.payments.length === 0) throw new SriBuildError("Falta la forma de pago.");
  const payments = input.payments.map((payment) => {
    if (!(payment.method in PAYMENT_METHODS)) {
      throw new SriBuildError(`Forma de pago desconocida: ${payment.method}.`);
    }
    return { method: payment.method, cents: payment.totalCents ?? totalCents };
  });
  if (payments.reduce((sum, p) => sum + p.cents, 0) !== totalCents) {
    throw new SriBuildError("Las formas de pago no suman el total de la factura.");
  }

  const accessKey = buildAccessKey({
    issueDay: input.issueDay,
    docType: "01",
    ruc: emitter.ruc,
    environment: input.environment,
    establishment: input.establishment,
    emissionPoint: input.emissionPoint,
    sequential: input.sequential,
    numericCode: input.numericCode ?? randomNumericCode(),
  });
  const sequential = String(input.sequential).padStart(9, "0");
  const [yyyy, mm, dd] = input.issueDay.split("-");

  const infoTributaria = group("infoTributaria", [
    el("ambiente", input.environment === "PRUEBAS" ? "1" : "2"),
    el("tipoEmision", "1"),
    el("razonSocial", requireText(emitter.legalName, "la razón social del emisor", 300)),
    optional("nombreComercial", emitter.tradeName),
    el("ruc", emitter.ruc),
    el("claveAcceso", accessKey),
    el("codDoc", "01"),
    el("estab", input.establishment),
    el("ptoEmi", input.emissionPoint),
    el("secuencial", sequential),
    el("dirMatriz", requireText(emitter.headOfficeAddress, "la dirección matriz", 300)),
    optional("contribuyenteRimpe", input.rimpeLegend),
  ]);

  const infoFactura = group("infoFactura", [
    el("fechaEmision", `${dd}/${mm}/${yyyy}`),
    optional("dirEstablecimiento", input.establishmentAddress ?? emitter.headOfficeAddress),
    el("obligadoContabilidad", emitter.keepsAccounting ? "SI" : "NO"),
    el("tipoIdentificacionComprador", input.buyer.idType),
    el("razonSocialComprador", input.buyer.name),
    el("identificacionComprador", input.buyer.id.trim()),
    optional("direccionComprador", input.buyer.address),
    el("totalSinImpuestos", money(subtotalCents)),
    el("totalDescuento", money(discountCents)),
    group(
      "totalConImpuestos",
      taxes.map((tax) =>
        group("totalImpuesto", [
          el("codigo", "2"),
          el("codigoPorcentaje", tax.vatCode),
          el("baseImponible", money(tax.baseCents)),
          el("valor", money(tax.valueCents)),
        ]),
      ),
    ),
    el("propina", "0"),
    el("importeTotal", money(totalCents)),
    el("moneda", "DOLAR"),
    group(
      "pagos",
      payments.map((p) => group("pago", [el("formaPago", p.method), el("total", money(p.cents))])),
    ),
  ]);

  const detalles = group(
    "detalles",
    lines.map((line) =>
      group("detalle", [
        optional("codigoPrincipal", line.code),
        el("descripcion", line.description),
        el("cantidad", line.quantity),
        el("precioUnitario", line.unitPrice),
        el("descuento", shortMoney(line.discountCents)),
        el("precioTotalSinImpuesto", money(line.baseCents)),
        group("impuestos", [
          group("impuesto", [
            el("codigo", "2"),
            el("codigoPorcentaje", line.vatCode),
            el("tarifa", rate(line.vatRate)),
            el("baseImponible", money(line.baseCents)),
            el("valor", money(line.vatCents)),
          ]),
        ]),
      ]),
    ),
  );

  const extra = (input.additionalInfo ?? []).filter((field) => field.value.trim() !== "");
  const infoAdicional = extra.length
    ? group(
        "infoAdicional",
        extra.map(
          (field) =>
            `<campoAdicional nombre="${escapeXml(requireText(field.name, "el nombre del campo adicional", 300))}">${escapeXml(
              requireText(field.value, `el campo adicional «${field.name}»`, 300),
            )}</campoAdicional>`,
        ),
      )
    : null;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    group("factura", [infoTributaria, infoFactura, detalles, infoAdicional], ` id="comprobante" version="1.1.0"`);

  return {
    xml,
    accessKey,
    number: `${input.establishment}-${input.emissionPoint}-${sequential}`,
    lines,
    taxes,
    subtotalCents,
    discountCents,
    vatCents,
    totalCents,
  };
}
