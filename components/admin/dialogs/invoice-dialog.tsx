"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CloudOff,
  FileCode2,
  KeyRound,
  Loader2,
  Plus,
  Receipt,
  ShieldQuestion,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  createInvoiceWithKeys,
  updateInvoiceWithKeys,
} from "@/lib/admin/actions/invoices/actions";
import { unwrap } from "@/lib/admin/actions/types";
import {
  analyzeAccessKey,
  analyzeInvoiceRide,
  analyzeInvoiceXml,
  verifyWithSri,
  type InvoiceDocAnalysis,
  type SriVerification,
} from "@/lib/admin/actions/invoices/documents";
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
import { invoiceBreakdown } from "@/lib/admin/finance/calc";
import { formatCurrency } from "@/lib/admin/format";
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
  vatRate: string | null;
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
  onBlockedChange,
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
  /** True while the XML points at an invoice that is already registered. */
  onBlockedChange?: (blocked: boolean) => void;
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
  const taxRef = useRef<HTMLInputElement>(null);
  const vatRateRef = useRef<HTMLInputElement>(null);

  // What the SRI documents say. Their figures become the fields' defaults;
  // the fields remount (prefillKey) so they show them, and stay editable.
  // The XML wins over the RIDE or a pasted clave.
  const [analysis, setAnalysis] = useState<InvoiceDocAnalysis | null>(null);
  const [verification, setVerification] = useState<SriVerification | "checking" | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const [keyInput, setKeyInput] = useState("");
  const hasXmlAnalysis = analysis?.source === "XML" || analysis?.source === "SRI";

  async function apply(
    run: () => Promise<{ ok: true; data: InvoiceDocAnalysis } | { ok: false; error: string }>,
    label: string,
  ) {
    setReading(label);
    try {
      const result = await run();
      if (!result.ok) {
        toast.error("No se pudo leer.", { description: result.error });
        return;
      }
      const data = result.data;
      setAnalysis(data);
      setPrefillKey((k) => k + 1);
      onBlockedChange?.(Boolean(data.duplicate));
      if (data.client && !fixedClientId && data.client.id !== clientId) {
        handleClientChange(data.client.id);
      }
      // The SRI still served the XML: attach it as the invoice's XML.
      if (data.attachedXml) onXmlUpload(data.attachedXml);
      if (!data.duplicate) {
        toast.success(
          data.source === "SRI" ? "XML descargado del SRI y datos completados." : "Datos completados.",
        );
      }

      setVerification("checking");
      const check = await verifyWithSri(data.accessKey);
      setVerification(check.ok ? check.data : { state: "SIN_CONEXION", detail: check.error });
    } finally {
      setReading(null);
    }
  }

  async function readXml(file: File) {
    const text = await file.text();
    await apply(() => analyzeInvoiceXml(text, invoice?.id ?? null), "Leyendo el XML…");
  }

  async function readRide(file: File) {
    if (hasXmlAnalysis) return; // the XML already said everything
    const fd = new FormData();
    fd.set("file", file);
    if (invoice?.id) fd.set("currentInvoiceId", invoice.id);
    await apply(() => analyzeInvoiceRide(fd), "Leyendo el RIDE y consultando al SRI…");
  }

  async function readKey() {
    if (!keyInput.trim()) return;
    await apply(() => analyzeAccessKey(keyInput, invoice?.id ?? null), "Consultando la clave en el SRI…");
  }

  function reset() {
    setAnalysis(null);
    setVerification(null);
    onBlockedChange?.(false);
  }

  function clearXml() {
    if (hasXmlAnalysis) reset();
    onXmlClear();
  }

  function clearRide() {
    if (analysis?.source === "RIDE") reset();
    onRideClear();
  }

  const defaults = {
    invoiceNumber: analysis?.number ?? invoice?.invoiceNumber ?? "",
    accessKey: analysis?.accessKey ?? invoice?.accessKey ?? "",
    issueDate: analysis?.issueDay ?? invoice?.issueDate,
    vatRate: analysis?.vatRate ?? invoice?.vatRate ?? "",
    subtotal: analysis?.subtotal ?? invoice?.subtotal ?? "",
    taxAmount: analysis?.taxAmount ?? invoice?.taxAmount ?? "",
    total: analysis?.total ?? invoice?.total ?? "",
  };

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

  // Fills IVA and total from base × the rate typed for THIS invoice. Only a
  // helper: the stored figures are whatever the fields hold on submit.
  function applyVatRate() {
    const rate = vatRateRef.current?.value.trim();
    const base = subtotalRef.current?.value.trim();
    if (!rate || !base) {
      toast.error("Ingresa el subtotal y la tarifa de IVA.");
      return;
    }
    const { iva, total } = invoiceBreakdown({ subtotal: base, vatRate: rate });
    if (taxRef.current && iva) taxRef.current.value = iva;
    if (totalRef.current && total) totalRef.current.value = total;
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

      {/* SRI documents first: the XML fills everything else */}
      <div className="space-y-3 rounded-xl bg-muted/40 p-4">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />
          <div>
            <p className="text-sm font-medium">Documentos del SRI</p>
            <p className="text-xs text-muted-foreground">
              Sube el XML autorizado (o el RIDE) y se llenan solos el número, la fecha, la clave, los montos y el cliente.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InvoiceFileUploader
            label="XML autorizado"
            accept=".xml,text/xml,application/xml"
            existingName={invoice?.xmlFileName}
            onUpload={onXmlUpload}
            onClear={clearXml}
            onBusy={onBusy}
            onFile={readXml}
          />
          <InvoiceFileUploader
            label="RIDE PDF"
            accept=".pdf,application/pdf"
            existingName={invoice?.rideFileName}
            onUpload={onRideUpload}
            onClear={clearRide}
            onBusy={onBusy}
            onFile={readRide}
          />
        </div>
        {!analysis ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              ¿Solo tienes el RIDE? Súbelo y se lee su clave. ¿Ni eso? Pega la clave de acceso:
            </p>
            <div className="flex gap-2">
              <Input
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void readKey();
                  }
                }}
                inputMode="numeric"
                placeholder="49 dígitos"
                aria-label="Clave de acceso"
                className="h-9 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={readKey}
                disabled={!keyInput.trim() || Boolean(reading)}
              >
                <KeyRound className="size-3.5" />
                Leer clave
              </Button>
            </div>
          </div>
        ) : null}
        {reading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {reading}
          </p>
        ) : null}
        {analysis ? <DocReadout analysis={analysis} verification={verification} /> : null}
      </div>

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

      {/* Invoice metadata (remounts with the XML's figures) */}
      <div key={prefillKey} className="contents">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Número de factura</FieldLabel>
          <Input
            name="invoiceNumber"
            defaultValue={defaults.invoiceNumber}
            placeholder="001-001-000000001"
          />
        </Field>
        <Field>
          <FieldLabel>Fecha de emisión</FieldLabel>
          <DatePickerField name="issueDate" defaultValue={defaults.issueDate} />
        </Field>
      </div>

      <Field>
        <FieldLabel>Clave de acceso SRI</FieldLabel>
        <Input
          name="accessKey"
          defaultValue={defaults.accessKey}
          className="font-mono text-xs"
          placeholder="49 dígitos"
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>Tarifa IVA aplicada (%)</FieldLabel>
          <button
            type="button"
            onClick={applyVatRate}
            className="text-xs font-medium text-primary hover:underline"
          >
            Calcular IVA y total
          </button>
        </div>
        <Input
          ref={vatRateRef}
          name="vatRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={defaults.vatRate}
          placeholder="La que corresponda a esta factura"
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
            defaultValue={defaults.subtotal}
          />
        </Field>
        <Field>
          <FieldLabel>IVA</FieldLabel>
          <Input
            ref={taxRef}
            name="taxAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults.taxAmount}
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
            defaultValue={defaults.total}
            required
          />
        </Field>
      </div>
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

    </FieldGroup>
  );
}

