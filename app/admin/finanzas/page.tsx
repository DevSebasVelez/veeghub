import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import {
  PaymentDialog,
  ReceivableDialog,
} from "@/components/admin/dialogs/receivable-dialog";
import { HitosSection } from "@/components/admin/finance/hitos-section";
import { PagosSection } from "@/components/admin/finance/pagos-section";
import { ListGroupSkeleton, TableSkeleton } from "@/components/admin/skeletons";
import prisma from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [
    clients,
    projects,
    pendingForPayment,
    pendingAgg,
    collectedAgg,
    overdueCount,
  ] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.receivable.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.receivable.aggregate({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.receivable.count({
      where: {
        status: { notIn: ["PAID", "CANCELLED"] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  const totalPending =
    Number(pendingAgg._sum.amount ?? 0) -
    Number(pendingAgg._sum.paidAmount ?? 0);
  const totalCollected = Number(collectedAgg._sum.amount ?? 0);

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
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por cobrar</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPending.toFixed(2))}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo pendiente en hitos activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total cobrado</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalCollected.toFixed(2))}
            </div>
            <p className="text-xs text-muted-foreground">
              Suma de todos los pagos registrados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Hitos con fecha de vencimiento pasada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section tabs */}
      <div className="flex w-fit gap-1 rounded-lg border bg-background p-1">
        <Link
          href="/admin/finanzas"
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            !isPagosSection
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Hitos
        </Link>
        <Link
          href="/admin/finanzas?section=pagos"
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            isPagosSection
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Pagos
        </Link>
      </div>

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
