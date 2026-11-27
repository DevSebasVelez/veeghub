"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { createInvoicePaymentPlan, setInvoiceReceivables } from "@/lib/admin/actions/invoices/payment-plan";
import { unwrap } from "@/lib/admin/actions/types";
import { formatCurrency } from "@/lib/admin/format";
import { fromCents } from "@/lib/admin/finance/money";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Row = { key: string; title: string; amount: string; dueDate: string };

let seed = 0;
const key = () => `r${++seed}`;

/** Splits cents into n parts; the last one takes the rounding remainder. */
function split(cents: number, n: number) {
  const part = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? cents - part * (n - 1) : part));
}

function rowsFor(balanceCents: number, n: number, number: string): Row[] {
  return split(balanceCents, n).map((cents, i) => ({
    key: key(),
    title: n === 1 ? `Pago factura ${number}` : `Factura ${number} · cuota ${i + 1}/${n}`,
    amount: fromCents(cents),
    dueDate: "",
  }));
}

/**
 * «Plan de pagos»: milestones for what no milestone covers yet. One milestone
 * for the whole balance by default; 2 or 3 equal parts with a click.
 */
export function PaymentPlanDialog({
  invoiceId,
  invoiceNumber,
  balanceCents,
  isTest,
}: {
  invoiceId: string;
  invoiceNumber: string;
  balanceCents: number;
  isTest: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const plannedCents = rows.reduce((sum, r) => {
    const value = Math.round(Number(r.amount.replace(",", ".")) * 100);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const over = plannedCents > balanceCents;

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) setRows(rowsFor(balanceCents, 1, invoiceNumber));
  }

  async function save() {
    setSaving(true);
    try {
      unwrap(await createInvoicePaymentPlan(invoiceId, rows.map(({ title, amount, dueDate }) => ({ title, amount, dueDate }))));
      toast.success(rows.length === 1 ? "Hito creado y ligado a la factura." : `${rows.length} cuotas creadas y ligadas a la factura.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={balanceCents <= 0}>
          <CalendarClock className="size-3.5" />
          Plan de pagos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan de pagos</DialogTitle>
          <DialogDescription>
            Crea los hitos con los que el cliente paga esta factura. Luego los cobras con «Cobrar», como cualquier hito.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Por planificar</span>
          <span className="font-semibold tabular-nums">{formatCurrency(fromCents(balanceCents))}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Button key={n} type="button" size="sm" variant="outline" onClick={() => setRows(rowsFor(balanceCents, n, invoiceNumber))}>
              {n === 1 ? "Un solo pago" : `${n} cuotas iguales`}
            </Button>
          ))}
        </div>

        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_2.25rem]">
              <Input
                value={row.title}
                onChange={(e) => setRows((c) => c.map((r) => (r.key === row.key ? { ...r, title: e.target.value } : r)))}
                aria-label="Nombre del hito"
                maxLength={200}
              />
              <Input
                value={row.amount}
                onChange={(e) => setRows((c) => c.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
                inputMode="decimal"
                className="text-right tabular-nums"
                aria-label="Monto"
              />
              <DatePickerField
                value={row.dueDate}
                onChange={(iso) => setRows((c) => c.map((r) => (r.key === row.key ? { ...r, dueDate: iso } : r)))}
                placeholder="Vence"
                ariaLabel="Vence"
                className="h-9 px-2.5 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground"
                onClick={() => setRows((c) => (c.length > 1 ? c.filter((r) => r.key !== row.key) : c))}
                aria-label="Quitar cuota"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setRows((c) => [
                ...c,
                { key: key(), title: `Factura ${invoiceNumber} · cuota ${c.length + 1}`, amount: "", dueDate: "" },
              ])
            }
          >
            <Plus className="size-3.5" />
            Cuota
          </Button>
          <p className={cn("text-xs tabular-nums", over ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            Suman {formatCurrency(fromCents(plannedCents))}
            {over ? " · más de lo que falta" : plannedCents < balanceCents ? " · el resto queda por planificar" : ""}
          </p>
        </div>

        {isTest ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Factura de pruebas: estos hitos sí aparecen en Cobros. Bórralos al terminar de probar.
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={save} disabled={saving || over || plannedCents <= 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Crear {rows.length === 1 ? "hito" : `${rows.length} cuotas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** «Ligar hitos»: pick existing free milestones of the client. */
export function LinkHitosDialog({
  invoiceId,
  linkedIds,
  freeHitos,
}: {
  invoiceId: string;
  linkedIds: string[];
  freeHitos: Array<{ id: string; title: string; amount: string; project: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  async function save() {
    setSaving(true);
    try {
      unwrap(await setInvoiceReceivables(invoiceId, [...linkedIds, ...picked]));
      toast.success(picked.length === 1 ? "Hito ligado a la factura." : `${picked.length} hitos ligados a la factura.`);
      setOpen(false);
      setPicked([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ligar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={freeHitos.length === 0}>
          <Link2 className="size-3.5" />
          Ligar hitos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ligar hitos existentes</DialogTitle>
          <DialogDescription>Hitos del cliente que aún no tienen factura.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50svh] divide-y overflow-y-auto rounded-xl border">
          {freeHitos.map((h) => (
            <li key={h.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={picked.includes(h.id)}
                  onCheckedChange={(v) => setPicked((c) => (v === true ? [...c, h.id] : c.filter((id) => id !== h.id)))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.title}</span>
                  {h.project ? <span className="block truncate text-xs text-muted-foreground">{h.project}</span> : null}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(h.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={save} disabled={saving || picked.length === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Ligar {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
