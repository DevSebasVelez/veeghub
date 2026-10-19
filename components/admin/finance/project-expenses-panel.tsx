import { ExpenseDialog } from "@/components/admin/dialogs/expense-dialog";
import { ExpenseList } from "@/components/admin/finance/expense-list";
import { Figure } from "@/components/admin/finance/figure";
import { getExpenseFormOptions } from "@/lib/admin/queries/expenses";
import { getFinancialSummary } from "@/lib/admin/queries/financial-summary";
import { formatCurrency } from "@/lib/admin/format";
import prisma from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Expenses tab of the project page. Async on its own so it can stream behind a
 * Suspense boundary: AreaTabs keeps every panel loaded for instant switching,
 * and without the boundary these queries would hold up the whole page even
 * when another tab is open.
 */
export async function ProjectExpensesPanel({ projectId }: { projectId: string }) {
  const [expenses, options, finance] = await Promise.all([
    prisma.expense.findMany({
      where: { projectId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        receiptFile: { select: { id: true, name: true } },
      },
    }),
    getExpenseFormOptions(),
    // Whole life of the project, not a period.
    getFinancialSummary({ proyecto: projectId, desde: "2000-01-01", hasta: "2100-12-31" }),
  ]);
  const figures =
    finance.summary.rows.find((r) => r.projectId === projectId)?.figures ??
    finance.summary.overall;

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Resultado del proyecto</CardTitle>
          <p className="text-xs text-muted-foreground">
            Toda la vida del proyecto. Estimación administrativa, no
            utilidad neta definitiva.
          </p>
        </CardHeader>
        <CardContent className="grid gap-x-8 sm:grid-cols-2">
          <Figure label="Contratado" value={figures.contracted} kind="reference" />
          <Figure label="Facturado" value={figures.invoiced} kind="real" hint={`Base sin IVA: ${formatCurrency(figures.invoicedBase)}`} />
          <Figure label="Cobrado" value={figures.collected} kind="real" />
          <Figure label="Saldo de cliente" value={figures.receivableBalance} kind="pending" />
          <Figure label="Egresos registrados" value={figures.expensesRegistered} kind="real" hint={`Pendientes: ${formatCurrency(figures.expensesPending)} · Colaboradores: ${formatCurrency(figures.collaboratorPayments)}`} />
          <Figure label="Flujo neto de caja" value={figures.netCashFlow} kind="real" />
          <Figure
            label="Margen estimado"
            value={figures.marginEstimate}
            kind="estimate"
            hint={figures.marginIncomplete ? "Hay facturas sin desglose de IVA; se usó su total." : "Base facturada − egresos registrados."}
            emphasis
          />
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Egresos</CardTitle>
            <ExpenseDialog
              mode="create"
              fixedProjectId={projectId}
              categories={options.categories}
              payees={options.payees}
              projects={options.projects}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ExpenseList
            expenses={expenses}
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
            showProject={false}
            fixedProjectId={projectId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
