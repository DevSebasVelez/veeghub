"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CircleCheck, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import {
  applyDocumentCorrections,
  compareInvoiceWithDocuments,
  type InvoiceReconciliation,
} from "@/lib/admin/actions/invoices/reconcile";
import { unwrap } from "@/lib/admin/actions/types";
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
} from "@/components/ui/dialog";

/**
 * "Compare with the XML": reads the invoice's own SRI documents and offers to
 * fix every saved field that differs, one checkbox per field.
 */
export function ReconcileInvoiceDialog({ invoiceId, label }: { invoiceId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<InvoiceReconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const router = useRouter();

  async function start() {
    setOpen(true);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await compareInvoiceWithDocuments(invoiceId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setChosen(res.data.diffs.map((d) => d.field));
    } finally {
      setLoading(false);
    }
  }

  async function applyChanges() {
    setSaving(true);
    try {
      unwrap(await applyDocumentCorrections(invoiceId, chosen));
      setOpen(false);
      router.refresh();
      toast.success(`${chosen.length === 1 ? "Dato corregido" : `${chosen.length} datos corregidos`} según el ${result?.source}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo corregir.");
    } finally {
      setSaving(false);
    }
  }

  const toggle = (field: string) =>
    setChosen((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={start}>
        <ScanSearch className="size-3.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comparar con los documentos del SRI</DialogTitle>
            <DialogDescription>
              {result
                ? `Lo guardado contra ${result.source === "XML" ? "el XML" : "el RIDE"} (${result.fileName}).`
                : "Se lee el documento de la factura y se compara dato por dato."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Leyendo el documento…
            </p>
          ) : error ? (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : result && result.diffs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CircleCheck className="size-8 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium">Todo coincide</p>
              <p className="text-xs text-muted-foreground">
                Los datos guardados son los mismos que dice {result.source === "XML" ? "el XML" : "el RIDE"}.
              </p>
            </div>
          ) : result ? (
            <ul className="divide-y rounded-xl border">
              {result.diffs.map((diff) => (
                <li key={diff.field}>
                  <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3 hover:bg-muted/40">
                    <Checkbox
                      checked={chosen.includes(diff.field)}
                      onCheckedChange={() => toggle(diff.field)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">{diff.label}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="break-all text-muted-foreground line-through">{diff.saved}</span>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                        <span className="break-all font-medium text-emerald-700 dark:text-emerald-300">
                          {diff.document}
                        </span>
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}

          {result?.warnings.map((w) => (
            <p
              key={w}
              className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {w}
            </p>
          ))}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cerrar
              </Button>
            </DialogClose>
            {result && result.diffs.length > 0 ? (
              <Button type="button" onClick={applyChanges} disabled={saving || chosen.length === 0}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {chosen.length === 1 ? "Corregir 1 dato" : `Corregir ${chosen.length} datos`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