// ── What the XML says ──────────────────────────────────────────────────────

const SOURCE_LABEL: Record<InvoiceDocAnalysis["source"], string> = {
  XML: "Leído del XML",
  SRI: "XML descargado del SRI",
  RIDE: "Leído del RIDE",
  CLAVE: "Leído de la clave",
};

function VerificationBadge({ verification }: { verification: SriVerification | "checking" | null }) {
  if (!verification) return null;
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (verification === "checking") {
    return (
      <span className={`${base} border-border text-muted-foreground`}>
        <Loader2 className="size-3 animate-spin" />
        Verificando en el SRI
      </span>
    );
  }
  const map = {
    AUTORIZADO: {
      icon: BadgeCheck,
      text: "Autorizada en el SRI",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    },
    NO_AUTORIZADO: {
      icon: XCircle,
      text: "No autorizada en el SRI",
      cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
    },
    NO_VERIFICABLE: {
      icon: ShieldQuestion,
      text: "Sin verificar en el SRI",
      cls: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
    },
    SIN_CONEXION: {
      icon: CloudOff,
      text: "SRI sin respuesta",
      cls: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
    },
  }[verification.state];
  const Icon = map.icon;
  return (
    <span className={`${base} ${map.cls}`} title={verification.detail ?? undefined}>
      <Icon className="size-3" />
      {map.text}
    </span>
  );
}

