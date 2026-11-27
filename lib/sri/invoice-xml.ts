import { XMLParser } from "fast-xml-parser";

import { type SriEnvironment, parseAccessKey } from "@/lib/sri/access-key";
import { toCents } from "@/lib/admin/finance/money";

// Reader for an SRI factura XML. Accepts every shape it comes in:
//   - the bare signed <factura> the SRI facturador downloads,
//   - <autorizacion> with the factura in <comprobante> as CDATA or escaped,
//   - <RespuestaAutorizacionComprobante>/<autorizaciones>, even inside a SOAP
//     envelope (the authorization web service answer).
// Everything is read as text (leading zeros matter) and money as cents.

export class SriXmlError extends Error {}

/** Tabla 17 of the ficha: IVA codigoPorcentaje → rate. */
const IVA_RATES: Record<string, number | null> = {
  "0": 0,
  "2": 12,
  "3": 14,
  "4": 15,
  "5": 5,
  "6": null, // no objeto de impuesto
  "7": null, // exento
  "8": null, // IVA diferenciado
  "10": 13,
};

export type SriInvoiceTax = {
  /** 2 = IVA, 3 = ICE, 5 = IRBPNR. */
  code: string;
  rateCode: string;
  ratePercent: number | null;
  baseCents: number;
  valueCents: number;
};

export type SriInvoiceItem = {
  code: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountCents: number;
  totalCents: number;
};

