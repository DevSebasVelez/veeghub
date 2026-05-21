import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Plus,
  Users,
} from "lucide-react";

import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";

const PRIORITY_STYLES: Record<string, string> = {
  URGENT:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  MEDIUM:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export default async function AdminPage() {
  const now = new Date();

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
      where: { status: { not: "PAID" } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.invoice.count({ where: { status: "READY_TO_SEND" } }),
    prisma.credential.count(),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { project: { select: { name: true } } },
    }),
    prisma.receivable.findMany({
      where: { status: { not: "PAID" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  const outstandingReceivables = upcomingReceivables.filter(
    (item) => Number(item.amount) - Number(item.paidAmount) > 0,
  );
  const receivableBalance = receivables.reduce(
    (total, item) => total + Number(item.amount) - Number(item.paidAmount),
    0,
  );
  const overdueCount = outstandingReceivables.filter(
    (item) => item.dueDate && item.dueDate < now,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vista operativa de proyectos, cobros, facturas y accesos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/reportes">
              <BarChart3 size={15} />
              Reportes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/proyectos">
              <Plus size={15} />
              Nuevo proyecto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          href="/admin/clientes"
          icon={Users}
          accent="text-blue-500"
          label="Clientes"
          value={String(clients)}
          helper="registrados en el sistema"
        />
        <StatCard
          href="/admin/proyectos"
          icon={BriefcaseBusiness}
          accent="text-emerald-500"
          label="Proyectos activos"
          value={String(activeProjects)}
          helper="en desarrollo actualmente"
        />
        <StatCard
          href="/admin/tareas"
          icon={Clock3}
          accent="text-amber-500"
          label="Tareas abiertas"
          value={String(openTasks)}
          helper="pendientes de completar"
        />
        <StatCard
          href="/admin/finanzas"
          icon={BadgeDollarSign}
          accent="text-cyan-500"
          label="Por cobrar"
          value={formatCurrency(receivableBalance)}
          helper={
            overdueCount > 0
              ? `${overdueCount} hito${overdueCount !== 1 ? "s" : ""} vencido${overdueCount !== 1 ? "s" : ""}`
              : "saldo total pendiente"
          }
          alert={overdueCount > 0}
        />
        <StatCard
          href="/admin/facturas"
          icon={FileText}
          accent="text-indigo-500"
          label="Facturas por enviar"
          value={String(pendingInvoices)}
          helper="listas para entregar al cliente"
        />
        <StatCard
          href="/admin/credenciales"
          icon={KeyRound}
          accent="text-slate-500"
          label="Credenciales"
          value={String(credentials)}
          helper="accesos almacenados"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Tareas próximas</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lo que necesita atención primero.
              </p>
            </div>
            <Link
              href="/admin/tareas"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentTasks.length ? (
              recentTasks.map((task) => {
                const isOverdue = task.dueDate && task.dueDate < now;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <AlertTriangle
                            size={13}
                            className="shrink-0 text-red-500"
                          />
                        )}
                        <span className="truncate text-sm font-medium">
                          {task.title}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {task.project.name}
                        {task.dueDate && (
                          <>
                            {" · "}
                            <span className={isOverdue ? "text-red-500" : ""}>
                              {formatDateOnly(task.dueDate)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.LOW}`}
                    >
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState text="No hay tareas abiertas." />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Cuentas por cobrar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hitos pendientes más próximos a vencer.
              </p>
            </div>
            <Link
              href="/admin/finanzas"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-border">
            {outstandingReceivables.length ? (
              outstandingReceivables.slice(0, 6).map((item) => {
                const balance = Number(item.amount) - Number(item.paidAmount);
                const isOverdue = item.dueDate && item.dueDate < now;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <AlertTriangle
                            size={13}
                            className="shrink-0 text-red-500"
                          />
                        )}
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.client.name}
                        {item.project ? ` · ${item.project.name}` : ""}
                        {item.dueDate && (
                          <>
                            {" · "}
                            <span className={isOverdue ? "text-red-500" : ""}>
                              {formatDateOnly(item.dueDate)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(balance)}
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState text="No hay cobros pendientes." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  accent,
  label,
  value,
  helper,
  alert = false,
}: {
  href: string;
  icon: React.ElementType;
  accent: string;
  label: string;
  value: string;
  helper: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div className="rounded-xl border border-border bg-card p-4 transition-colors group-hover:bg-accent/40">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <Icon size={16} className={accent} />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p
          className={`mt-1 text-xs ${alert ? "font-medium text-red-500" : "text-muted-foreground"}`}
        >
          {alert && <AlertTriangle size={11} className="mr-1 inline" />}
          {helper}
        </p>
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
      <CheckCircle2 size={15} />
      {text}
    </div>
  );
}
