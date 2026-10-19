import { Suspense } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

import { FilterBar, withAll } from "@/components/admin/finance/filter-bar";
import { FinanceTabs } from "@/components/admin/finance/finance-tabs";
import { Figure, FigureKindBadge } from "@/components/admin/finance/figure";
import { getFinancialSummary } from "@/lib/admin/queries/financial-summary";
import { cleanParam, resolvePeriod } from "@/lib/admin/finance/period";
import prisma from "@/lib/db/prisma";
import { CardGridSkeleton, TableSkeleton } from "@/components/admin/skeletons";
import type { SummaryFigures } from "@/lib/admin/finance/calc";
import { formatCurrency, formatDateOnly } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FinancialSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    cliente?: string;
    proyecto?: string;
  }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
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
          {formatDateOnly(period.from)} – {formatDateOnly(period.to)}
        </p>
      </div>

      <FinanceTabs active="resumen" />

      <FilterBar
        // Remount on navigation so the inputs follow the URL.
        key={`filters-${JSON.stringify(params)}`}
        basePath="/admin/finanzas/resumen"
        from={period.fromKey}
        to={period.toKey}
        selects={[
          {
            name: "cliente",
            label: "Cliente",
            value: params.cliente ?? "all",
            options: withAll(
              "Todos",
              clients.map((c) => ({ value: c.id, label: c.name })),
            ),
          },
          {
            name: "proyecto",
            label: "Proyecto",
            value: params.proyecto ?? "all",
            options: withAll(
              "Todos",
              projects.map((p) => ({ value: p.id, label: p.name })),
            ),
          },
        ]}
      />

      {/* Keyed by the filters so changing them shows the skeleton at once. */}
      <Suspense
        key={`body-${JSON.stringify(params)}`}
        fallback={
          <div className="space-y-6">
            <CardGridSkeleton count={4} />
            <TableSkeleton rows={6} cols={9} />
          </div>
        }
      >
        <SummaryBody params={params} />
      </Suspense>
    </div>
  );
}

