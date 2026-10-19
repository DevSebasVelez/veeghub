import { requireAdmin } from "@/lib/auth/require-admin";
import {
  EXPENSE_STATUS_LABELS,
  PAYEE_KIND_LABELS,
  TAX_TREATMENT_LABELS,
  WITHHOLDING_KIND_LABELS,
} from "@/components/admin/finance/labels";
import { getMovementsForExport } from "@/lib/admin/queries/financial-summary";
import { cleanParam } from "@/lib/admin/finance/period";
import {
  type CsvCell,
  csvDate,
  csvMoney,
  csvPercent,
  csvResponse,
  toCsv,
} from "@/lib/admin/finance/csv";
import { fromCents, toCents } from "@/lib/admin/finance/money";

const INVOICE_STATUS: Record<string, string> = {
  READY_TO_SEND: "Por enviar",
  SENT: "Enviada",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
};

// One table with every movement of the summary's selection. "Tipo" tells
// apart what is billed, collected, withheld and spent so nothing is mixed:
// only Cobro and paid Egreso rows are cash.
export async function GET(request: Request) {
  await requireAdmin();

  const params = new URL(request.url).searchParams;
  const get = (key: string) => cleanParam(params.get(key) ?? undefined);
  const { period, invoices, payments, withholdings, expenses } =
    await getMovementsForExport({
      desde: get("desde"),
      hasta: get("hasta"),
      cliente: get("cliente"),
      proyecto: get("proyecto"),
    });

  const rows: Array<{ date: string; cells: CsvCell[] }> = [];

  for (const i of invoices) {
    rows.push({
      date: csvDate(i.issueDate),
      cells: [
        "Factura emitida",
        csvDate(i.issueDate),
        i.invoiceNumber,
        i.client.name,
        i.client.taxId,
        i.project?.name,
        "",
        csvMoney(i.subtotal),
        i.vatRate != null ? csvPercent(i.vatRate) : "No registrada",
        csvMoney(i.taxAmount),
        csvMoney(i.total),
        INVOICE_STATUS[i.status] ?? i.status,
        "",
        "",
      ],
    });
  }

  for (const p of payments) {
    rows.push({
      date: csvDate(p.paidAt),
      cells: [
        "Cobro",
        csvDate(p.paidAt),
        p.receivable.invoice?.invoiceNumber ?? p.reference,
        p.receivable.client.name,
        p.receivable.client.taxId,
        p.receivable.project?.name,
        p.receivable.title,
        "",
        "",
        "",
        csvMoney(p.amount),
        "Recibido",
        p.method,
        "",
      ],
    });
  }

  for (const w of withholdings) {
    const date = w.issueDate ?? w.invoice.issueDate;
    rows.push({
      date: csvDate(date),
      cells: [
        WITHHOLDING_KIND_LABELS[w.kind],
        csvDate(date),
        w.receiptNumber,
        w.invoice.client.name,
        w.invoice.client.taxId,
        w.invoice.project?.name,
        `Factura ${w.invoice.invoiceNumber ?? "sin número"}`,
        "",
        csvPercent(w.percentage),
        "",
        csvMoney(w.amount),
        w.appliesToBalance ? "Descontada del saldo" : "Informativa",
        "",
        "",
      ],
    });
  }

  for (const e of expenses) {
    rows.push({
      date: csvDate(e.expenseDate),
      cells: [
        "Egreso",
        csvDate(e.expenseDate),
        e.receiptNumber,
        e.payee?.name,
        e.payee?.taxId,
        e.project?.name,
        [
          e.description,
          e.category?.name,
          e.payeeKind ? PAYEE_KIND_LABELS[e.payeeKind] : null,
        ]
          .filter(Boolean)
          .join(" · "),
        e.taxAmount != null
          ? csvMoney(fromCents(toCents(e.amount) - toCents(e.taxAmount)))
          : "",
        "",
        csvMoney(e.taxAmount),
        csvMoney(e.amount),
        EXPENSE_STATUS_LABELS[e.status],
        e.method,
        [csvDate(e.paidAt), TAX_TREATMENT_LABELS[e.taxTreatment]]
          .filter(Boolean)
          .join(" · "),
      ],
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  const csv = toCsv(
    [
      "Tipo",
      "Fecha",
      "Documento",
      "Cliente / beneficiario",
      "RUC/Cédula",
      "Proyecto",
      "Detalle",
      "Base",
      "Tarifa / %",
      "IVA",
      "Total",
      "Estado",
      "Método",
      "Pago / tratamiento",
    ],
    rows.map((r) => r.cells),
  );

  return csvResponse(csv, `movimientos_${period.fromKey}_${period.toKey}.csv`);
}
