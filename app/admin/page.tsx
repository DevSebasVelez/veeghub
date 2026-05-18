import Link from "next/link";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Users,
} from "lucide-react";

import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminPage() {
  const [
    clients,
    activeProjects,
    openTasks,
    receivables,
    pendingInvoices,
    credentials,
    recentTasks,
    upcomingReceivables,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.receivable.findMany({
      where: { status: { in: ["PLANNED", "INVOICED", "PARTIALLY_PAID", "OVERDUE"] } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.invoice.count({ where: { status: "READY_TO_SEND" } }),
    prisma.credential.count(),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
      include: { project: { select: { name: true } } },
    }),
    prisma.receivable.findMany({
      where: { status: { in: ["PLANNED", "INVOICED", "PARTIALLY_PAID", "OVERDUE"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);
  const receivableBalance = receivables.reduce(
    (total, item) => total + Number(item.amount) - Number(item.paidAmount),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Vista operativa de proyectos, cobros, facturas y accesos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/proyectos">Nuevo proyecto</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Clientes" value={clients} />
        <MetricCard icon={BriefcaseBusiness} label="Proyectos activos" value={activeProjects} />
        <MetricCard icon={Clock3} label="Tareas abiertas" value={openTasks} />
        <MetricCard
          icon={BadgeDollarSign}
          label="Por cobrar"
          value={formatCurrency(receivableBalance)}
        />
        <MetricCard icon={FileText} label="Facturas por enviar" value={pendingInvoices} />
        <MetricCard icon={KeyRound} label="Credenciales guardadas" value={credentials} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Tareas próximas</CardTitle>
            <CardDescription>Lo que necesita atención primero.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTasks.length ? (
              recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.project.name} · {formatDate(task.dueDate)}
                    </div>
                  </div>
                  <Badge variant="outline">{task.priority}</Badge>
                </div>
              ))
            ) : (
              <EmptyState text="No hay tareas abiertas." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Cuentas por cobrar</CardTitle>
            <CardDescription>Hitos y pagos pendientes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingReceivables.length ? (
              upcomingReceivables.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.client.name}
                      {item.project ? ` · ${item.project.name}` : ""} ·{" "}
                      {formatDate(item.dueDate)}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium">
                    {formatCurrency(Number(item.amount) - Number(item.paidAmount))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No hay cobros pendientes." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <CheckCircle2 className="size-4" />
      {text}
    </div>
  );
}
