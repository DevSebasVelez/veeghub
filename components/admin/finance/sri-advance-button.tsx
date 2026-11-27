"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { advanceSriInvoice } from "@/lib/admin/actions/sri/issue";
import { unwrap } from "@/lib/admin/actions/types";
import { Button } from "@/components/ui/button";

export function SriAdvanceButton({ invoiceId, label }: { invoiceId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      unwrap(await advanceSriInvoice(invoiceId));
      toast.success("Estado actualizado con el SRI.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo consultar al SRI.");
    } finally {
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="w-full" onClick={handleClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Consultando al SRI…" : label}
    </Button>
  );
}
