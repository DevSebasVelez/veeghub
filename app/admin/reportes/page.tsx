import { startOfMonth, subMonths, format, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
} from "lucide-react";

import { CashFlowChart, MonthlyBillingChart } from "@/components/admin/charts";
import { StatusBadge } from "@/components/admin/status-badge";
import { ReportFilter } from "@/app/admin/reportes/report-month-filter";
import { getReportsData } from "@/lib/admin/queries/reports";
import {
  dateOnlyParts,
  formatCurrency,
  formatDateOnly,
  monthKeyUTC,
} from "@/lib/admin/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const selectedYear = params.year ? Number(params.year) : now.getFullYear();
  const selectedMonth = params.month
    ? Number(params.month)
    : now.getMonth() + 1;

  const selectedDate = new Date(selectedYear, selectedMonth - 1, 1);
  const selectedStart = startOfMonth(selectedDate);
  const selectedEnd = endOfMonth(selectedDate);

  const months = Array.from({ length: 12 }, (_, i) =>
    startOfMonth(subMonths(selectedDate, 11 - i)),
  );

  const {
    earliestInvoice,
    invoices,
    payments,
    receivables,
    selectedInvoices,
    selectedPayments,
    totalPending,
    openReceivablesCount,
    overdueReceivablesCount,
    criticalReceivables,
  } = await getReportsData({
    firstChartMonth: months[0],
    selectedStart,
    selectedEnd,
    now,
  });

  const startYear = earliestInvoice?.issueDate
    ? dateOnlyParts(earliestInvoice.issueDate).year
    : now.getFullYear();
  const currentYear = now.getFullYear();
  const availableYears = Array.from(
    { length: currentYear - startYear + 1 },
    (_, i) => startYear + i,
  );
  if (!availableYears.includes(currentYear)) availableYears.push(currentYear);

  const monthlyData = months.map((date) => {
    const key = format(date, "yyyy-MM");
    const monthInvoices = invoices.filter((inv) =>
      inv.issueDate ? monthKeyUTC(inv.issueDate) === key : false,
    );
    const monthPayments = payments.filter((p) => monthKeyUTC(p.paidAt) === key);
    const monthReceivables = receivables.filter(
      (r) => format(r.createdAt, "yyyy-MM") === key,
    );
    const invoiced = monthInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );
    const collected = monthPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const pending = monthReceivables.reduce(
      (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
      0,
    );
    return {
      month: format(date, "MMM", { locale: es }),
      invoiced,
      collected,
      pending,
    };
  });

  const selectedInvoiced = selectedInvoices.reduce(
    (sum, inv) => sum + Number(inv.total),
    0,
  );
  const selectedCollected = selectedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const periodLabel = format(selectedDate, "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="text-blue-500" size={22} />
            Reportes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Facturación, cobros y cuentas por cobrar del período.
          </p>
        </div>
        <ReportFilter
          year={selectedYear}
          month={selectedMonth}
          availableYears={availableYears}
        />
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          Período seleccionado:{" "}
          <span className="capitalize text-muted-foreground">
            {periodLabel}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Los gráficos muestran los 12 meses anteriores al período.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Facturado en el mes"
          value={formatCurrency(selectedInvoiced)}
          helper={`${selectedInvoices.length} facturas emitidas`}
          icon={FileText}
          accent="text-blue-500"
        />
        <StatCard
          label="Cobrado en el mes"
          value={formatCurrency(selectedCollected)}
          helper={`${selectedPayments.length} pagos registrados`}
          icon={CheckCircle2}
          accent="text-emerald-500"
        />
        <StatCard
          label="Total por cobrar"
          value={formatCurrency(totalPending)}
          helper={`${openReceivablesCount} hitos abiertos`}
          icon={Clock}
          accent="text-amber-500"
        />
        <StatCard
          label="Hitos vencidos"
          value={`${overdueReceivablesCount}`}
          helper="Requieren atención inmediata"
          icon={AlertTriangle}
          accent="text-red-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Facturado vs cobrado"
          description="Comparativo mensual de los últimos 12 meses."
        >
          <MonthlyBillingChart data={monthlyData} />
        </ChartPanel>
        <ChartPanel
          title="Flujo de cobros"
          description="Cobros recibidos contra pendiente generado."
        >
          <CashFlowChart data={monthlyData} />
        </ChartPanel>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <DollarSign size={15} className="text-amber-500" />
          <div>
            <h2 className="text-sm font-semibold">
              Cuentas por cobrar críticas
            </h2>
            <p className="text-xs text-muted-foreground">
              Pendientes abiertos ordenados por fecha de vencimiento.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Hito</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead className="pr-5">Vence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criticalReceivables.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-5">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.project?.name ?? "Sin proyecto"}
                    </div>
                  </TableCell>
                  <TableCell>{item.client.name}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatCurrency(
                      Number(item.amount) - Number(item.paidAmount),
                    )}
                  </TableCell>
                  <TableCell className="pr-5">
                    {formatDateOnly(item.dueDate)}
                  </TableCell>
                </TableRow>
              ))}
              {criticalReceivables.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay cuentas por cobrar pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Facturas del mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              Emitidas en {periodLabel}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="pr-5">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="pl-5 font-mono text-xs">
                      {invoice.invoiceNumber ?? "Sin número"}
                    </TableCell>
                    <TableCell>{invoice.client.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(invoice.total.toString())}
                    </TableCell>
                    <TableCell className="pr-5">
                      <StatusBadge value={invoice.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {selectedInvoices.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No hay facturas en este período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Cobros del mes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              Pagos registrados en {periodLabel}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Hito</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead className="pr-5">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="pl-5">
                      {payment.receivable.title}
                    </TableCell>
                    <TableCell>{payment.receivable.client.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(payment.amount.toString())}
                    </TableCell>
                    <TableCell className="pr-5">
                      {formatDateOnly(payment.paidAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {selectedPayments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No hay cobros en este período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon size={16} className={accent} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