async function SummaryBody({
  params,
}: {
  params: { desde?: string; hasta?: string; cliente?: string; proyecto?: string };
}) {
  const { summary, undatedInvoices, filters } = await getFinancialSummary({
    desde: params.desde,
    hasta: params.hasta,
    cliente: cleanParam(params.cliente),
    proyecto: cleanParam(params.proyecto),
  });
  const o = summary.overall;

  const isEmptyRow = (f: SummaryFigures) =>
    [
      f.invoiced,
      f.collected,
      f.receivableBalance,
      f.expensesRegistered,
      f.expensesPaidInPeriod,
      f.withheld,
    ].every((v) => v === "0.00");
  const rows = summary.rows.filter(
    (r) => r.hasBudget || !isEmptyRow(r.figures),
  );

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Control administrativo</AlertTitle>
        <AlertDescription>
          Estas cifras salen de lo que registraste en la aplicación. No
          reemplazan al SRI, a tu contador ni a una declaración oficial. El
          margen es una estimación, no una utilidad neta definitiva.
          {filters.clientId
            ? " Con filtro de cliente, los egresos sin proyecto no se incluyen."
            : ""}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Figure
              label="Valor contratado"
              value={o.contracted}
              kind="reference"
              hint="Presupuesto de los proyectos listados; no depende del período."
            />
            <Figure
              label="Valor facturado"
              value={o.invoiced}
              kind="real"
              hint={`Facturas emitidas en el período, sin canceladas. Incluye IVA. Base: ${formatCurrency(o.invoicedBase)}.`}
            />
            <Figure
              label="Valor cobrado"
              value={o.collected}
              kind="real"
              hint="Pagos de clientes recibidos en el período."
              emphasis
            />
            <Figure
              label="Saldo pendiente de clientes"
              value={o.receivableBalance}
              kind="pending"
              hint="Lo que falta cobrar de los hitos abiertos, a hoy."
            />
            <Figure
              label="Retenciones recibidas"
              value={o.withheld}
              kind="real"
              hint={`IVA ${formatCurrency(o.withheldVat)} · Renta ${formatCurrency(o.withheldIncome)}. No es efectivo cobrado.`}
            />
            <Figure
              label="Saldo pendiente neto de retenciones"
              value={o.receivableBalanceNetOfWithholdings}
              kind="estimate"
              hint="Saldo menos retenciones de facturas abiertas, si el cliente las descuenta del pago."
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Egresos</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Figure
              label="Egresos registrados"
              value={o.expensesRegistered}
              kind="real"
              hint="Con fecha de gasto en el período, pagados o no."
              emphasis
            />
            <Figure
              label="De ellos, pagados"
              value={o.expensesRegisteredPaid}
              kind="real"
            />
            <Figure
              label="De ellos, pendientes"
              value={o.expensesPending}
              kind="pending"
              hint="Obligaciones por pagar; todavía no salen de caja."
            />
            <Figure
              label="Pagos a colaboradores"
              value={o.collaboratorPayments}
              kind="real"
              hint="Parte de los egresos registrados clasificados como colaborador. Ya incluidos arriba."
            />
            {summary.byCategory.length ? (
              <div className="space-y-1 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Por categoría (desglose de los registrados)
                </p>
                {summary.byCategory.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="tabular-nums">
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Caja y resultado</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Figure label="Cobros efectivos" value={o.collected} kind="real" />
            <Figure
              label="Pagos efectivos"
              value={o.expensesPaidInPeriod}
              kind="real"
              hint="Egresos pagados en el período, según su fecha de pago."
            />
            <Figure
              label="Flujo neto de caja"
              value={o.netCashFlow}
              kind="real"
              hint="Cobros efectivos − pagos efectivos. No descuenta impuestos por pagar."
              emphasis
            />
            <Figure
              label="Margen estimado"
              value={o.marginEstimate}
              kind="estimate"
              hint={
                o.marginIncomplete
                  ? `Base facturada − egresos registrados. ${o.invoicesWithoutBreakdown} factura(s) sin desglose de IVA: se usó su total, el margen puede estar sobrestimado.`
                  : "Base facturada (sin IVA) − egresos registrados del período."
              }
              emphasis
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Impuestos registrados</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Figure
              label="IVA en facturas emitidas"
              value={o.invoicedTax}
              kind="real"
              hint="Según el IVA registrado en cada factura. No es dinero disponible."
            />
            <Figure
              label="IVA en comprobantes de egresos"
              value={o.expensesTax}
              kind="real"
              hint="Solo de los egresos donde registraste el IVA."
            />
            <Figure
              label="Retenciones de IVA recibidas"
              value={o.withheldVat}
              kind="real"
            />
            <Figure
              label="Retenciones de Renta recibidas"
              value={o.withheldIncome}
              kind="real"
            />
            <p className="py-2 text-xs text-muted-foreground">
              No se calcula una obligación tributaria: faltan datos que solo
              tu declaración y tu contador confirman.{" "}
              <Link href="/admin/finanzas/impuestos" className="text-primary hover:underline">
                Configuración tributaria
              </Link>
              {undatedInvoices > 0
                ? ` · ${undatedInvoices} factura(s) sin fecha de emisión quedan fuera de los períodos.`
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rentabilidad por proyecto</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada movimiento aparece en una sola fila; el total se calcula sobre
            los movimientos, no sumando filas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Sin movimientos en el período.
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {rows.map((row) => (
                  <div key={row.key} className="space-y-1 px-4 py-3 text-sm">
                    <ProjectName row={row} />
                    <MobileLine label="Contratado" value={row.hasBudget ? row.figures.contracted : null} />
                    <MobileLine label="Facturado" value={row.figures.invoiced} />
                    <MobileLine label="Cobrado" value={row.figures.collected} />
                    <MobileLine label="Saldo clientes" value={row.figures.receivableBalance} />
                    <MobileLine label="Egresos registrados" value={row.figures.expensesRegistered} />
                    <MobileLine label="Egresos pendientes" value={row.figures.expensesPending} />
                    <MobileLine label="Margen estimado" value={row.figures.marginEstimate} strong />
                    <MobileLine label="Flujo neto" value={row.figures.netCashFlow} />
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Proyecto</TableHead>
                      <TableHead className="text-right">Contratado</TableHead>
                      <TableHead className="text-right">Facturado</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="text-right">Saldo clientes</TableHead>
                      <TableHead className="text-right">Egresos reg.</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Margen <FigureKindBadge kind="estimate" />
                        </span>
                      </TableHead>
                      <TableHead className="pr-6 text-right">Flujo neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="pl-6">
                          <ProjectName row={row} />
                        </TableCell>
                        <Money value={row.hasBudget ? row.figures.contracted : null} />
                        <Money value={row.figures.invoiced} />
                        <Money value={row.figures.collected} />
                        <Money value={row.figures.receivableBalance} />
                        <Money value={row.figures.expensesRegistered} />
                        <Money value={row.figures.expensesPending} />
                        <Money
                          value={row.figures.marginEstimate}
                          strong
                          note={row.figures.marginIncomplete ? "*" : undefined}
                        />
                        <Money value={row.figures.netCashFlow} className="pr-6" />
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell className="pl-6">Total</TableCell>
                      <Money value={o.contracted} />
                      <Money value={o.invoiced} />
                      <Money value={o.collected} />
                      <Money value={o.receivableBalance} />
                      <Money value={o.expensesRegistered} />
                      <Money value={o.expensesPending} />
                      <Money value={o.marginEstimate} strong note={o.marginIncomplete ? "*" : undefined} />
                      <Money value={o.netCashFlow} className="pr-6" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {o.marginIncomplete ? (
                <p className="px-6 py-3 text-xs text-muted-foreground">
                  * Incluye facturas sin desglose de IVA; el margen usa su total.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectName({
  row,
}: {
  row: { projectId: string | null; name: string; clientName: string | null };
}) {
  return (
    <div className="min-w-0">
      {row.projectId ? (
        <Link
          href={`/admin/proyectos/${row.projectId}`}
          className="font-medium hover:underline"
        >
          {row.name}
        </Link>
      ) : (
        <span className="font-medium italic text-muted-foreground">{row.name}</span>
      )}
      {row.clientName ? (
        <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
      ) : null}
    </div>
  );
}

function Money({
  value,
  strong,
  note,
  className,
}: {
  value: string | null;
  strong?: boolean;
  note?: string;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        strong && "font-semibold",
        value?.startsWith("-") && "text-destructive",
        className,
      )}
    >
      {value === null ? <span className="opacity-40">—</span> : formatCurrency(value)}
      {note}
    </TableCell>
  );
}

function MobileLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | null;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong && "font-semibold",
          value?.startsWith("-") && "text-destructive",
        )}
      >
        {value === null ? "—" : formatCurrency(value)}
      </span>
    </div>
  );
}
