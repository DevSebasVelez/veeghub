import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactNode } from "react";

import { COMPANY } from "@/lib/company";
import type {
  AccountStatementData,
  StatementPayment,
  StatementPending,
} from "@/lib/admin/receipts/data";
import type {
  MilestoneStanding,
  ProjectStatementSummary,
  StatementMilestone,
} from "@/lib/admin/receipts/project-summary";
import {
  DocFooter,
  DocHeader,
  Hairline,
  Parties,
  Pill,
  type PillTone,
  longDay,
  money,
  shortDay,
} from "@/lib/pdf/components";
import { C, registerPdfFonts, s } from "@/lib/pdf/theme";

const NOTE =
  "Estado de cuenta informativo con corte a la fecha indicada. No constituye comprobante de venta autorizado por el SRI. Si su registro no coincide, escríbanos y lo revisamos.";

type Col = { label: string; width?: number; align?: "right" };

function TableHead({ cols }: { cols: Col[] }) {
  return (
    <View
      style={{ flexDirection: "row", paddingBottom: 7, borderBottomWidth: 0.6, borderBottomColor: C.line }}
    >
      {cols.map((col) => (
        <Text
          key={col.label}
          style={[
            s.label,
            { fontSize: 7, textAlign: col.align ?? "left" },
            col.width ? { width: col.width } : { flex: 1, paddingRight: 10 },
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

function Cell({ width, align, children }: { width?: number; align?: "right"; children: ReactNode }) {
  return (
    <View style={[width ? { width } : { flex: 1, paddingRight: 10 }, { alignItems: align === "right" ? "flex-end" : "flex-start" }]}>
      {children}
    </View>
  );
}

function TotalRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 10 }}>
      <Text style={{ color: C.muted, marginRight: 18 }}>{label}</Text>
      <Text style={{ fontWeight: 600, color: tone ?? C.ink, width: 90, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function Figure({ label, value, helper, tone }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.soft, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.5, marginTop: 8, lineHeight: 1.15, color: tone ?? C.ink }}>
        {value}
      </Text>
      <Text style={{ fontSize: 8, color: C.muted, marginTop: 4 }}>{helper}</Text>
    </View>
  );
}

function dueStatus(r: StatementPending): { text: string; color: string } {
  const d = r.daysOverdue;
  if (d == null) return { text: "Sin fecha", color: C.muted };
  if (d > 0) return { text: `Vencido hace ${d} ${d === 1 ? "día" : "días"}`, color: C.red };
  if (d === 0) return { text: "Vence hoy", color: C.amber };
  if (d >= -7) return { text: `Vence en ${-d} ${d === -1 ? "día" : "días"}`, color: C.amber };
  return { text: "Al día", color: C.body };
}

const PAYMENT_COLS: Col[] = [
  { label: "Fecha", width: 66 },
  { label: "Concepto" },
  { label: "Forma / referencia", width: 120 },
  { label: "Recibo", width: 70 },
  { label: "Monto", width: 70, align: "right" },
];

const PENDING_COLS: Col[] = [
  { label: "Concepto" },
  { label: "Vence", width: 64 },
  { label: "Estado", width: 100 },
  { label: "Valor", width: 60, align: "right" },
  { label: "Abonado", width: 60, align: "right" },
  { label: "Saldo", width: 66, align: "right" },
];

const ROW = {
  flexDirection: "row" as const,
  paddingVertical: 6.5,
  borderBottomWidth: 0.6,
  borderBottomColor: C.line,
};

/**
 * A table that never strands its parts across a page break: the title and
 * header travel with the first row, the totals with the last one.
 */
function KeptTable({
  title,
  cols,
  rows,
  totals,
}: {
  title: string;
  cols: Col[];
  rows: ReactNode[];
  totals: ReactNode;
}) {
  const [first, ...rest] = rows;
  const last = rest.length ? rest[rest.length - 1] : null;
  const middle = rest.slice(0, -1);

  return (
    <>
      <View wrap={false}>
        <Text style={s.sectionTitle}>{title}</Text>
        <TableHead cols={cols} />
        {first}
        {last ? null : totals}
      </View>
      {middle}
      {last ? (
        <View wrap={false}>
          {last}
          {totals}
        </View>
      ) : null}
    </>
  );
}

function PaymentRow({ p, showProject }: { p: StatementPayment; showProject: boolean }) {
  return (
    <View wrap={false} style={ROW}>
      <Cell width={66}>
        <Text>{shortDay(p.paidAt)}</Text>
      </Cell>
      <Cell>
        <Text style={{ fontWeight: 500 }}>{p.concept}</Text>
        {p.project && showProject ? (
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{p.project}</Text>
        ) : null}
      </Cell>
      <Cell width={120}>
        <Text>{p.method ?? "—"}</Text>
        {p.reference ? (
          <Text style={[s.mono, { fontSize: 7.5, color: C.muted, marginTop: 1 }]}>{p.reference}</Text>
        ) : null}
      </Cell>
      <Cell width={70}>
        <Text style={[s.mono, { fontSize: 7.5, color: p.folio ? C.body : C.faint }]}>{p.folio ?? "—"}</Text>
      </Cell>
      <Cell width={70} align="right">
        <Text style={{ fontWeight: 500 }}>{money(p.amountCents)}</Text>
      </Cell>
    </View>
  );
}

function PendingRow({ r, showProject }: { r: StatementPending; showProject: boolean }) {
  const status = dueStatus(r);
  return (
    <View wrap={false} style={ROW}>
      <Cell>
        <Text style={{ fontWeight: 500 }}>{r.concept}</Text>
        {r.project && showProject ? (
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{r.project}</Text>
        ) : null}
        {r.detail ? <Text style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{r.detail}</Text> : null}
      </Cell>
      <Cell width={64}>
        <Text>{r.dueDate ? shortDay(r.dueDate) : "—"}</Text>
      </Cell>
      <Cell width={100}>
        <Text style={{ color: status.color, fontWeight: 500 }}>{status.text}</Text>
      </Cell>
      <Cell width={60} align="right">
        <Text style={{ color: C.body }}>{money(r.amountCents)}</Text>
      </Cell>
      <Cell width={60} align="right">
        <Text style={{ color: C.body }}>{r.coveredCents ? money(r.coveredCents) : "—"}</Text>
      </Cell>
      <Cell width={66} align="right">
        <Text style={{ fontWeight: 600 }}>{money(r.balanceCents)}</Text>
      </Cell>
    </View>
  );
}

const MILESTONE_COLS: Col[] = [
  { label: "Hito" },
  { label: "Vence", width: 60 },
  { label: "Estado", width: 72 },
  { label: "Valor", width: 62, align: "right" },
  { label: "Cubierto", width: 62, align: "right" },
  { label: "Saldo", width: 62, align: "right" },
];

const STANDING: Record<MilestoneStanding, { label: string; tone: PillTone }> = {
  PAID: { label: "PAGADO", tone: "emerald" },
  PARTIAL: { label: "ABONADO", tone: "blue" },
  OVERDUE: { label: "VENCIDO", tone: "red" },
  PENDING: { label: "PENDIENTE", tone: "zinc" },
};

function MilestoneRow({ m }: { m: StatementMilestone }) {
  const standing = STANDING[m.standing];
  const covered = m.paidCents + m.withheldCents;
  const notes = [
    m.invoiceNumber ? `Factura ${m.invoiceNumber}` : null,
    m.withheldCents ? `Incluye ${money(m.withheldCents)} retenido` : null,
  ].filter(Boolean);
  return (
    <View wrap={false} style={ROW}>
      <Cell>
        <Text style={{ fontWeight: 500 }}>{m.concept}</Text>
        {m.detail ? <Text style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{m.detail}</Text> : null}
        {notes.length ? (
          <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 1 }}>{notes.join(" · ")}</Text>
        ) : null}
      </Cell>
      <Cell width={60}>
        <Text>{m.dueDate ? shortDay(m.dueDate) : "—"}</Text>
      </Cell>
      <Cell width={72}>
        <Pill tone={standing.tone}>{standing.label}</Pill>
      </Cell>
      <Cell width={62} align="right">
        <Text style={{ color: C.body }}>{money(m.amountCents)}</Text>
      </Cell>
      <Cell width={62} align="right">
        <Text style={{ color: C.body }}>{covered ? money(covered) : "—"}</Text>
      </Cell>
      <Cell width={62} align="right">
        <Text style={{ fontWeight: 600, color: m.balanceCents ? C.ink : C.faint }}>
          {m.balanceCents ? money(m.balanceCents) : "—"}
        </Text>
      </Cell>
    </View>
  );
}

function ProjectFigures({ summary }: { summary: ProjectStatementSummary }) {
  const covered = summary.paidCents + summary.withheldCents;
  const percent = summary.valueCents ? Math.round((covered / summary.valueCents) * 100) : 0;
  const count = summary.milestones.length;
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
      <Figure
        label="Valor del proyecto"
        value={money(summary.valueCents)}
        helper={`${count} ${count === 1 ? "hito" : "hitos"}`}
      />
      <Figure
        label="Pagado"
        value={money(summary.paidCents)}
        helper={
          summary.withheldCents
            ? `+ ${money(summary.withheldCents)} retenido · ${percent} % cubierto`
            : `${percent} % del valor`
        }
        tone={summary.paidCents > 0 ? C.emerald : undefined}
      />
      <Figure
        label="Saldo pendiente"
        value={money(summary.balanceCents)}
        helper={
          summary.overdueCents
            ? `${money(summary.overdueCents)} vencido`
            : summary.balanceCents
              ? "Todo al día"
              : "Proyecto saldado"
        }
        tone={summary.overdueCents ? C.red : undefined}
      />
    </View>
  );
}

function MilestonesTable({ summary }: { summary: ProjectStatementSummary }) {
  if (summary.milestones.length === 0) {
    return (
      <>
        <Text style={s.sectionTitle}>Hitos del proyecto</Text>
        <Text style={{ color: C.muted }}>El proyecto aún no tiene hitos de cobro.</Text>
      </>
    );
  }
  return (
    <KeptTable
      title="Hitos del proyecto"
      cols={MILESTONE_COLS}
      rows={summary.milestones.map((m) => (
        <MilestoneRow key={m.id} m={m} />
      ))}
      totals={
        <>
          {summary.withheldCents ? (
            <TotalRow label="Retenido por el cliente" value={money(summary.withheldCents)} />
          ) : null}
          <TotalRow label="Saldo pendiente" value={money(summary.balanceCents)} />
          {summary.overdueCents ? (
            <TotalRow label="De lo cual vencido" value={money(summary.overdueCents)} tone={C.red} />
          ) : null}
        </>
      }
    />
  );
}

/** Figures of a client statement: paid in the period, pending and overdue. */
function ClientFigures({ data }: { data: AccountStatementData }) {
  const overdue = data.overdueCents > 0;
  const overdueCount = data.pending.filter((r) => (r.daysOverdue ?? 0) > 0).length;
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
      <Figure
        label="Pagado en el periodo"
        value={money(data.paidCents)}
        helper={`${data.payments.length} ${data.payments.length === 1 ? "pago" : "pagos"} recibidos`}
        tone={data.paidCents > 0 ? C.emerald : undefined}
      />
      <Figure
        label="Saldo pendiente"
        value={money(data.pendingCents)}
        helper={
          data.pending.length
            ? `${data.pending.length} ${data.pending.length === 1 ? "hito abierto" : "hitos abiertos"}`
            : "Sin saldos por cobrar"
        }
      />
      <Figure
        label="Vencido"
        value={money(data.overdueCents)}
        helper={overdue ? `${overdueCount} ${overdueCount === 1 ? "hito" : "hitos"} fuera de plazo` : "Todo al día"}
        tone={overdue ? C.red : undefined}
      />
    </View>
  );
}

