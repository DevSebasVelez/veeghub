import { Suspense } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgePercent,
  Briefcase,
  CircleDollarSign,
  Clock,
  FileText,
  Hourglass,
  Landmark,
  Receipt,
  Scale,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { CategoryIcon } from "@/components/admin/finance/category-icon";
import {
  ExportButton,
  FilterPopover,
} from "@/components/admin/finance/filter-popover";
import { FinanceTabs } from "@/components/admin/finance/finance-tabs";
import { InfoTip } from "@/components/admin/finance/info-tip";
import {
  DeltaPill,
  IconBadge,
  KpiCard,
  type Tone,
} from "@/components/admin/finance/kpi-card";
import { withAll } from "@/components/admin/finance/labels";
import { MoneyFlowChart } from "@/components/admin/finance/money-flow-chart";
import { MonthPicker } from "@/components/admin/finance/month-picker";
import {
  CardGridSkeleton,
  StatCardsSkeleton,
} from "@/components/admin/skeletons";
import {
  getFinancialSummary,
  getMonthlyCashSeries,
} from "@/lib/admin/queries/financial-summary";
import { fromCents, toCents } from "@/lib/admin/finance/money";
import { MONTH_SHORT, monthLabel, parseMonthKey } from "@/lib/admin/finance/month";
import {
  cleanParam,
  queryString,
  resolveMonth,
} from "@/lib/admin/finance/period";
import { formatCurrency } from "@/lib/admin/format";
import prisma from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Params = { mes?: string; cliente?: string; proyecto?: string };
type Month = ReturnType<typeof resolveMonth>;

export default async function FinancialSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const month = resolveMonth(params);
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Resumen financiero
        </h1>
        <p className="text-sm text-muted-foreground">
          Cómo le fue a tu negocio en {month.label.toLowerCase()}.
        </p>
      </div>

      <FinanceTabs active="resumen" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month.key} current={month.current} />
        <div className="flex items-center gap-2">
          <FilterPopover
            fields={[
              {
                name: "cliente",
                label: "Cliente",
                value: params.cliente,
                options: withAll(
                  "Todos los clientes",
                  clients.map((c) => ({ value: c.id, label: c.name })),
                ),
              },
              {
                name: "proyecto",
                label: "Proyecto",
                value: params.proyecto,
                options: withAll(
                  "Todos los proyectos",
                  projects.map((p) => ({ value: p.id, label: p.name })),
                ),
              },
            ]}
          />
          <ExportButton
            href={`/admin/finanzas/resumen/exportar${queryString({
              desde: month.fromKey,
              hasta: month.toKey,
              cliente: params.cliente,
              proyecto: params.proyecto,
            })}`}
          />
        </div>
      </div>

      {/* Keyed by month and filters: each change shows the skeleton at once. */}
      <Suspense
        key={`body-${JSON.stringify(params)}`}
        fallback={
          <div className="space-y-4">
            <StatCardsSkeleton
              count={4}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            />
            <CardGridSkeleton count={3} />
          </div>
        }
      >
        <SummaryBody params={params} month={month} />
      </Suspense>
    </div>
  );
}

