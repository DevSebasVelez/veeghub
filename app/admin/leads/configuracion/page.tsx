import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, X } from "lucide-react";

import { getMetaIntegrationStatus } from "@/lib/admin/queries/meta-integration";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatDate } from "@/lib/admin/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EVENT_STYLES: Record<string, string> = {
  PROCESSED: "text-emerald-600 dark:text-emerald-400",
  PENDING: "text-amber-600 dark:text-amber-400",
  IGNORED: "text-muted-foreground",
  FAILED: "text-destructive",
};

export default async function MetaConfigPage() {
  await requireAdmin();

  const { checks, events, page } = await getMetaIntegrationStatus();
  const allOk = checks.every((check) => check.ok);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/leads"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Leads
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Integración con Meta
        </h1>
        <p className="text-sm text-muted-foreground">
          Estado en vivo de la conexión que trae los leads de tus campañas.
        </p>
      </div>

      <Card
        className={`rounded-lg ${
          allOk
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
        }`}
      >
        <CardContent className="flex items-center gap-3 p-4">
          {allOk ? (
            <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
          )}
          <div className="text-sm">
            {allOk
              ? "Todo conectado. Los leads de Meta deberían entrar solos."
              : "Hay algo que revisar. Mirá los puntos marcados abajo."}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Verificaciones</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {checks.map((check) => (
            <div key={check.label} className="flex gap-3 px-5 py-3">
              <div
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                  check.ok
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {check.ok ? (
                  <Check className="size-3" />
                ) : (
                  <X className="size-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{check.label}</div>
                <div className="break-all text-xs text-muted-foreground">
                  {check.detail}
                </div>
                {check.hint ? (
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {check.hint}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Últimos eventos recibidos de Meta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {page?.lastEventAt ? (
            <p className="px-5 pb-2 text-xs text-muted-foreground">
              Último evento: {formatDate(page.lastEventAt)}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Lead ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Intentos</TableHead>
                  <TableHead>Recibido</TableHead>
                  <TableHead className="pr-5">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Meta todavía no ha entregado ningún evento a este
                      servidor. Probá con la herramienta de prueba de lead ads.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="pl-5 font-mono text-xs">
                        {event.leadgenId}
                      </TableCell>
                      <TableCell
                        className={`text-xs font-medium ${EVENT_STYLES[event.status] ?? ""}`}
                      >
                        {event.status}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {event.attempts}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(event.receivedAt)}
                      </TableCell>
                      <TableCell className="max-w-96 pr-5 text-xs text-destructive">
                        {event.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