function DocReadout({
  analysis,
  verification,
}: {
  analysis: InvoiceDocAnalysis;
  verification: SriVerification | "checking" | null;
}) {
  const rows: Array<[string, string]> = [
    ["Factura", analysis.number],
    ["Emisión", analysis.issueDay.split("-").reverse().join("/")],
    ["Comprador", [analysis.buyer.name, analysis.buyer.id].filter(Boolean).join(" · ") || "—"],
    ["Cliente", analysis.client?.name ?? "Sin coincidencia"],
    [
      "Total",
      analysis.total
        ? `${formatCurrency(analysis.total)}${analysis.vatRate != null ? ` · IVA ${analysis.vatRate}%` : ""}`
        : "Complétalo a mano",
    ],
  ];
  const note =
    verification && verification !== "checking" && verification.state !== "AUTORIZADO" && verification.detail
      ? verification.detail
      : null;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <FileCode2 className="size-4 text-emerald-600 dark:text-emerald-300" />
        <p className="text-sm font-medium">{SOURCE_LABEL[analysis.source]}</p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <VerificationBadge verification={verification} />
          <span
            className={
              analysis.environment === "PRODUCCION"
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }
          >
            {analysis.environment === "PRODUCCION" ? "Producción" : "Pruebas"}
          </span>
        </div>
      </div>
      <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {analysis.items.length ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {analysis.items.map((i) => i.description).join(" · ")}
        </p>
      ) : null}
      {analysis.attachedXml ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          ✓ XML autorizado adjuntado: {analysis.attachedXml.name}
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {analysis.duplicate ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            Esta factura ya está registrada
            {analysis.duplicate.number ? ` (${analysis.duplicate.number})` : ""}. No se puede volver a registrar.
          </span>
        </p>
      ) : null}
      {analysis.warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ))}
    </div>
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
  const [blocked, setBlocked] = useState(false);
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
      unwrap(await createInvoiceWithKeys(fd));
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
      setBlocked(false);
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
            Empieza por el XML autorizado del SRI: el resto se llena solo.
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
            onBlockedChange={setBlocked}
          />
          <DialogSubmitFooter
            submitLabel="Registrar factura"
            saving={submitting || isUploading}
            savingLabel={isUploading ? "Subiendo archivos..." : "Guardando..."}
            disabled={!clientsWithContext.length || blocked}
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
  const [blocked, setBlocked] = useState(false);
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
      unwrap(await updateInvoiceWithKeys(invoice.id, fd));
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
      setBlocked(false);
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
            onBlockedChange={setBlocked}
          />
          <DialogSubmitFooter
            submitLabel="Guardar cambios"
            saving={submitting || isUploading}
            savingLabel={isUploading ? "Subiendo archivos..." : "Guardando..."}
            disabled={blocked}
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
