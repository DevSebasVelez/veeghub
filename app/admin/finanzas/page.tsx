import { Suspense } from "react";
import { AlertCircle, ArrowDownToLine, Hourglass } from "lucide-react";

import {
  PaymentDialog,
  ReceivableDialog,
} from "@/components/admin/dialogs/receivable-dialog";
import { FinanceTabs } from "@/components/admin/finance/finance-tabs";
import { KpiCard } from "@/components/admin/finance/kpi-card";
import { HitosSection } from "@/components/admin/finance/hitos-section";
import { PagosSection } from "@/components/admin/finance/pagos-section";
import { ListGroupSkeleton, TableSkeleton } from "@/components/admin/skeletons";
import { getFinanceHeaderData } from "@/lib/admin/queries/finance";
import { formatCurrency } from "@/lib/admin/format";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    section?: string;
    year?: string;
  }>;
}) {
  const { page: pageParam, tab, section, year: yearParam } = await searchParams;

  const showAll = tab === "todos";
  const isPagosSection = section === "pagos";

  // Lightweight data for the header dialogs + summary cards.
  const {
    clients,
    projects,
    pendingForPayment,
    overdueCount,
    totalPending,
    totalCollected,
  } = await getFinanceHeaderData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Hitos de cobro, pagos parciales y cuentas por cobrar.
          </p>
        </div>
        <div className="flex gap-2">
          <PaymentDialog
            receivables={pendingForPayment.map((r) => ({
              id: r.id,
              title: r.title,
              project: r.project,
              client: r.client,
            }))}
          />
          <ReceivableDialog
            clients={clients}
            projects={projects}
            mode="create"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
        <KpiCard
          icon={Hourglass}
          tone="amber"
          label="Por cobrar"
          value={formatCurrency(totalPending.toFixed(2))}
          info="Saldo pendiente de los hitos activos, ya descontadas las retenciones aplicadas."
          footer={
            <span className="text-xs text-muted-foreground">
              Saldo en hitos activos
            </span>
          }
        />
        <KpiCard
          icon={ArrowDownToLine}
          tone="blue"
          label="Total cobrado"
          value={formatCurrency(totalCollected.toFixed(2))}
          info="Suma de todos los pagos de clientes registrados."
          footer={
            <span className="text-xs text-muted-foreground">
              Histórico de pagos
            </span>
          }
        />
        <KpiCard
          icon={AlertCircle}
          tone={overdueCount > 0 ? "rose" : "slate"}
          label="Vencidos"
          value={String(overdueCount)}
          footer={
            <span className="text-xs text-muted-foreground">
              Hitos con fecha pasada
            </span>
          }
        />
      </div>

      {/* Section tabs */}
      <FinanceTabs active={isPagosSection ? "pagos" : "hitos"} />

      {/* Active section — streamed with a skeleton on every tab/filter change */}
      {isPagosSection ? (
        <Suspense
          key={`pagos-${yearParam ?? ""}`}
          fallback={<ListGroupSkeleton groups={2} rowsPerGroup={4} />}
        >
          <PagosSection yearParam={yearParam} />
        </Suspense>
      ) : (
        <Suspense
          key={`hitos-${showAll ? "todos" : "pend"}-${pageParam ?? "1"}`}
          fallback={<TableSkeleton rows={8} cols={7} />}
        >
          <HitosSection pageParam={pageParam} showAll={showAll} />
        </Suspense>
      )}
    </div>
  );
}
