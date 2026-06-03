import Link from "next/link";
import { Trash2 } from "lucide-react";

import { deletePayment } from "@/app/admin/actions";
import { ConfirmationDialog } from "@/components/admin/confirmation-dialog";
import { EditPaymentDialog } from "@/components/admin/dialogs/receivable-dialog";
import prisma from "@/lib/db/prisma";
import {
  dateOnlyParts,
  formatCurrency,
  formatDateOnly,
} from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export async function PagosSection({ yearParam }: { yearParam?: string }) {
  const currentYear = new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam) : currentYear;

  const [paymentHistory, availableYears] = await Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: new Date(`${selectedYear}-01-01`),
          lt: new Date(`${selectedYear + 1}-01-01`),
        },
      },
      orderBy: { paidAt: "desc" },
      include: {
        receivable: {
          select: {
            id: true,
            title: true,
            client: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      select: { paidAt: true },
      orderBy: { paidAt: "asc" },
      distinct: ["paidAt"],
    }),
  ]);

  const years = [
    ...new Set(availableYears.map((p) => dateOnlyParts(p.paidAt).year)),
  ].sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const paymentsByMonth: Record<
    string,
    { key: string; total: number; payments: typeof paymentHistory }
  > = {};
  for (const payment of paymentHistory) {
    const { year, month } = dateOnlyParts(payment.paidAt);
    const key = `${MONTH_NAMES[month]} ${year}`;
    if (!paymentsByMonth[key]) {
      paymentsByMonth[key] = { key, total: 0, payments: [] };
    }
    paymentsByMonth[key].payments.push(payment);
    paymentsByMonth[key].total += Number(payment.amount);
  }
  const monthGroups = Object.values(paymentsByMonth);
  const yearTotal = paymentHistory.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      {/* Year filter + total */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/admin/finanzas?section=pagos&year=${y}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                y === selectedYear
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {y}
            </Link>
          ))}
        </div>
        {yearTotal > 0 ? (
          <div className="text-sm text-muted-foreground">
            Total {selectedYear}:{" "}
            <span className="font-semibold text-emerald-600">
              {formatCurrency(yearTotal.toFixed(2))}
            </span>
          </div>
        ) : null}
      </div>

      {monthGroups.length === 0 ? (
        <Card className="rounded-lg">
          <CardContent className="py-16 text-center text-muted-foreground">
            No hay pagos registrados en {selectedYear}.
          </CardContent>
        </Card>
      ) : (
        monthGroups.map((group) => (
          <Card key={group.key} className="rounded-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{group.key}</CardTitle>
                <span className="text-sm font-semibold text-emerald-600">
                  {formatCurrency(group.total.toFixed(2))}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile: cards */}
              <div className="divide-y md:hidden">
                {group.payments.map((payment) => (
                  <div key={payment.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {payment.receivable.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {payment.receivable.project?.name
                            ? `${payment.receivable.project.name} · `
                            : ""}
                          {payment.receivable.client.name}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-emerald-600">
                        {formatCurrency(payment.amount.toString())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDateOnly(payment.paidAt)}
                        {payment.method ? ` · ${payment.method}` : ""}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <EditPaymentDialog
                          payment={{
                            id: payment.id,
                            amount: payment.amount.toString(),
                            paidAt: payment.paidAt.toISOString(),
                            method: payment.method,
                            reference: payment.reference,
                            notes: payment.notes,
                            receivableTitle: payment.receivable.title,
                          }}
                        />
                        <DeletePaymentButton
                          id={payment.id}
                          amount={formatCurrency(payment.amount.toString())}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Hito</TableHead>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="pr-6 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="pl-6 font-medium">
                          {payment.receivable.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.receivable.project?.name ?? (
                            <span className="italic opacity-40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.receivable.client.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.method ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatCurrency(payment.amount.toString())}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateOnly(payment.paidAt)}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditPaymentDialog
                              payment={{
                                id: payment.id,
                                amount: payment.amount.toString(),
                                paidAt: payment.paidAt.toISOString(),
                                method: payment.method,
                                reference: payment.reference,
                                notes: payment.notes,
                                receivableTitle: payment.receivable.title,
                              }}
                            />
                            <DeletePaymentButton
                              id={payment.id}
                              amount={formatCurrency(payment.amount.toString())}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function DeletePaymentButton({ id, amount }: { id: string; amount: string }) {
  return (
    <ConfirmationDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      }
      title="Eliminar pago"
      description={`¿Eliminar el pago de ${amount}? El saldo del hito se recalculará automáticamente.`}
      confirmLabel="Eliminar"
      destructive
      onConfirm={async () => {
        "use server";
        await deletePayment(id);
      }}
    />
  );
}