async function SummaryBody({ params, month }: { params: Params; month: Month }) {
  const cliente = cleanParam(params.cliente);
  const proyecto = cleanParam(params.proyecto);

  const [{ summary, undatedInvoices, filters }, series] = await Promise.all([
    getFinancialSummary({
      desde: month.fromKey,
      hasta: month.toKey,
      cliente,
      proyecto,
    }),
    getMonthlyCashSeries({ endKey: month.key, months: 6, cliente, proyecto }),
  ]);

  const o = summary.overall;
  const now = series.at(-1)!;
  const before = series.at(-2)!;
  const vs = `vs ${monthLabel(month.previous, true)}`;
  const net = now.cobradoCents - now.pagadoCents;
  const netBefore = before.cobradoCents - before.pagadoCents;
  const selectedYear = parseMonthKey(month.key).year;

  const chart = series.map((p) => {
    const { year, monthIndex } = parseMonthKey(p.key);
    return {
      key: p.key,
      label: `${MONTH_SHORT[monthIndex]}${year !== selectedYear ? ` ${String(year).slice(2)}` : ""}`,
      cobrado: p.cobradoCents / 100,
      pagado: p.pagadoCents / 100,
    };
  });

  const rows = summary.rows.filter((r) =>
    [
      r.figures.invoiced,
      r.figures.collected,
      r.figures.expensesRegistered,
      r.figures.expensesPaidInPeriod,
    ].some((v) => v !== "0.00"),
  );

  return (
    <div className="space-y-4">
      {/* 1. The four numbers that answer "how did the month go" */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={ArrowDownToLine}
          tone="blue"
          label="Cobrado"
          value={formatCurrency(fromCents(now.cobradoCents))}
          info="Dinero que tus clientes te pagaron este mes."
          footer={
            <DeltaPill
              label={vs}
              delta={{
                current: now.cobradoCents,
                previous: before.cobradoCents,
                upIsGood: true,
              }}
            />
          }
        />
        <KpiCard
          icon={ArrowUpFromLine}
          tone="orange"
          label="Pagado"
          value={formatCurrency(fromCents(now.pagadoCents))}
          info="Gastos y pagos a personas que ya salieron de tu cuenta este mes."
          footer={
            <DeltaPill
              label={vs}
              delta={{
                current: now.pagadoCents,
                previous: before.pagadoCents,
                upIsGood: false,
              }}
            />
          }
        />
        <KpiCard
          icon={Scale}
          tone={net < 0 ? "rose" : "emerald"}
          label="Te quedó"
          value={formatCurrency(fromCents(net))}
          info="Cobrado menos pagado: el dinero real que entró neto este mes. No descuenta impuestos por pagar."
          emphasis
          footer={
            <DeltaPill
              label={vs}
              delta={{ current: net, previous: netBefore, upIsGood: true }}
            />
          }
        />
        <KpiCard
          icon={Hourglass}
          tone="amber"
          label="Te deben"
          value={formatCurrency(o.receivableBalance)}
          info="Lo que tus clientes aún te deben de hitos abiertos, a hoy (no solo de este mes)."
          href="/admin/finanzas"
          footer={
            <span className="text-xs text-muted-foreground">
              Saldo de clientes a hoy
            </span>
          }
        />
      </div>

      {/* 2. Trend and where the money went */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Entradas y salidas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Últimos 6 meses · cobrado vs pagado, por fecha de pago
            </p>
          </CardHeader>
          <CardContent>
            <MoneyFlowChart data={chart} selected={month.key} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">¿En qué se fue el dinero?</CardTitle>
            <p className="text-xs text-muted-foreground">
              Egresos registrados en {month.label.toLowerCase()} por categoría
            </p>
          </CardHeader>
          <CardContent>
            <CategoryBars
              categories={summary.byCategory}
              total={o.expensesRegistered}
            />
          </CardContent>
        </Card>
      </div>

      {/* 3. The detail, grouped by what it is about */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard icon={FileText} tone="violet" title="Facturación">
          <DetailRow
            icon={FileText}
            label="Facturado"
            info="Facturas emitidas este mes (sin las canceladas), con IVA."
            value={o.invoiced}
          />
          <DetailRow
            icon={CircleDollarSign}
            label="Base sin IVA"
            info="Lo facturado sin el IVA: es tu ingreso real por el trabajo."
            value={o.invoicedBase}
          />
          <DetailRow
            icon={BadgePercent}
            label="Retenciones recibidas"
            info="Lo que tus clientes retuvieron y pagaron al SRI a tu nombre. No es dinero en tu cuenta: es un crédito para tu declaración."
            value={o.withheld}
          />
          <DetailRow
            icon={Wallet}
            label="Margen estimado"
            info={
              o.marginIncomplete
                ? `Base facturada menos egresos registrados. ${o.invoicesWithoutBreakdown} factura(s) sin desglose de IVA: se usó su total, así que puede estar sobrestimado.`
                : "Base facturada menos egresos registrados del mes. Es una estimación, no tu utilidad neta."
            }
            value={o.marginEstimate}
            tag="Estimación"
            strong
          />
        </DetailCard>

        <DetailCard icon={Receipt} tone="orange" title="Egresos del mes">
          <DetailRow
            icon={Receipt}
            label="Registrados"
            info="Todo lo que tiene fecha de gasto este mes, pagado o no."
            value={o.expensesRegistered}
            strong
          />
          <DetailRow
            icon={ArrowUpFromLine}
            label="Ya pagados"
            value={o.expensesRegisteredPaid}
          />
          <DetailRow
            icon={Clock}
            label="Por pagar"
            info="Registrados pero aún no pagados. No salen de tu caja hasta que los pagues."
            value={o.expensesPending}
            tag={o.expensesPending !== "0.00" ? "Pendiente" : undefined}
          />
          <DetailRow
            icon={Users}
            label="A colaboradores"
            info="Parte de los registrados clasificados como pago a colaborador. Ya está incluida arriba."
            value={o.collaboratorPayments}
          />
        </DetailCard>

        <DetailCard icon={Landmark} tone="rose" title="Impuestos registrados">
          <DetailRow
            icon={FileText}
            label="IVA en tus facturas"
            info="IVA que cobraste en tus facturas. No es dinero tuyo disponible: se declara."
            value={o.invoicedTax}
          />
          <DetailRow
            icon={Receipt}
            label="IVA en tus compras"
            info="IVA de los comprobantes de egresos donde lo registraste."
            value={o.expensesTax}
          />
          <DetailRow
            icon={BadgePercent}
            label="Retención de IVA"
            value={o.withheldVat}
          />
          <DetailRow
            icon={BadgePercent}
            label="Retención de Renta"
            value={o.withheldIncome}
          />
          <p className="pt-1 text-xs text-muted-foreground">
            Datos de referencia, no un cálculo de impuestos a pagar.{" "}
            <Link
              href="/admin/finanzas/impuestos"
              className="font-medium text-primary hover:underline"
            >
              Configuración
            </Link>
          </p>
        </DetailCard>
      </div>

      {/* 4. Projects */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rentabilidad por proyecto</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lo facturado (sin IVA) frente a lo gastado en cada proyecto este mes
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Briefcase className="size-8 text-muted-foreground/50" />
              Sin movimientos de proyectos en {month.label.toLowerCase()}.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <ProjectRow key={row.key} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Control administrativo con lo que registraste en la app. No reemplaza
          al SRI ni a tu contador.
          {filters.clientId
            ? " Con filtro de cliente no se incluyen egresos sin proyecto."
            : ""}
          {undatedInvoices > 0
            ? ` ${undatedInvoices} factura(s) sin fecha de emisión no aparecen en ningún mes.`
            : ""}
        </span>
      </p>
    </div>
  );
}

function DetailCard({
  icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <IconBadge icon={icon} tone={tone} size="sm" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  info,
  value,
  tag,
  strong = false,
}: {
  icon: LucideIcon;
  label: string;
  info?: string;
  value: string;
  tag?: "Estimación" | "Pendiente";
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", strong && "font-medium")}>{label}</span>
        {info ? <InfoTip text={info} /> : null}
        {tag ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              tag === "Estimación"
                ? "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
            )}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "font-semibold" : "font-medium",
          value.startsWith("-") && "text-rose-600 dark:text-rose-400",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/**
 * Horizontal bars for one series (expenses), so a single hue: the length
 * carries the amount, the icon and name the category, and the value sits at
 * the end of each row as text. Past five categories the rest fold into Otras.
 */
function CategoryBars({
  categories,
  total,
}: {
  categories: Array<{ name: string; amount: string }>;
  total: string;
}) {
  const totalCents = toCents(total);
  if (totalCents === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Receipt className="size-8 text-muted-foreground/50" />
        Sin egresos este mes.
      </div>
    );
  }

  const top = categories.slice(0, 5);
  const restCents = categories
    .slice(5)
    .reduce((s, c) => s + toCents(c.amount), 0);
  const list = restCents
    ? [...top, { name: "Otras", amount: fromCents(restCents) }]
    : top;
  const max = Math.max(...list.map((c) => toCents(c.amount)));

  return (
    <ul className="space-y-3">
      {list.map((c) => {
        const cents = toCents(c.amount);
        const share = Math.round((cents / totalCents) * 100);
        return (
          <li key={c.name} className="flex items-center gap-3">
            <CategoryIcon name={c.name === "Otras" ? null : c.name} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatCurrency(c.amount)}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${c.name}: ${share}% de los egresos del mes`}
              >
                <div
                  className="h-full rounded-full bg-[#eb6834] dark:bg-[#d95926]"
                  style={{ width: `${Math.max(4, (cents / max) * 100)}%` }}
                />
              </div>
            </div>
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {share}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type SummaryRow = Awaited<
  ReturnType<typeof getFinancialSummary>
>["summary"]["rows"][number];

function ProjectRow({ row }: { row: SummaryRow }) {
  const f = row.figures;
  const base = toCents(f.invoicedBase);
  const spent = toCents(f.expensesRegistered);
  const margin = toCents(f.marginEstimate);
  // Share of what was billed that went to costs; capped for the bar.
  const ratio = base > 0 ? Math.min(1, spent / base) : spent > 0 ? 1 : 0;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.3fr)_8rem]">
      <IconBadge
        icon={Briefcase}
        tone={row.projectId ? "slate" : "amber"}
        size="sm"
      />
      <div className="min-w-0">
        {row.projectId ? (
          <Link
            href={`/admin/proyectos/${row.projectId}`}
            className="block truncate font-medium hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          <span className="block truncate font-medium text-muted-foreground">
            {row.name}
          </span>
        )}
        <p className="truncate text-xs text-muted-foreground">
          {row.clientName ?? "Gastos generales"}
        </p>
      </div>

      <div className="col-span-3 min-w-0 space-y-1.5 lg:col-span-1">
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Facturado{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(f.invoicedBase)}
            </span>
          </span>
          <span>
            Gastado{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(f.expensesRegistered)}
            </span>
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#2a78d6]/15 dark:bg-[#3987e5]/20"
          role="img"
          aria-label={`Gastado ${Math.round(ratio * 100)}% de lo facturado`}
        >
          <div
            className="h-full rounded-full bg-[#eb6834] dark:bg-[#d95926]"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Cobrado {formatCurrency(f.collected)}
          {f.receivableBalance !== "0.00"
            ? ` · te deben ${formatCurrency(f.receivableBalance)}`
            : ""}
        </p>
      </div>

      <div className="col-start-3 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
        <p
          className={cn(
            "font-semibold tabular-nums",
            margin < 0 && "text-rose-600 dark:text-rose-400",
          )}
        >
          {formatCurrency(f.marginEstimate)}
        </p>
        <p className="text-xs text-muted-foreground">
          margen{f.marginIncomplete ? " aprox." : ""}
        </p>
      </div>
    </li>
  );
}
