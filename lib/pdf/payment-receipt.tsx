import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { COMPANY } from "@/lib/company";
import type { PaymentReceiptData } from "@/lib/admin/receipts/data";
import { amountInWords } from "@/lib/pdf/amount-in-words";
import {
  DocFooter,
  DocHeader,
  Field,
  Hairline,
  Parties,
  Pill,
  instant,
  longDay,
  money,
} from "@/lib/pdf/components";
import { C, registerPdfFonts, s } from "@/lib/pdf/theme";

const NOTE =
  "Este documento certifica la recepción del pago descrito. No constituye comprobante de venta autorizado por el SRI; la factura electrónica correspondiente se emite por separado.";

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ fontSize: 8.5, color: strong ? C.ink : C.muted, fontWeight: strong ? 600 : 400 }}>{label}</Text>
      <Text style={{ fontSize: 8.5, fontWeight: strong ? 600 : 500, color: tone ?? C.ink }}>{value}</Text>
    </View>
  );
}

export function PaymentReceiptDocument({ data }: { data: PaymentReceiptData }) {
  const { milestone } = data;
  // The last of several payments settles the milestone; a single one is a full payment.
  const settlesAfterInstallments = milestone.paidBeforeCents > 0;

  return (
    <Document
      title={`Comprobante de pago ${data.folio}`}
      author={COMPANY.brand}
      creator={COMPANY.brand}
      producer={COMPANY.brand}
      language="es"
    >
      <Page size="A4" style={s.page}>
        <DocHeader
          title="Comprobante de pago"
          code={`N.º ${data.folio}`}
          meta={`Emitido el ${instant(data.issuedAt)}`}
        />

        {/* Hero + milestone balance */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 38 }}>
          <View style={{ flex: 1, paddingRight: 28 }}>
            <Text style={s.label}>Monto recibido</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 10 }}>
              <Text style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1.3, lineHeight: 1 }}>
                {money(data.amountCents)}
              </Text>
              <Text style={{ fontSize: 10.5, color: C.muted, fontWeight: 500, marginLeft: 7, marginBottom: 4 }}>
                {data.currency}
              </Text>
            </View>
            <Text style={{ fontSize: 9, color: C.body, marginTop: 10 }}>{amountInWords(data.amountCents)}</Text>
            <View style={{ marginTop: 14 }}>
              <Pill tone={data.isFullPayment ? "emerald" : "blue"}>
                {data.isFullPayment ? (settlesAfterInstallments ? "Hito pagado en su totalidad" : "Pago total") : "Abono parcial"}
              </Pill>
            </View>
          </View>

          <View style={{ width: 200, backgroundColor: C.soft, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={[s.label, { marginBottom: 6 }]}>Estado del hito</Text>
            <SummaryRow label="Valor del hito" value={money(milestone.amountCents)} />
            {milestone.withheldCents > 0 ? (
              <SummaryRow label="Retenciones" value={`− ${money(milestone.withheldCents)}`} />
            ) : null}
            {milestone.paidBeforeCents > 0 ? (
              <SummaryRow label="Pagos anteriores" value={`− ${money(milestone.paidBeforeCents)}`} />
            ) : null}
            <SummaryRow label="Este pago" value={`− ${money(data.amountCents)}`} />
            <View style={[s.hairline, { marginVertical: 6 }]} />
            <SummaryRow
              label="Saldo pendiente"
              value={money(milestone.balanceAfterCents)}
              strong
              tone={milestone.balanceAfterCents === 0 ? C.emerald : C.ink}
            />
          </View>
        </View>

        <Hairline my={22} />
        <Parties clientLabel="Recibido de" client={data.client} />
        <Hairline my={22} />

        {/* Payment detail */}
        <Text style={s.sectionTitle}>Detalle del pago</Text>
        <View>
          <Field label="Concepto">
            <Text style={{ textAlign: "right", fontWeight: 500 }}>{data.concept}</Text>
            {data.conceptDetail ? (
              <Text style={{ textAlign: "right", color: C.muted, fontSize: 8.5, marginTop: 2 }}>
                {data.conceptDetail}
              </Text>
            ) : null}
          </Field>
          {data.project ? <Field label="Proyecto">{data.project}</Field> : null}
          <Field label="Fecha de pago">{longDay(data.paidAt)}</Field>
          <Field label="Forma de pago">{data.method ?? "—"}</Field>
          <Field label="Referencia" mono={Boolean(data.reference)}>
            {data.reference ?? "—"}
          </Field>
          {milestone.count > 1 ? (
            <Field label="Pago del hito">{`${milestone.position} de ${milestone.count}`}</Field>
          ) : null}
          {data.notes ? <Field label="Nota">{data.notes}</Field> : null}
          {data.invoice ? (
            <Field label="Factura" last>
              <Text style={[s.mono, { textAlign: "right" }]}>{data.invoice.number ?? "Pendiente"}</Text>
              {data.invoice.accessKey ? (
                <Text style={[s.mono, { textAlign: "right", color: C.muted, fontSize: 7, marginTop: 2 }]}>
                  {data.invoice.accessKey}
                </Text>
              ) : null}
            </Field>
          ) : null}
        </View>

        <DocFooter note={NOTE} />
      </Page>
    </Document>
  );
}

export function renderPaymentReceipt(data: PaymentReceiptData) {
  registerPdfFonts();
  return renderToBuffer(<PaymentReceiptDocument data={data} />);
}