export function AccountStatementDocument({ data }: { data: AccountStatementData }) {
  const summary = data.projectSummary;
  const overdue = data.overdueCents > 0;

  return (
    <Document
      title={`Estado de cuenta ${data.project ?? data.client.name}`}
      author={COMPANY.brand}
      creator={COMPANY.brand}
      producer={COMPANY.brand}
      language="es"
    >
      <Page size="A4" style={[s.page, { fontSize: 9 }]}>
        <DocHeader
          title="Estado de cuenta"
          code={data.code}
          meta={`Corte al ${longDay(data.cutoff)}`}
        />

        <View style={{ marginTop: 32 }}>
          <Text style={s.label}>{summary ? "Proyecto" : "Periodo"}</Text>
          <Text style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.6, marginTop: 7 }}>
            {summary ? data.project : `${shortDay(data.from)} – ${shortDay(data.to)}`}
          </Text>
          {summary ? (
            <Text style={{ fontSize: 9, color: C.body, marginTop: 5 }}>
              Pagos del {shortDay(data.from)} al {shortDay(data.to)}
            </Text>
          ) : null}
        </View>

        <Hairline my={22} />
        <Parties clientLabel="Cliente" client={data.client} />

        {summary ? (
          <>
            <ProjectFigures summary={summary} />
            <View style={{ marginTop: 28 }}>
              <MilestonesTable summary={summary} />
            </View>
          </>
        ) : (
          <ClientFigures data={data} />
        )}

        {/* Payments */}
        <View style={{ marginTop: 28 }}>
          {data.payments.length === 0 ? (
            <>
              <Text style={s.sectionTitle}>Pagos recibidos</Text>
              <Text style={{ color: C.muted }}>No se registraron pagos en este periodo.</Text>
            </>
          ) : (
            <KeptTable
              title="Pagos recibidos"
              cols={PAYMENT_COLS}
              rows={data.payments.map((p) => (
                <PaymentRow key={p.id} p={p} showProject={!data.project} />
              ))}
              totals={<TotalRow label="Total pagado" value={money(data.paidCents)} />}
            />
          )}
        </View>

        {/* Pending (the project view already lists every milestone) */}
        {!summary && data.pending.length > 0 ? (
          <View style={{ marginTop: 28 }}>
            <KeptTable
              title="Pendiente de pago"
              cols={PENDING_COLS}
              rows={data.pending.map((r) => (
                <PendingRow key={r.id} r={r} showProject={!data.project} />
              ))}
              totals={
                <>
                  <TotalRow label="Total pendiente" value={money(data.pendingCents)} />
                  {overdue ? (
                    <TotalRow label="De lo cual vencido" value={money(data.overdueCents)} tone={C.red} />
                  ) : null}
                </>
              }
            />
          </View>
        ) : null}

        <DocFooter note={NOTE} />
      </Page>
    </Document>
  );
}

export function renderAccountStatement(data: AccountStatementData) {
  registerPdfFonts();
  return renderToBuffer(<AccountStatementDocument data={data} />);
}
