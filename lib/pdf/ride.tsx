import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import bwipjs from "bwip-js/node";
import type { ReactNode } from "react";

import { PAYMENT_METHODS } from "@/lib/sri/build-invoice";
import { type SriInvoice, parseSriInvoiceXml } from "@/lib/sri/invoice-xml";
import { LOGO_PATH, LOGO_RATIO, C, LEADING, registerPdfFonts, s } from "@/lib/pdf/theme";
import { instant, money, shortDay } from "@/lib/pdf/components";

// RIDE (Representación Impresa del Documento Electrónico), Anexo 2 of the
// Ficha Técnica. Built from the factura XML itself, the source of truth, so
// the printout can never disagree with what the SRI holds.

export type RideMode =
  /** Authorized by the SRI: número and fecha de autorización are printed. */
  | { kind: "authorized"; authorizedAt: Date }
  /** Not authorized (yet): a preview, marked as having no tax value. */
  | { kind: "preview" };

export type RideData = {
  invoice: SriInvoice;
  mode: RideMode;
  barcode: Buffer;
};

const ID_TYPES: Record<string, string> = {
  "04": "RUC",
  "05": "Cédula",
  "06": "Pasaporte",
  "07": "Consumidor final",
  "08": "Identificación del exterior",
};

/** Subtotal lines of the RIDE, by IVA code (Tabla 17), in the usual order. */
export function rideTotals(invoice: SriInvoice) {
  const iva = invoice.taxes.filter((t) => t.code === "2");
  const by = (codes: string[]) =>
    iva.filter((t) => codes.includes(t.rateCode)).reduce((sum, t) => sum + t.baseCents, 0);
  const taxed = iva.filter((t) => !["0", "6", "7"].includes(t.rateCode) && t.ratePercent != null);
  const rates = [...new Set(taxed.map((t) => t.ratePercent!))].sort((a, b) => b - a);

  const lines: Array<{ label: string; cents: number; strong?: boolean }> = [];
  for (const rate of rates) {
    lines.push({
      label: `Subtotal ${rate} %`,
      cents: taxed.filter((t) => t.ratePercent === rate).reduce((sum, t) => sum + t.baseCents, 0),
    });
  }
  lines.push({ label: "Subtotal 0 %", cents: by(["0"]) });
  lines.push({ label: "Subtotal no objeto de IVA", cents: by(["6"]) });
  lines.push({ label: "Subtotal exento de IVA", cents: by(["7"]) });
  lines.push({ label: "Subtotal sin impuestos", cents: invoice.subtotalCents });
  lines.push({ label: "Total descuento", cents: invoice.discountCents });
  for (const rate of rates) {
    lines.push({
      label: `IVA ${rate} %`,
      cents: taxed.filter((t) => t.ratePercent === rate).reduce((sum, t) => sum + t.valueCents, 0),
    });
  }
  const others = invoice.taxes.filter((t) => t.code !== "2").reduce((sum, t) => sum + t.valueCents, 0);
  if (others) lines.push({ label: "Otros impuestos", cents: others });
  lines.push({ label: "Propina", cents: invoice.tipCents });
  lines.push({ label: "Valor total", cents: invoice.totalCents, strong: true });
  return lines;
}

export async function rideDataFromXml(xml: string, mode: RideMode): Promise<RideData> {
  const invoice = parseSriInvoiceXml(xml);
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: invoice.accessKey,
    scale: 3,
    height: 9,
    includetext: false,
  });
  return { invoice, mode, barcode };
}

// ─── Pieces ───────────────────────────────────────────────────────────────

function Box({ children, style }: { children: ReactNode; style?: Style }) {
  return (
    <View style={[{ borderWidth: 0.6, borderColor: C.line, borderRadius: 10, padding: 14 }, style ?? {}]}>
      {children}
    </View>
  );
}

function Pair({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <View style={{ marginTop: 7 }}>
      <Text style={s.label}>{label}</Text>
      {/* A 49-digit clave in mono only fits the box at a smaller size. */}
      <Text style={[{ fontSize: mono ? 6.6 : 8.5, marginTop: 2.5, lineHeight: LEADING }, mono ? s.mono : {}]}>
        {value}
      </Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Text style={{ fontSize: 8, color: C.body, marginTop: 2.5, lineHeight: LEADING }}>
      <Text style={{ color: C.muted }}>{label}: </Text>
      {value}
    </Text>
  );
}

type Col = { label: string; width?: number; align?: "right" };

