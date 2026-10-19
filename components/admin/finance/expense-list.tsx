import Link from "next/link";
import { Paperclip } from "lucide-react";

import { deleteExpense } from "@/lib/admin/actions/expenses/actions";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import type { EntityOption } from "@/components/admin/dialogs/_base";
import {
  ExpenseDialog,
  MarkExpensePaidDialog,
  type ExpenseCategoryOption,
  type PayeeOption,
} from "@/components/admin/dialogs/expense-dialog";
import {
  PAYEE_KIND_LABELS,
  TAX_TREATMENT_LABELS,
} from "@/components/admin/finance/labels";
import { StatusBadge } from "@/components/admin/status-badge";
import { forExpenseDialog } from "@/lib/admin/serialize";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ExpenseRow = Parameters<typeof forExpenseDialog>[0] & {
  category: { id: string; name: string } | null;
  payee: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  receiptFile: { id: string; name: string } | null;
  recurrencePeriod?: string | null;
};

export function ExpenseList({
  expenses,
  categories,
  payees,
  projects,
  showProject = true,
  fixedProjectId,
}: {
  expenses: ExpenseRow[];
  categories: ExpenseCategoryOption[];
  payees: PayeeOption[];
  projects: EntityOption[];
  showProject?: boolean;
  fixedProjectId?: string;
}) {
  if (expenses.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No hay egresos registrados con estos filtros.
      </div>
    );
  }

  const actions = (expense: ExpenseRow) => (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {expense.status === "PENDING" ? (
        <MarkExpensePaidDialog
          expense={{
            id: expense.id,
            description: expense.description,
            amount: formatCurrency(expense.amount.toString()),
            method: expense.method,
          }}
        />
      ) : null}
      <ExpenseDialog
        expense={forExpenseDialog(expense)}
        categories={categories}
        payees={payees}
        projects={projects}
        fixedProjectId={fixedProjectId}
      />
      <ConfirmActionButton
        icon="trash"
        title="Eliminar egreso"
        description={`¿Eliminar "${expense.description}" por ${formatCurrency(expense.amount.toString())}? El comprobante se conserva en Drive.`}
        confirmLabel="Eliminar"
        destructive
        successMessage="Egreso eliminado."
        action={deleteExpense.bind(null, expense.id)}
      />
    </div>
  );

  const meta = (expense: ExpenseRow) =>
    [
      expense.payee?.name,
      expense.payeeKind ? PAYEE_KIND_LABELS[expense.payeeKind] : null,
      expense.category?.name,
      expense.recurrencePeriod ? `Recurrente ${expense.recurrencePeriod}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const receipt = (expense: ExpenseRow) =>
    expense.receiptFile || expense.receiptNumber ? (
      <span className="inline-flex items-center gap-1">
        {expense.receiptFile ? (
          <Link
            href={`/admin/drive/download/${expense.receiptFile.id}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Paperclip className="size-3" />
            {expense.receiptNumber ?? "Comprobante"}
          </Link>
        ) : (
          expense.receiptNumber
        )}
      </span>
    ) : (
      <span className="opacity-40">—</span>
    );

  return (
    <>
      {/* Mobile: cards */}
      <div className="divide-y md:hidden">
        {expenses.map((expense) => (
          <div key={expense.id} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{expense.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {meta(expense) || "Sin beneficiario ni categoría"}
                </p>
                {showProject && expense.project ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {expense.project.name}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">
                  {formatCurrency(expense.amount.toString())}
                </p>
                <StatusBadge value={expense.status} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {formatDateOnly(expense.expenseDate)}
                {expense.paidAt ? ` · pagado ${formatDateOnly(expense.paidAt)}` : ""}
              </p>
              {actions(expense)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Concepto</TableHead>
              <TableHead>Beneficiario / categoría</TableHead>
              {showProject ? <TableHead>Proyecto</TableHead> : null}
              <TableHead>Fecha</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Tributario</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="pr-6 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="max-w-56 pl-6">
                  <p className="truncate font-medium">{expense.description}</p>
                  <StatusBadge value={expense.status} />
                </TableCell>
                <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                  {meta(expense) || <span className="opacity-40">—</span>}
                </TableCell>
                {showProject ? (
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.project ? (
                      <Link
                        href={`/admin/proyectos/${expense.project.id}`}
                        className="hover:underline"
                      >
                        {expense.project.name}
                      </Link>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateOnly(expense.expenseDate)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {expense.paidAt ? formatDateOnly(expense.paidAt) : "—"}
                  {expense.method ? (
                    <span className="block text-xs">{expense.method}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {receipt(expense)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {TAX_TREATMENT_LABELS[expense.taxTreatment]}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(expense.amount.toString())}
                  {expense.taxAmount ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      IVA {formatCurrency(expense.taxAmount.toString())}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="pr-6">{actions(expense)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
