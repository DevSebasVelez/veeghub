import Link from "next/link";
import { FileText, Inbox, Paperclip } from "lucide-react";

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
import { CategoryIcon } from "@/components/admin/finance/category-icon";
import { forExpenseDialog } from "@/lib/admin/serialize";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

type ExpenseRow = Parameters<typeof forExpenseDialog>[0] & {
  category: { id: string; name: string } | null;
  payee: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  receiptFile: { id: string; name: string } | null;
  recurrencePeriod?: string | null;
};

const dayMonth = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "pagado 4 oct · Transferencia", or just the method when paid that day. */
function paidDetail(expense: ExpenseRow) {
  const sameDay =
    expense.paidAt &&
    expense.paidAt.getTime() === expense.expenseDate.getTime();
  return [
    expense.paidAt && !sameDay
      ? `pagado ${dayMonth.format(expense.paidAt)}`
      : "pagado",
    expense.method,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Status as a soft pill with a dot, so it reads without relying on color. */
function StatusPill({ status }: { status: string }) {
  const paid = status === "PAID";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        paid
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          paid ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      {paid ? "Pagado" : "Pendiente"}
    </span>
  );
}

export function ExpenseList({
  expenses,
  categories,
  payees,
  projects,
  showProject = true,
  fixedProjectId,
  emptyText = "No hay egresos registrados con estos filtros.",
}: {
  expenses: ExpenseRow[];
  categories: ExpenseCategoryOption[];
  payees: PayeeOption[];
  projects: EntityOption[];
  showProject?: boolean;
  fixedProjectId?: string;
  emptyText?: string;
}) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <Inbox className="size-8 text-muted-foreground/50" />
        {emptyText}
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
      expense.category?.name ?? "Sin categoría",
      showProject ? expense.project?.name : null,
      expense.recurrencePeriod ? `Recurrente ${expense.recurrencePeriod}` : null,
      expense.taxTreatment !== "UNCLASSIFIED"
        ? TAX_TREATMENT_LABELS[expense.taxTreatment]
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <ul className="divide-y">
      {expenses.map((expense) => (
        <li
          key={expense.id}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_8.5rem_6.5rem_7rem_12rem]"
        >
          <CategoryIcon name={expense.category?.name} />

          <div className="min-w-0">
            <p className="truncate font-medium">{expense.description}</p>
            <p className="truncate text-xs text-muted-foreground">
              {meta(expense)}
            </p>
            {expense.receiptFile || expense.receiptNumber ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3" />
                    {expense.receiptNumber}
                  </span>
                )}
              </p>
            ) : null}
          </div>

          {/* Mobile: amount + status on the right of the first line */}
          <div className="text-right md:hidden">
            <p className="font-semibold">
              {formatCurrency(expense.amount.toString())}
            </p>
            <StatusPill status={expense.status} />
          </div>

          <div className="hidden min-w-0 text-sm text-muted-foreground md:block">
            <p>{formatDateOnly(expense.expenseDate)}</p>
            {expense.status === "PAID" ? (
              <p className="truncate text-xs">{paidDetail(expense)}</p>
            ) : null}
          </div>

          <div className="hidden md:block">
            <StatusPill status={expense.status} />
          </div>

          <div className="hidden text-right md:block">
            <p className="font-semibold tabular-nums">
              {formatCurrency(expense.amount.toString())}
            </p>
            {expense.taxAmount ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                IVA {formatCurrency(expense.taxAmount.toString())}
              </p>
            ) : null}
          </div>

          <div className="col-span-3 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
            <p className="min-w-0 truncate text-xs text-muted-foreground md:hidden">
              {formatDateOnly(expense.expenseDate)}
              {expense.status === "PAID" ? ` · ${paidDetail(expense)}` : ""}
            </p>
            {actions(expense)}
          </div>
        </li>
      ))}
    </ul>
  );
}
