import { requireAdmin } from "@/lib/auth/require-admin";
import {
  PAYEE_KIND_LABELS,
  TAX_TREATMENT_LABELS,
  EXPENSE_STATUS_LABELS,
} from "@/components/admin/finance/labels";
import { getExpensesForExport } from "@/lib/admin/queries/expenses";
import { cleanParam } from "@/lib/admin/finance/period";
import { csvDate, csvMoney, csvResponse, toCsv } from "@/lib/admin/finance/csv";
import { fromCents, toCents } from "@/lib/admin/finance/money";

// Same filters as /admin/egresos, as a CSV file.
export async function GET(request: Request) {
  await requireAdmin();

  const params = new URL(request.url).searchParams;
  const get = (key: string) => cleanParam(params.get(key) ?? undefined);
  const { period, expenses } = await getExpensesForExport({
    desde: get("desde"),
    hasta: get("hasta"),
    estado: get("estado"),
    categoria: get("categoria"),
    proyecto: get("proyecto"),
    clasificacion: get("clasificacion"),
  });

  const csv = toCsv(
    [
      "Fecha del gasto",
      "Concepto",
      "Categoría",
      "Beneficiario",
      "RUC/Cédula beneficiario",
      "Clasificación del pago",
      "Proyecto",
      "Cliente del proyecto",
      "Base (importe − IVA)",
      "IVA",
      "Importe total",
      "Estado",
      "Fecha de pago",
      "Método",
      "Referencia",
      "N.º comprobante",
      "Tratamiento tributario",
      "Recurrente",
      "Observaciones",
    ],
    expenses.map((e) => [
      csvDate(e.expenseDate),
      e.description,
      e.category?.name,
      e.payee?.name,
      e.payee?.taxId,
      e.payeeKind ? PAYEE_KIND_LABELS[e.payeeKind] : "",
      e.project?.name,
      e.project?.client?.name,
      e.taxAmount != null
        ? csvMoney(fromCents(toCents(e.amount) - toCents(e.taxAmount)))
        : "",
      csvMoney(e.taxAmount),
      csvMoney(e.amount),
      EXPENSE_STATUS_LABELS[e.status],
      csvDate(e.paidAt),
      e.method,
      e.reference,
      e.receiptNumber,
      TAX_TREATMENT_LABELS[e.taxTreatment],
      e.recurrencePeriod,
      e.notes,
    ]),
  );

  return csvResponse(csv, `egresos_${period.fromKey}_${period.toKey}.csv`);
}
