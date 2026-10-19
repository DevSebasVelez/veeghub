import {
  deleteExpenseCategory,
  setExpenseCategoryArchived,
} from "@/lib/admin/actions/expense-categories/actions";
import { deletePayee } from "@/lib/admin/actions/payees/actions";
import { deleteRecurringExpense } from "@/lib/admin/actions/recurring-expenses/actions";
import { RecurringExpenseDialog } from "@/components/admin/dialogs/recurring-expense-dialog";
import {
  GenerateRecurringButton,
  RecurringActiveSwitch,
} from "@/components/admin/finance/recurring-controls";
import { Suspense } from "react";

import { AreaNav } from "@/components/admin/area-nav";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { ExpenseCategoryDialog } from "@/components/admin/dialogs/expense-category-dialog";
import { ExpenseDialog } from "@/components/admin/dialogs/expense-dialog";
import { PayeeDialog } from "@/components/admin/dialogs/payee-dialog";
import { ExpenseList } from "@/components/admin/finance/expense-list";
import { FilterBar, withAll } from "@/components/admin/finance/filter-bar";
import {
  EXPENSE_STATUS_LABELS,
  FREQUENCY_LABELS,
  PAYEE_KIND_LABELS,
  labelOptions,
} from "@/components/admin/finance/labels";
import { Pagination } from "@/components/admin/pagination";
import {
  ListGroupSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";
import {
  getCategoriesWithUsage,
  getExpenseFormOptions,
  getExpensesPageData,
  getPayeesWithUsage,
  getRecurringExpenses,
} from "@/lib/admin/queries/expenses";
import { forPayeeDialog, forRecurringExpenseDialog } from "@/lib/admin/serialize";
import {
  cleanParam,
  queryString,
  resolvePeriod,
} from "@/lib/admin/finance/period";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Params = {
  section?: string;
  page?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  categoria?: string;
  proyecto?: string;
  clasificacion?: string;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const section =
    params.section === "recurrentes" ||
    params.section === "beneficiarios" ||
    params.section === "categorias"
      ? params.section
      : "egresos";

  const options = await getExpenseFormOptions();
  const period = resolvePeriod(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Gastos del negocio y pagos a personas, pendientes o pagados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExpenseDialog
            mode="create"
            triggerLabel="Pago a persona"
            defaultPayeeKind="COLLABORATOR"
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
          />
          <ExpenseDialog
            mode="create"
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
          />
        </div>
      </div>

      <AreaNav
        active={section}
        items={[
          { key: "egresos", label: "Egresos", href: "/admin/egresos" },
          {
            key: "recurrentes",
            label: "Recurrentes",
            href: "/admin/egresos?section=recurrentes",
          },
          {
            key: "beneficiarios",
            label: "Beneficiarios",
            count: options.payees.length,
            href: "/admin/egresos?section=beneficiarios",
          },
          {
            key: "categorias",
            label: "Categorías",
            count: options.categories.length,
            href: "/admin/egresos?section=categorias",
          },
        ]}
      />

      {section === "egresos" ? (
        <FilterBar
          // Remount on navigation so "Limpiar" and back/forward reset the
          // uncontrolled inputs to what the URL says.
          key={`filters-${JSON.stringify(params)}`}
          basePath="/admin/egresos"
          exportHref={`/admin/egresos/exportar${queryString({
            desde: period.fromKey,
            hasta: period.toKey,
            estado: params.estado,
            categoria: params.categoria,
            proyecto: params.proyecto,
            clasificacion: params.clasificacion,
          })}`}
          from={period.fromKey}
          to={period.toKey}
          selects={[
            {
              name: "estado",
              label: "Estado",
              value: params.estado ?? "all",
              options: withAll("Todos", labelOptions(EXPENSE_STATUS_LABELS)),
            },
            {
              name: "categoria",
              label: "Categoría",
              value: params.categoria ?? "all",
              options: withAll("Todas", [
                { value: "none", label: "Sin categoría" },
                ...options.categories.map((c) => ({ value: c.id, label: c.name })),
              ]),
            },
            {
              name: "proyecto",
              label: "Proyecto",
              value: params.proyecto ?? "all",
              options: withAll("Todos", [
                { value: "none", label: "Sin proyecto" },
                ...options.projects.map((p) => ({ value: p.id, label: p.name })),
              ]),
            },
            {
              name: "clasificacion",
              label: "Clasificación",
              value: params.clasificacion ?? "all",
              options: withAll("Todas", labelOptions(PAYEE_KIND_LABELS)),
            },
          ]}
        />
      ) : null}

      {/* Keyed by the query so every section or filter change shows the
          skeleton right away instead of freezing on the previous view. */}
      <Suspense
        key={`body-${JSON.stringify(params)}`}
        fallback={
          section === "egresos" ? (
            <div className="space-y-4">
              <StatCardsSkeleton count={3} className="grid gap-4 sm:grid-cols-3" />
              <TableSkeleton rows={8} cols={8} />
            </div>
          ) : (
            <ListGroupSkeleton groups={1} rowsPerGroup={6} />
          )
        }
      >
        {section === "egresos" ? (
          <ExpensesSection params={params} options={options} />
        ) : section === "recurrentes" ? (
          <RecurringSection options={options} />
        ) : section === "beneficiarios" ? (
          <PayeesSection />
        ) : (
          <CategoriesSection />
        )}
      </Suspense>
    </div>
  );
}

async function ExpensesSection({
  params,
  options,
}: {
  params: Params;
  options: Awaited<ReturnType<typeof getExpenseFormOptions>>;
}) {
  const filters = {
    page: params.page,
    desde: params.desde,
    hasta: params.hasta,
    estado: cleanParam(params.estado),
    categoria: cleanParam(params.categoria),
    proyecto: cleanParam(params.proyecto),
    clasificacion: cleanParam(params.clasificacion),
  };
  const data = await getExpensesPageData(filters);

  return (
    <div className="space-y-4">

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Registrados" value={data.totals.registered} hint="Pagados + pendientes del período" />
        <Stat label="Pagados" value={data.totals.paid} hint="Ya salieron de caja" tone="text-emerald-600" />
        <Stat label="Pendientes" value={data.totals.pending} hint="Por pagar; no afectan la caja aún" tone="text-amber-600" />
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-0">
          <ExpenseList
            expenses={data.expenses}
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
          />
          <div className="px-4 pb-4">
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              basePath="/admin/egresos"
              searchParams={{
                desde: params.desde,
                hasta: params.hasta,
                estado: params.estado,
                categoria: params.categoria,
                proyecto: params.proyecto,
                clasificacion: params.clasificacion,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{formatCurrency(value)}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

async function RecurringSection({
  options,
}: {
  options: Awaited<ReturnType<typeof getExpenseFormOptions>>;
}) {
  const templates = await getRecurringExpenses();
  const missing = templates.reduce((sum, t) => sum + t.missing, 0);

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Egresos recurrentes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nada se registra solo: &quot;Generar pendientes&quot; crea los
            egresos vencidos hasta este mes de las plantillas activas, una
            sola vez por período.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <GenerateRecurringButton missing={missing} />
          <RecurringExpenseDialog
            mode="create"
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {templates.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aún no hay plantillas. Úsalas para suscripciones, hosting u otros
            pagos que se repiten.
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={
                        t.active
                          ? "truncate font-medium"
                          : "truncate font-medium text-muted-foreground"
                      }
                    >
                      {t.description}
                    </p>
                    <Badge variant="outline">
                      {FREQUENCY_LABELS[t.frequency]} · día {t.dayOfMonth}
                    </Badge>
                    {!t.active ? <Badge variant="outline">Pausada</Badge> : null}
                    {t.missing > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                        {t.missing} por generar
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[t.payee?.name, t.category?.name, t.project?.name]
                      .filter(Boolean)
                      .join(" · ") || "Sin beneficiario ni categoría"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.generatedCount} generado(s)
                    {t.nextDue ? ` · próximo ${formatDateOnly(t.nextDue)}` : ""}
                    {t.endDate ? ` · hasta ${formatDateOnly(t.endDate)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className="font-semibold">
                    {formatCurrency(t.amount.toString())}
                  </span>
                  <div className="flex items-center gap-1">
                    <RecurringActiveSwitch
                      id={t.id}
                      active={t.active}
                      label={`Activar ${t.description}`}
                    />
                    <RecurringExpenseDialog
                      template={forRecurringExpenseDialog(t)}
                      categories={options.categories}
                      payees={options.payees}
                      projects={options.projects}
                    />
                    <ConfirmActionButton
                      icon="trash"
                      title="Eliminar plantilla"
                      description={`¿Eliminar "${t.description}"? Los ${t.generatedCount} egreso(s) ya generados se conservan.`}
                      confirmLabel="Eliminar"
                      destructive
                      successMessage="Plantilla eliminada."
                      action={deleteRecurringExpense.bind(null, t.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function PayeesSection() {
  const payees = await getPayeesWithUsage();

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Beneficiarios</CardTitle>
        <PayeeDialog mode="create" />
      </CardHeader>
      <CardContent className="p-0">
        {payees.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aún no hay beneficiarios.
          </div>
        ) : (
          <div className="divide-y">
            {payees.map((payee) => (
              <div
                key={payee.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{payee.name}</p>
                    <Badge variant="outline">{PAYEE_KIND_LABELS[payee.kind]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[payee.taxId, payee.email, payee.phone].filter(Boolean).join(" · ") ||
                      "Sin datos de contacto"}
                    {" · "}
                    {payee._count.expenses} egreso(s)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <PayeeDialog payee={forPayeeDialog(payee)} />
                  {payee._count.expenses === 0 ? (
                    <ConfirmActionButton
                      icon="trash"
                      title="Eliminar beneficiario"
                      description={`¿Eliminar a ${payee.name}?`}
                      confirmLabel="Eliminar"
                      destructive
                      successMessage="Beneficiario eliminado."
                      action={deletePayee.bind(null, payee.id)}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function CategoriesSection() {
  const categories = await getCategoriesWithUsage();

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Categorías</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ejemplos editables. Archiva las que no uses; los egresos
            históricos conservan su categoría.
          </p>
        </div>
        <ExpenseCategoryDialog mode="create" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={category.archived ? "truncate font-medium text-muted-foreground line-through" : "truncate font-medium"}>
                    {category.name}
                  </p>
                  {category.archived ? <Badge variant="outline">Archivada</Badge> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {category.description ? `${category.description} · ` : ""}
                  {category._count.expenses} egreso(s)
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ExpenseCategoryDialog
                  category={{
                    id: category.id,
                    name: category.name,
                    description: category.description,
                  }}
                />
                <ConfirmActionButton
                  icon={category.archived ? "restore" : "archive"}
                  title={category.archived ? "Restaurar categoría" : "Archivar categoría"}
                  description={
                    category.archived
                      ? `"${category.name}" volverá a estar disponible para nuevos egresos.`
                      : `"${category.name}" dejará de ofrecerse para nuevos egresos. Los existentes no cambian.`
                  }
                  confirmLabel={category.archived ? "Restaurar" : "Archivar"}
                  successMessage={category.archived ? "Categoría restaurada." : "Categoría archivada."}
                  action={setExpenseCategoryArchived.bind(null, category.id, !category.archived)}
                />
                {category._count.expenses === 0 ? (
                  <ConfirmActionButton
                    icon="trash"
                    title="Eliminar categoría"
                    description={`¿Eliminar "${category.name}"? No tiene egresos asociados.`}
                    confirmLabel="Eliminar"
                    destructive
                    successMessage="Categoría eliminada."
                    action={deleteExpenseCategory.bind(null, category.id)}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
