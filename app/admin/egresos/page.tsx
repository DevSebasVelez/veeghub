import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Receipt } from "lucide-react";

import {
  deleteExpenseCategory,
  setExpenseCategoryArchived,
} from "@/lib/admin/actions/expense-categories/actions";
import { deletePayee } from "@/lib/admin/actions/payees/actions";
import { deleteRecurringExpense } from "@/lib/admin/actions/recurring-expenses/actions";
import { AreaNav } from "@/components/admin/area-nav";
import { ExpenseCategoryDialog } from "@/components/admin/dialogs/expense-category-dialog";
import { ExpenseDialog } from "@/components/admin/dialogs/expense-dialog";
import { PayeeDialog } from "@/components/admin/dialogs/payee-dialog";
import { RecurringExpenseDialog } from "@/components/admin/dialogs/recurring-expense-dialog";
import { ConfirmActionButton } from "@/components/admin/finance/confirm-action-button";
import { ExpenseList } from "@/components/admin/finance/expense-list";
import {
  ExportButton,
  FilterPopover,
} from "@/components/admin/finance/filter-popover";
import { DeltaPill, KpiCard } from "@/components/admin/finance/kpi-card";
import {
  FREQUENCY_LABELS,
  PAYEE_KIND_LABELS,
  labelOptions,
  withAll,
} from "@/components/admin/finance/labels";
import { MonthPicker } from "@/components/admin/finance/month-picker";
import {
  GenerateRecurringButton,
  RecurringActiveSwitch,
} from "@/components/admin/finance/recurring-controls";
import { SegmentedLinks } from "@/components/admin/finance/segmented-links";
import { Pagination } from "@/components/admin/pagination";
import {
  ListGroupSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";
import {
  getCategoriesWithUsage,
  getExpenseFormOptions,
  getExpenseTotals,
  getExpensesPageData,
  getOlderPendingByMonth,
  getPayeesWithUsage,
  getRecurringExpenses,
} from "@/lib/admin/queries/expenses";
import {
  forPayeeDialog,
  forRecurringExpenseDialog,
} from "@/lib/admin/serialize";
import { monthBounds, monthLabel } from "@/lib/admin/finance/month";
import {
  cleanParam,
  queryString,
  resolveMonth,
} from "@/lib/admin/finance/period";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Params = {
  section?: string;
  page?: string;
  mes?: string;
  estado?: string;
  categoria?: string;
  proyecto?: string;
  clasificacion?: string;
};

type Options = Awaited<ReturnType<typeof getExpenseFormOptions>>;

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
  const month = resolveMonth(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Gastos del negocio y pagos a personas, mes a mes.
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
        <ExpensesToolbar params={params} month={month} options={options} />
      ) : null}

      {/* Keyed by the query so every month, tab or filter change shows the
          skeleton right away instead of freezing on the previous view. */}
      <Suspense
        key={`body-${JSON.stringify(params)}`}
        fallback={
          section === "egresos" ? (
            <div className="space-y-4">
              <StatCardsSkeleton
                count={3}
                className="grid gap-4 sm:grid-cols-3"
              />
              <TableSkeleton rows={8} cols={6} />
            </div>
          ) : (
            <ListGroupSkeleton groups={1} rowsPerGroup={6} />
          )
        }
      >
        {section === "egresos" ? (
          <ExpensesSection params={params} month={month} options={options} />
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

/** Href for this page keeping the month and filters, overriding `changes`. */
function egresosHref(params: Params, changes: Partial<Params>) {
  const next = { ...params, ...changes, section: undefined, page: undefined };
  return `/admin/egresos${queryString(next)}`;
}

function ExpensesToolbar({
  params,
  month,
  options,
}: {
  params: Params;
  month: ReturnType<typeof resolveMonth>;
  options: Options;
}) {
  const estado = cleanParam(params.estado);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month.key} current={month.current} />
        <SegmentedLinks
          label="Estado"
          items={[
            {
              key: "all",
              label: "Todos",
              active: !estado,
              href: egresosHref(params, { estado: undefined }),
            },
            {
              key: "PENDING",
              label: "Pendientes",
              active: estado === "PENDING",
              href: egresosHref(params, { estado: "PENDING" }),
            },
            {
              key: "PAID",
              label: "Pagados",
              active: estado === "PAID",
              href: egresosHref(params, { estado: "PAID" }),
            },
          ]}
        />
      </div>
      <div className="flex items-center gap-2">
        <FilterPopover
          fields={[
            {
              name: "categoria",
              label: "Categoría",
              value: params.categoria,
              options: withAll("Todas", [
                { value: "none", label: "Sin categoría" },
                ...options.categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]),
            },
            {
              name: "proyecto",
              label: "Proyecto",
              value: params.proyecto,
              options: withAll("Todos", [
                { value: "none", label: "Sin proyecto" },
                ...options.projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]),
            },
            {
              name: "clasificacion",
              label: "Clasificación del pago",
              value: params.clasificacion,
              options: withAll("Todas", labelOptions(PAYEE_KIND_LABELS)),
            },
          ]}
        />
        <ExportButton
          href={`/admin/egresos/exportar${queryString({
            desde: month.fromKey,
            hasta: month.toKey,
            estado: params.estado,
            categoria: params.categoria,
            proyecto: params.proyecto,
            clasificacion: params.clasificacion,
          })}`}
        />
      </div>
    </div>
  );
}