export type SriInvoice = {
  schemaVersion: string | null;
  accessKey: string;
  environment: SriEnvironment;
  emitter: {
    ruc: string;
    legalName: string;
    tradeName: string | null;
    address: string | null;
    rimpeLegend: string | null;
  };
  establishment: string;
  emissionPoint: string;
  sequential: string;
  /** "001-001-000000001", the way invoices are numbered in VeegHub. */
  number: string;
  /** Calendar day "yyyy-MM-dd". */
  issueDay: string;
  buyer: {
    idType: string | null;
    id: string | null;
    name: string | null;
    address: string | null;
  };
  subtotalCents: number;
  discountCents: number;
  taxes: SriInvoiceTax[];
  /** IVA only (codigo 2). */
  vatCents: number;
  /** Single IVA rate of the invoice; null when mixed or none. */
  vatRate: number | null;
  tipCents: number;
  totalCents: number;
  currency: string | null;
  items: SriInvoiceItem[];
  additional: Record<string, string>;
  /** Only present when the file carries the SRI authorization wrapper. */
  authorization: {
    status: string | null;
    number: string | null;
    /** Raw value as the SRI wrote it. */
    at: string | null;
    environment: string | null;
  } | null;
  /** Inconsistencies found, in Spanish, for the person to review. */
  warnings: string[];
};

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) =>
    ["autorizacion", "totalImpuesto", "detalle", "impuesto", "pago", "campoAdicional", "mensaje"].includes(name),
});

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Depth-first search for the first node with that tag name. */
function findNode(value: unknown, name: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNode(item, name);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isNode(value)) return undefined;
  if (name in value) return value[name];
  for (const child of Object.values(value)) {
    const found = findNode(child, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Text content of a leaf, whether it parsed as a string or as {#text, @_attr}. */
function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (isNode(value) && "#text" in value) return text(value["#text"]);
  return null;
}

function req(node: Node | undefined, key: string, where: string): string {
  const value = text(node?.[key]);
  if (!value) throw new SriXmlError(`Al XML le falta ${where}/${key}.`);
  return value;
}

function asArray(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

/** dd/mm/aaaa → yyyy-MM-dd. */
function dayFromSri(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new SriXmlError(`Fecha de emisión con formato inesperado: ${value}.`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** The <factura> node and, when present, its authorization wrapper. */
function locateInvoice(xml: string): { factura: Node; authorization: Node | null } {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new SriXmlError("El archivo no es un XML válido.");
  }

  const direct = findNode(doc, "factura");
  if (isNode(direct)) return { factura: direct, authorization: null };

  const autorizacion = asArray(findNode(doc, "autorizacion"))[0];
  if (autorizacion) {
    const inner = text(autorizacion.comprobante);
    if (!inner) throw new SriXmlError("La autorización no incluye el comprobante.");
    const innerDoc = parser.parse(inner);
    const factura = findNode(innerDoc, "factura");
    if (isNode(factura)) return { factura, authorization: autorizacion };
    if (findNode(innerDoc, "notaCredito") || findNode(innerDoc, "comprobanteRetencion")) {
      throw new SriXmlError("El XML es de otro tipo de comprobante, no de una factura.");
    }
  }

  if (findNode(doc, "notaCredito") || findNode(doc, "comprobanteRetencion")) {
    throw new SriXmlError("El XML es de otro tipo de comprobante, no de una factura.");
  }
  throw new SriXmlError("No se encontró una factura electrónica del SRI en el archivo.");
}

export function parseSriInvoiceXml(xml: string): SriInvoice {
  const { factura, authorization } = locateInvoice(xml.replace(/^﻿/, ""));
  const warnings: string[] = [];

  const info = isNode(factura.infoTributaria) ? factura.infoTributaria : undefined;
  const inv = isNode(factura.infoFactura) ? factura.infoFactura : undefined;
  if (!info || !inv) throw new SriXmlError("Al XML le faltan infoTributaria o infoFactura.");

  const accessKey = req(info, "claveAcceso", "infoTributaria");
  const codDoc = req(info, "codDoc", "infoTributaria");
  if (codDoc !== "01") throw new SriXmlError(`El comprobante es de tipo ${codDoc}, no una factura (01).`);

  const ruc = req(info, "ruc", "infoTributaria");
  const establishment = req(info, "estab", "infoTributaria");
  const emissionPoint = req(info, "ptoEmi", "infoTributaria");
  const sequential = req(info, "secuencial", "infoTributaria");
  const ambiente = req(info, "ambiente", "infoTributaria");
  const environment: SriEnvironment = ambiente === "1" ? "PRUEBAS" : "PRODUCCION";
  const issueDay = dayFromSri(req(inv, "fechaEmision", "infoFactura"));

  const key = parseAccessKey(accessKey);
  if (!key) {
    warnings.push("La clave de acceso no es válida (49 dígitos con dígito verificador).");
  } else {
    const mismatches = [
      key.issueDay !== issueDay && "la fecha de emisión",
      key.ruc !== ruc && "el RUC",
      key.environment !== environment && "el ambiente",
      key.establishment !== establishment && "el establecimiento",
      key.emissionPoint !== emissionPoint && "el punto de emisión",
      key.sequential !== sequential && "el secuencial",
      key.docType !== codDoc && "el tipo de comprobante",
    ].filter(Boolean);
    if (mismatches.length) {
      warnings.push(`La clave de acceso no coincide con ${mismatches.join(", ")} del XML.`);
    }
  }

  const taxes: SriInvoiceTax[] = asArray(
    isNode(inv.totalConImpuestos) ? inv.totalConImpuestos.totalImpuesto : undefined,
  ).map((t) => {
    const code = text(t.codigo) ?? "";
    const rateCode = text(t.codigoPorcentaje) ?? "";
    const tarifa = text(t.tarifa);
    return {
      code,
      rateCode,
      ratePercent:
        code === "2" ? (IVA_RATES[rateCode] ?? (tarifa ? Number(tarifa) : null)) : tarifa ? Number(tarifa) : null,
      baseCents: toCents(text(t.baseImponible)),
      valueCents: toCents(text(t.valor)),
    };
  });

  const iva = taxes.filter((t) => t.code === "2");
  const vatCents = iva.reduce((sum, t) => sum + t.valueCents, 0);
  const vatRates = [...new Set(iva.map((t) => t.ratePercent))];
  const vatRate = vatRates.length === 1 ? vatRates[0] : null;

  const subtotalCents = toCents(req(inv, "totalSinImpuestos", "infoFactura"));
  const totalCents = toCents(req(inv, "importeTotal", "infoFactura"));
  const tipCents = toCents(text(inv.propina));
  const otherTaxCents = taxes.filter((t) => t.code !== "2").reduce((s, t) => s + t.valueCents, 0);

  if (subtotalCents + vatCents + otherTaxCents + tipCents !== totalCents) {
    warnings.push("El total no cuadra con el subtotal más los impuestos del XML.");
  }

  const items: SriInvoiceItem[] = asArray(
    isNode(factura.detalles) ? factura.detalles.detalle : undefined,
  ).map((d) => ({
    code: text(d.codigoPrincipal),
    description: text(d.descripcion) ?? "",
    quantity: text(d.cantidad) ?? "0",
    unitPrice: text(d.precioUnitario) ?? "0",
    discountCents: toCents(text(d.descuento)),
    totalCents: toCents(text(d.precioTotalSinImpuesto)),
  }));

  if (items.length && items.reduce((s, i) => s + i.totalCents, 0) !== subtotalCents) {
    warnings.push("La suma de los ítems no coincide con el subtotal del XML.");
  }

  const additional: Record<string, string> = {};
  for (const field of asArray(isNode(factura.infoAdicional) ? factura.infoAdicional.campoAdicional : undefined)) {
    const name = text(field["@_nombre"]);
    const value = text(field);
    if (name && value) additional[name] = value;
  }

  if (environment === "PRUEBAS") {
    warnings.push("La factura es del ambiente de PRUEBAS del SRI: no tiene validez tributaria.");
  }

  const auth = authorization
    ? {
        status: text(authorization.estado),
        number: text(authorization.numeroAutorizacion),
        at: text(authorization.fechaAutorizacion),
        environment: text(authorization.ambiente),
      }
    : null;
  if (auth?.status && auth.status !== "AUTORIZADO") {
    warnings.push(`El SRI no autorizó este comprobante (estado: ${auth.status}).`);
  }
  if (auth?.number && auth.number !== accessKey && auth.number.length === 49) {
    warnings.push("El número de autorización no coincide con la clave de acceso.");
  }

  return {
    schemaVersion: text(factura["@_version"]),
    accessKey,
    environment,
    emitter: {
      ruc,
      legalName: req(info, "razonSocial", "infoTributaria"),
      tradeName: text(info.nombreComercial),
      address: text(info.dirMatriz),
      rimpeLegend: text(info.contribuyenteRimpe),
    },
    establishment,
    emissionPoint,
    sequential,
    number: `${establishment}-${emissionPoint}-${sequential}`,
    issueDay,
    buyer: {
      idType: text(inv.tipoIdentificacionComprador),
      id: text(inv.identificacionComprador),
      name: text(inv.razonSocialComprador),
      address: text(inv.direccionComprador),
    },
    subtotalCents,
    discountCents: toCents(text(inv.totalDescuento)),
    taxes,
    vatCents,
    vatRate,
    tipCents,
    totalCents,
    currency: text(inv.moneda),
    items,
    additional,
    authorization: auth,
    warnings,
  };
}
