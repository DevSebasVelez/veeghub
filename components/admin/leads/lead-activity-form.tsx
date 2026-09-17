"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { addLeadActivity } from "@/lib/admin/actions/leads/actions";
import { ACTIVITY_LABELS } from "@/components/admin/leads/constants";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/admin/form-select";
import { Textarea } from "@/components/ui/textarea";

const options = ["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING"].map(
  (value) => ({ value, label: ACTIVITY_LABELS[value] }),
);

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await addLeadActivity(leadId, new FormData(event.currentTarget));
      formRef.current?.reset();
      router.refresh();
      toast.success("Actividad registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <div className="w-36 shrink-0">
          <FormSelect name="type" defaultValue="NOTE" options={options} />
        </div>
        <Textarea
          name="body"
          rows={2}
          required
          placeholder="Qué pasó en este contacto..."
          className="flex-1"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Registrar
        </Button>
      </div>
    </form>
  );
}
