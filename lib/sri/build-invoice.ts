import { randomInt } from "node:crypto";

import { type SriEnvironment, buildAccessKey } from "@/lib/sri/access-key";
import type { SriEmitter } from "@/lib/sri/emitter";
import {
  BUYER_ID_TYPES,
  type BuildInvoiceItem,
  type BuyerIdType,
  CONSUMER_ID,
  CONSUMER_MAX_CENTS,
  type InvoiceTotals,
  PAYMENT_METHODS,
  type PaymentMethod,
  SriBuildError,
  computeInvoiceTotals,
  shortMoney,
} from "@/lib/sri/invoice-calc";

// The arithmetic lives in invoice-calc.ts (browser-safe); re-exported here so
// server code keeps a single import.
export {
  BUYER_ID_TYPES,
  PAYMENT_METHODS,
  SriBuildError,
  lineBaseCents,
  vatCodeForRate,
} from "@/lib/sri/invoice-calc";
export type {
  BuildInvoiceItem,
  BuiltInvoiceLine,
  BuiltInvoiceTax,
  BuyerIdType,
  PaymentMethod,
} from "@/lib/sri/invoice-calc";

// Builds the unsigned <factura version="1.1.0"> of the SRI offline scheme
// (Ficha Técnica v2.34, Anexo 3) from typed data.
//
// - Nodes go in the XSD's order; optional ones are left out when empty.
// - Totals come from computeInvoiceTotals (invoice-calc.ts), the same code
//   the «Emitir factura» screen runs for its live totals.
// - The regime legend comes from the caller (TaxProfile), never from here.
//
// Signing (B3) takes this string as is.

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

export type BuiltInvoice = InvoiceTotals & {
  xml: string;
  accessKey: string;
  /** "001-002-000000001". */
  number: string;
};

export function randomNumericCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

// ─── Numbers ──────────────────────────────────────────────────────────────

/** Cents as "1.00", the form every money total takes. */
function money(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
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
  if ((input.additionalInfo?.length ?? 0) > 15) {
    throw new SriBuildError("La información adicional admite hasta 15 campos.");
  }

  const totals = computeInvoiceTotals(input.items, input.allowedVatRates);
  const { lines, taxes, subtotalCents, discountCents, totalCents } = totals;

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
    ...totals,
  };
}
