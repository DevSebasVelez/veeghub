"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";

import {
  createInvoiceWithKeys,
  updateInvoiceWithKeys,
} from "@/lib/admin/actions/invoices/actions";
import {
  DialogSubmitFooter,
  EditTrigger,
} from "@/components/admin/dialogs/_base";
import { DatePickerField } from "@/components/admin/date-picker-field";
import {
  InvoiceFileUploader,
  type UploadedFile,
} from "@/components/admin/invoice-file-uploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────

export type ClientWithContext = {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
  receivables: {
    id: string;
    title: string;
    projectId: string | null;
    amount: string;
  }[];
};

type InvoiceData = {
  id: string;
  clientId: string;
  projectId: string | null;
  receivableIds: string[];
  invoiceNumber: string | null;
  accessKey: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  total: string;
  issueDate: string | null;
  status: string;
  xmlFileName?: string | null;
  rideFileName?: string | null;
};

// ── Shared form body ───────────────────────────────────────────────────────

function InvoiceFormBody({
  invoice,
  clientsWithContext,
  fixedClientId,
  fixedProjectId,
  fixedReceivableId,
  isEdit,
  onXmlUpload,
  onXmlClear,
  onRideUpload,
  onRideClear,
  onBusy,
}: {
  invoice?: InvoiceData;
  clientsWithContext: ClientWithContext[];
  fixedClientId?: string | null;
  fixedProjectId?: string | null;
  fixedReceivableId?: string | null;
  isEdit: boolean;
  uploading: boolean;
  onXmlUpload: (f: UploadedFile) => void;
  onXmlClear: () => void;
  onRideUpload: (f: UploadedFile) => void;
  onRideClear: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const initialClientId =
    fixedClientId ?? invoice?.clientId ?? clientsWithContext[0]?.id ?? "";
  const initialProjectId = fixedProjectId ?? invoice?.projectId ?? "none";
  const initialReceivableIds = fixedReceivableId
    ? [fixedReceivableId]
    : (invoice?.receivableIds ?? []);

  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [receivableIds, setReceivableIds] =
    useState<string[]>(initialReceivableIds);
  const totalRef = useRef<HTMLInputElement>(null);
  const subtotalRef = useRef<HTMLInputElement>(null);

  function handleProjectChange(val: string) {
    setProjectId(val);
    if (!fixedReceivableId) setReceivableIds([]);
  }

  function toggleReceivable(id: string) {
    setReceivableIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const clientCtx = clientsWithContext.find((c) => c.id === clientId);
  const availableProjects = clientCtx?.projects ?? [];
  // Filter receivables by selected project (when none → show all)
  const availableReceivables = (clientCtx?.receivables ?? []).filter(
    (r) => projectId === "none" || r.projectId === projectId,
  );

  function handleClientChange(val: string) {
    setClientId(val);
    if (!fixedProjectId) setProjectId("none");
    if (!fixedReceivableId) setReceivableIds([]);
  }

  const showClientSelect = !fixedClientId;
  const showProjectSelect = !fixedProjectId;
  const showReceivableSelect = !fixedReceivableId;

  const fixedClient = fixedClientId
    ? clientsWithContext.find((c) => c.id === fixedClientId)
    : null;
  const fixedReceivable = fixedReceivableId
    ? availableReceivables.find((r) => r.id === fixedReceivableId)
    : null;

  // Sum of the currently selected (visible) hitos, to help fill the total.
  const selectedSum = availableReceivables
    .filter((r) => receivableIds.includes(r.id))
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const submittedReceivableIds = fixedReceivableId
    ? [fixedReceivableId]
    : receivableIds;

  function applySumToTotals() {
    const value = selectedSum.toFixed(2);
    if (totalRef.current) totalRef.current.value = value;
    if (subtotalRef.current) subtotalRef.current.value = value;
  }

  return (
    <FieldGroup>
      {/* Hidden values for fixed context */}
      {fixedClientId ? (
        <input type="hidden" name="clientId" value={fixedClientId} />
      ) : null}
      {fixedProjectId ? (
        <input type="hidden" name="projectId" value={fixedProjectId} />
      ) : null}

      {/* Hidden values for controlled selects */}
      {showClientSelect ? (
        <input type="hidden" name="clientId" value={clientId} />
      ) : null}
      {showProjectSelect ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : null}
      {/* Selected hitos as a comma-separated list */}
      <input
        type="hidden"
        name="receivableIds"
        value={submittedReceivableIds.join(",")}
      />

      {/* Client */}
      {showClientSelect ? (
        <Field>
          <FieldLabel>Cliente</FieldLabel>
          <Select value={clientId} onValueChange={handleClientChange}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Selecciona cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientsWithContext.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : fixedClient ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Cliente</p>
          <p className="text-sm font-medium">{fixedClient.name}</p>
        </div>
      ) : null}

      {/* Project */}
      {showProjectSelect ? (
        <Field>
          <FieldLabel>Proyecto</FieldLabel>
          <Select value={projectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Sin proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin proyecto</SelectItem>
              {availableProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {/* Receivables — one invoice can cover several hitos */}
      {showReceivableSelect ? (
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel>Hitos cubiertos</FieldLabel>
            {receivableIds.length > 0 ? (
              <button
                type="button"
                onClick={applySumToTotals}
                className="text-xs font-medium text-primary hover:underline"
              >
                Usar suma ({selectedSum.toFixed(2)})
              </button>
            ) : null}
          </div>
          {availableReceivables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay hitos disponibles para este cliente/proyecto.
            </p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-1">
              {availableReceivables.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={receivableIds.includes(r.id)}
                    onCheckedChange={() => toggleReceivable(r.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.amount}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
      ) : fixedReceivable ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            Hito cubierto
          </p>
          <p className="text-sm font-medium">{fixedReceivable.title}</p>
        </div>
      ) : null}

      {/* Invoice metadata */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Número de factura</FieldLabel>
          <Input
            name="invoiceNumber"
            defaultValue={invoice?.invoiceNumber ?? ""}
            placeholder="001-001-000000001"
          />
        </Field>
        <Field>
          <FieldLabel>Fecha de emisión</FieldLabel>
          <DatePickerField name="issueDate" defaultValue={invoice?.issueDate} />
        </Field>
      </div>

      <Field>
        <FieldLabel>Clave de acceso SRI</FieldLabel>
        <Input
          name="accessKey"
          defaultValue={invoice?.accessKey ?? ""}
          placeholder="49 dígitos"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>Subtotal</FieldLabel>
          <Input
            ref={subtotalRef}
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={invoice?.subtotal ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>IVA</FieldLabel>
          <Input
            name="taxAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={invoice?.taxAmount ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Total *</FieldLabel>
          <Input
            ref={totalRef}
            name="total"
            type="number"
            step="0.01"
            min="0"
            defaultValue={invoice?.total ?? ""}
            required
          />
        </Field>
      </div>

      {isEdit ? (
        <Field>
          <FieldLabel>Estado</FieldLabel>
          <Select
            name="status"
            defaultValue={invoice?.status ?? "READY_TO_SEND"}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="READY_TO_SEND">Por enviar</SelectItem>
              <SelectItem value="SENT">Enviada</SelectItem>
              <SelectItem value="PAID">Pagada</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="status" value="READY_TO_SEND" />
      )}

      {/* File uploads */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InvoiceFileUploader
          label="XML autorizado"
          accept=".xml,text/xml,application/xml"
          existingName={invoice?.xmlFileName}
          onUpload={onXmlUpload}
          onClear={onXmlClear}
          onBusy={onBusy}
        />
        <InvoiceFileUploader
          label="RIDE PDF"
          accept=".pdf,application/pdf"
          existingName={invoice?.rideFileName}
          onUpload={onRideUpload}
          onClear={onRideClear}
          onBusy={onBusy}
        />
      </div>
    </FieldGroup>
  );
}

// ── Create dialog ──────────────────────────────────────────────────────────

export function CreateInvoiceDialog({
  clientsWithContext,
  fixedClientId,
  fixedProjectId,
  fixedReceivableId,
  trigger,
}: {
  clientsWithContext: ClientWithContext[];
  fixedClientId?: string | null;
  fixedProjectId?: string | null;
  fixedReceivableId?: string | null;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [xml, setXml] = useState<UploadedFile | null>(null);
  const [ride, setRide] = useState<UploadedFile | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const isUploading = busyCount > 0;

  function trackBusy(uploading: boolean) {
    setBusyCount((n) => Math.max(0, n + (uploading ? 1 : -1)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isUploading) {
      toast.error("Espera a que termine la subida de archivos.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (xml) {
        fd.set("xmlObjectKey", xml.objectKey);
        fd.set("xmlName", xml.name);
        fd.set("xmlMimeType", xml.mimeType);
        fd.set("xmlSize", String(xml.size));
      }
      if (ride) {
        fd.set("rideObjectKey", ride.objectKey);
        fd.set("rideName", ride.name);
        fd.set("rideMimeType", ride.mimeType);
        fd.set("rideSize", String(ride.size));
      }
      await createInvoiceWithKeys(fd);
      setOpen(false);
      setXml(null);
      setRide(null);
      router.refresh();
      toast.success("Factura registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setXml(null);
      setRide(null);
      setBusyCount(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Nueva factura
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar factura</DialogTitle>
          <DialogDescription>
            Adjunta el XML autorizado y el RIDE PDF del Facturador SRI.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InvoiceFormBody
            clientsWithContext={clientsWithContext}
            fixedClientId={fixedClientId}
            fixedProjectId={fixedProjectId}
            fixedReceivableId={fixedReceivableId}
            isEdit={false}
            uploading={isUploading}
            onXmlUpload={setXml}
            onXmlClear={() => setXml(null)}
            onRideUpload={setRide}
            onRideClear={() => setRide(null)}
            onBusy={trackBusy}
          />
          <DialogSubmitFooter
            submitLabel="Registrar factura"
            saving={submitting || isUploading}
            savingLabel={isUploading ? "Subiendo archivos..." : "Guardando..."}
            disabled={!clientsWithContext.length}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────

export function InvoiceEditDialog({
  invoice,
  clientsWithContext,
}: {
  invoice: InvoiceData;
  clientsWithContext: ClientWithContext[];
}) {
  const [open, setOpen] = useState(false);
  const [xml, setXml] = useState<UploadedFile | null>(null);
  const [ride, setRide] = useState<UploadedFile | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const isUploading = busyCount > 0;

  function trackBusy(uploading: boolean) {
    setBusyCount((n) => Math.max(0, n + (uploading ? 1 : -1)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isUploading) {
      toast.error("Espera a que termine la subida de archivos.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (xml) {
        fd.set("xmlObjectKey", xml.objectKey);
        fd.set("xmlName", xml.name);
        fd.set("xmlMimeType", xml.mimeType);
        fd.set("xmlSize", String(xml.size));
      }
      if (ride) {
        fd.set("rideObjectKey", ride.objectKey);
        fd.set("rideName", ride.name);
        fd.set("rideMimeType", ride.mimeType);
        fd.set("rideSize", String(ride.size));
      }
      await updateInvoiceWithKeys(invoice.id, fd);
      setOpen(false);
      router.refresh();
      toast.success("Factura actualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setXml(null);
      setRide(null);
      setBusyCount(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar factura</DialogTitle>
          <DialogDescription>
            Ajusta datos y reemplaza archivos XML/RIDE subiendo nuevos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InvoiceFormBody
            invoice={invoice}
            clientsWithContext={clientsWithContext}
            isEdit
            uploading={isUploading}
            onXmlUpload={setXml}
            onXmlClear={() => setXml(null)}
            onRideUpload={setRide}
            onRideClear={() => setRide(null)}
            onBusy={trackBusy}
          />
          <DialogSubmitFooter
            submitLabel="Guardar cambios"
            saving={submitting || isUploading}
            savingLabel={isUploading ? "Subiendo archivos..." : "Guardando..."}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Quick invoice from receivable ──────────────────────────────────────────

export function QuickInvoiceDialog({
  clientsWithContext,
  fixedClientId,
  fixedProjectId,
  fixedReceivableId,
}: {
  clientsWithContext: ClientWithContext[];
  fixedClientId: string;
  fixedProjectId?: string | null;
  fixedReceivableId: string;
  receivableTitle: string;
}) {
  return (
    <CreateInvoiceDialog
      clientsWithContext={clientsWithContext}
      fixedClientId={fixedClientId}
      fixedProjectId={fixedProjectId}
      fixedReceivableId={fixedReceivableId}
      trigger={
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
          <Receipt className="size-3" />
          Facturar
        </Button>
      }
    />
  );
}