async function ExpensesSection({
  params,
  month,
  options,
}: {
  params: Params;
  month: ReturnType<typeof resolveMonth>;
  options: Options;
}) {
  const filters = {
    page: params.page,
    desde: month.fromKey,
    hasta: month.toKey,
    estado: cleanParam(params.estado),
    categoria: cleanParam(params.categoria),
    proyecto: cleanParam(params.proyecto),
    clasificacion: cleanParam(params.clasificacion),
  };
  const previous = monthBounds(month.previous);

  const [data, before, older] = await Promise.all([
    getExpensesPageData(filters),
    getExpenseTotals({
      ...filters,
      desde: previous.fromKey,
      hasta: previous.toKey,
    }),
    getOlderPendingByMonth(month.from),
  ]);
  const t = data.totals;
  const vs = `vs ${monthLabel(month.previous, true)}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
        <KpiCard
          icon={Receipt}
          tone="blue"
          label="Total del mes"
          value={formatCurrency(t.registered)}
          info="Todo lo registrado con fecha de este mes, ya pagado o por pagar."
          footer={
            <DeltaPill
              label={vs}
              delta={{
                current: t.registeredCents,
                previous: before.registeredCents,
                upIsGood: false,
              }}
            />
          }
        />
        <KpiCard
          icon={CheckCircle2}
          tone="emerald"
          label="Pagado"
          value={formatCurrency(t.paid)}
          info="Lo que ya salió de tu cuenta."
          footer={
            <span className="text-xs text-muted-foreground">
              {t.paidCount} egreso{t.paidCount !== 1 ? "s" : ""}
            </span>
          }
        />
        <KpiCard
          icon={Clock}
          tone="amber"
          label="Por pagar"
          value={formatCurrency(t.pending)}
          info="Registrado pero todavía no pagado. No afecta tu caja hasta que lo pagues."
          footer={
            <span className="text-xs text-muted-foreground">
              {t.pendingCount} pendiente{t.pendingCount !== 1 ? "s" : ""}
            </span>
          }
        />
      </div>

      {older.count > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium">
                {older.count} egreso{older.count !== 1 ? "s" : ""} pendiente
                {older.count !== 1 ? "s" : ""} de meses anteriores
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(older.amount)} todavía por pagar.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {older.months.slice(0, 4).map((m) => (
              <Link
                key={m.key}
                href={egresosHref(params, { mes: m.key, estado: "PENDING" })}
                scroll={false}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                {monthLabel(m.key, true)} · {m.count}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <ExpenseList
            expenses={data.expenses}
            categories={options.categories}
            payees={options.payees}
            projects={options.projects}
            emptyText={`No hay egresos ${
              params.estado === "PENDING"
                ? "pendientes "
                : params.estado === "PAID"
                  ? "pagados "
                  : ""
            }en ${month.label.toLowerCase()}.`}
          />
          {data.total > data.pageSize ? (
            <div className="px-4 pb-4">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                basePath="/admin/egresos"
                searchParams={{
                  mes: params.mes,
                  estado: params.estado,
                  categoria: params.categoria,
                  proyecto: params.proyecto,
                  clasificacion: params.clasificacion,
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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
            egresos vencidos hasta este mes de las plantillas activas, una sola
            vez por período.
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
                    {!t.active ? (
                      <Badge variant="outline">Pausada</Badge>
                    ) : null}
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
                    <Badge variant="outline">
                      {PAYEE_KIND_LABELS[payee.kind]}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[payee.taxId, payee.email, payee.phone]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
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
            Ejemplos editables. Archiva las que no uses; los egresos históricos
            conservan su categoría.
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
                  <p
                    className={
                      category.archived
                        ? "truncate font-medium text-muted-foreground line-through"
                        : "truncate font-medium"
                    }
                  >
                    {category.name}
                  </p>
                  {category.archived ? (
                    <Badge variant="outline">Archivada</Badge>
                  ) : null}
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
                  title={
                    category.archived
                      ? "Restaurar categoría"
                      : "Archivar categoría"
                  }
                  description={
                    category.archived
                      ? `"${category.name}" volverá a estar disponible para nuevos egresos.`
                      : `"${category.name}" dejará de ofrecerse para nuevos egresos. Los existentes no cambian.`
                  }
                  confirmLabel={category.archived ? "Restaurar" : "Archivar"}
                  successMessage={
                    category.archived
                      ? "Categoría restaurada."
                      : "Categoría archivada."
                  }
                  action={setExpenseCategoryArchived.bind(
                    null,
                    category.id,
                    !category.archived,
                  )}
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