const COLS: Col[] = [
  { label: "Código", width: 58 },
  { label: "Cant.", width: 38, align: "right" },
  { label: "Descripción" },
  { label: "P. unitario", width: 64, align: "right" },
  { label: "Descuento", width: 56, align: "right" },
  { label: "Total", width: 64, align: "right" },
];

/** One table cell: a View with the column's width, so texts never touch. */
function Cell({ col, children }: { col: Col; children: ReactNode }) {
  return (
    <View
      style={[
        col.width ? { width: col.width } : { flex: 1 },
        { paddingHorizontal: 5, alignItems: col.align === "right" ? "flex-end" : "flex-start" },
      ]}
    >
      {children}
    </View>
  );
}

/** Quantity as written ("1", "2,5"); prices with at least two decimals ("1.200,00", "0,333333"). */
function plainNumber(value: string, minimumFractionDigits = 0) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("es-EC", { minimumFractionDigits, maximumFractionDigits: 6 })
    : value;
}

// ─── Document ─────────────────────────────────────────────────────────────

export function RideDocument({ data }: { data: RideData }) {
  const { invoice, mode } = data;
  const e = invoice.emitter;
  const authorized = mode.kind === "authorized";

  return (
    <Document
      title={`Factura ${invoice.number}`}
      author={e.tradeName ?? e.legalName}
      creator={e.tradeName ?? e.legalName}
      producer="VeegHub"
      language="es"
    >
      <Page size="A4" style={[s.page, { fontSize: 8.5, paddingTop: 40 }]}>
        {!authorized ? (
          <View
            fixed
            style={{ position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" }}
          >
            <Text style={{ fontSize: 8, fontWeight: 600, color: C.amber, letterSpacing: 1 }}>
              VISTA PREVIA · SIN AUTORIZACIÓN DEL SRI · SIN VALOR TRIBUTARIO
            </Text>
          </View>
        ) : null}

        {/* Emitter | document */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Box style={{ flex: 1 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={LOGO_PATH} style={{ width: 22 * LOGO_RATIO, height: 22, marginBottom: 12 }} />
            <Text style={{ fontSize: 10, fontWeight: 600, lineHeight: LEADING }}>{e.legalName}</Text>
            {e.tradeName ? <Text style={{ fontSize: 9, color: C.body, marginTop: 2 }}>{e.tradeName}</Text> : null}
            <View style={{ marginTop: 8 }}>
              <Line label="Dirección matriz" value={e.address?.trim()} />
              <Line
                label="Dirección establecimiento"
                value={e.establishmentAddress && e.establishmentAddress.trim() !== e.address?.trim() ? e.establishmentAddress.trim() : null}
              />
              <Line label="Obligado a llevar contabilidad" value={e.keepsAccounting == null ? null : e.keepsAccounting ? "SÍ" : "NO"} />
            </View>
            {e.rimpeLegend ? (
              <Text style={{ fontSize: 8, fontWeight: 600, marginTop: 8, color: C.ink }}>{e.rimpeLegend}</Text>
            ) : null}
          </Box>

          <Box style={{ width: 250 }}>
            <Text style={s.label}>RUC</Text>
            <Text style={[s.mono, { fontSize: 10.5, marginTop: 2.5 }]}>{e.ruc}</Text>
            <Text style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3, marginTop: 10 }}>FACTURA</Text>
            <Text style={[s.mono, { fontSize: 10.5, marginTop: 2 }]}>No. {invoice.number}</Text>
            <Pair label="Número de autorización" value={invoice.accessKey} mono />
            <Pair
              label="Fecha y hora de autorización"
              value={authorized ? instant(mode.authorizedAt) : "Pendiente de autorización"}
            />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pair label="Ambiente" value={invoice.environment === "PRODUCCION" ? "PRODUCCIÓN" : "PRUEBAS"} />
              <Pair label="Emisión" value="NORMAL" />
            </View>
            <Text style={[s.label, { marginTop: 9 }]}>Clave de acceso</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={{ data: data.barcode, format: "png" }} style={{ width: 222, height: 34, marginTop: 5 }} />
            <Text style={[s.mono, { fontSize: 6.6, marginTop: 3, letterSpacing: 0.2 }]}>{invoice.accessKey}</Text>
          </Box>
        </View>

        {/* Buyer */}
        <Box style={{ marginTop: 12, flexDirection: "row", gap: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Razón social / nombres</Text>
            <Text style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2.5, lineHeight: LEADING }}>
              {invoice.buyer.name ?? "—"}
            </Text>
            <Line label="Dirección" value={invoice.buyer.address} />
          </View>
          <View style={{ width: 130 }}>
            <Text style={s.label}>{ID_TYPES[invoice.buyer.idType ?? ""] ?? "Identificación"}</Text>
            <Text style={[s.mono, { fontSize: 9.5, marginTop: 2.5 }]}>{invoice.buyer.id ?? "—"}</Text>
          </View>
          <View style={{ width: 90 }}>
            <Text style={s.label}>Fecha de emisión</Text>
            <Text style={{ fontSize: 9.5, marginTop: 2.5 }}>{shortDay(new Date(`${invoice.issueDay}T00:00:00.000Z`))}</Text>
          </View>
        </Box>

        {/* Detail */}
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 0.6, borderBottomColor: C.line }}>
            {COLS.map((col) => (
              <Cell key={col.label} col={col}>
                <Text style={[s.label, { fontSize: 6.8 }]}>{col.label}</Text>
              </Cell>
            ))}
          </View>
          {invoice.items.map((item, index) => (
            <View
              key={index}
              wrap={false}
              style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: C.line }}
            >
              <Cell col={COLS[0]}>
                <Text style={[s.mono, { fontSize: 7.5, color: C.body }]}>{item.code ?? "—"}</Text>
              </Cell>
              <Cell col={COLS[1]}>
                <Text>{plainNumber(item.quantity)}</Text>
              </Cell>
              <Cell col={COLS[2]}>
                <Text style={{ fontSize: 8.5, lineHeight: 1.35 }}>{item.description}</Text>
              </Cell>
              <Cell col={COLS[3]}>
                <Text>{plainNumber(item.unitPrice, 2)}</Text>
              </Cell>
              <Cell col={COLS[4]}>
                <Text style={{ color: C.body }}>{item.discountCents ? money(item.discountCents) : "—"}</Text>
              </Cell>
              <Cell col={COLS[5]}>
                <Text style={{ fontWeight: 500 }}>{money(item.totalCents)}</Text>
              </Cell>
            </View>
          ))}
        </View>

        {/* Additional info + payments | totals */}
        <View wrap={false} style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <View style={{ flex: 1, gap: 10 }}>
            {Object.keys(invoice.additional).length ? (
              <Box>
                <Text style={[s.sectionTitle, { fontSize: 9, marginBottom: 4 }]}>Información adicional</Text>
                {Object.entries(invoice.additional).map(([name, value]) => (
                  <Line key={name} label={name} value={value} />
                ))}
              </Box>
            ) : null}
            <Box>
              <Text style={[s.sectionTitle, { fontSize: 9, marginBottom: 4 }]}>Forma de pago</Text>
              {invoice.payments.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                  <Text style={{ fontSize: 8, color: C.body, flex: 1, paddingRight: 8, lineHeight: LEADING }}>
                    {p.method} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? "Otra"}
                  </Text>
                  <Text style={{ fontSize: 8, fontWeight: 500 }}>{money(p.totalCents)}</Text>
                </View>
              ))}
            </Box>
          </View>

          <Box style={{ width: 220, paddingVertical: 10 }}>
            {rideTotals(invoice).map((line) => (
              <View
                key={line.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: line.strong ? 6 : 2.5,
                  marginTop: line.strong ? 4 : 0,
                  borderTopWidth: line.strong ? 0.6 : 0,
                  borderTopColor: C.line,
                }}
              >
                <Text style={{ fontSize: line.strong ? 9.5 : 8, color: line.strong ? C.ink : C.body, fontWeight: line.strong ? 600 : 400 }}>
                  {line.label}
                </Text>
                <Text style={{ fontSize: line.strong ? 10.5 : 8, fontWeight: line.strong ? 600 : 500 }}>
                  {money(line.cents)}
                </Text>
              </View>
            ))}
          </Box>
        </View>

        <Text
          fixed
          style={{ position: "absolute", left: 52, right: 52, bottom: 30, fontSize: 7, color: C.faint, textAlign: "center" }}
          render={({ pageNumber, totalPages }) =>
            `Documento generado por VeegHub a partir del comprobante electrónico${totalPages > 1 ? ` · Página ${pageNumber} de ${totalPages}` : ""}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderRide(xml: string, mode: RideMode) {
  registerPdfFonts();
  const data = await rideDataFromXml(xml, mode);
  return renderToBuffer(<RideDocument data={data} />);
}
