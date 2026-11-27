"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Flag, Package, Plus, Trash2, X } from "lucide-react";

import type { IssueFormItem, IssueInvoiceData } from "@/lib/admin/queries/issue-invoice";
import type { IssueRequest } from "@/lib/sri/issue-request";
import {
  BUYER_ID_LABELS,
  type BuyerIdType,
  CONSUMER_ID,
  CONSUMER_MAX_CENTS,
  type InvoiceTotals,
  PAYMENT_METHODS,
  computeInvoiceTotals,
} from "@/lib/sri/invoice-calc";
import { checkBuyerId, guessBuyerIdType } from "@/lib/sri/identification";
import { formatCurrency } from "@/lib/admin/format";
import { fromCents } from "@/lib/admin/finance/money";
import { cn } from "@/lib/utils";
import { IssueReviewDialog } from "@/components/admin/finance/issue-review-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// «Emitir factura»: one screen, like any invoicing program. Totals are
// computed live with computeInvoiceTotals, the code buildInvoiceXml signs
// with, so what this screen shows is what the SRI receives.

type Buyer = { idType: BuyerIdType; id: string; name: string; address: string; email: string };

let keySeed = 0;
function newKey() {
  keySeed += 1;
  return `n${Date.now().toString(36)}${keySeed}`;
}

function Pick({
  value,
  onChange,
  options,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-10 w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder ?? "Selecciona"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CardHeader({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  );
}

function buyerFromClient(client: IssueInvoiceData["clients"][number] | undefined): Buyer {
  if (!client) return { idType: "07", id: CONSUMER_ID, name: "CONSUMIDOR FINAL", address: "", email: "" };
  const idType = guessBuyerIdType(client.taxId);
  return {
    idType,
    id: idType === "07" ? CONSUMER_ID : (client.taxId ?? ""),
    name: idType === "07" ? "CONSUMIDOR FINAL" : (client.legalName ?? client.name),
    address: client.address ?? "",
    email: client.email ?? "",
  };
}

function lineTotal(item: IssueFormItem, totals: InvoiceTotals | null, index: number) {
  return totals ? formatCurrency(fromCents(totals.lines[index].baseCents)) : "—";
}

export function IssueInvoiceForm({ data, issueDayLabel }: { data: IssueInvoiceData; issueDayLabel: string }) {
  const [clientId, setClientId] = useState(data.prefill.clientId ?? "");
  const [projectId, setProjectId] = useState(data.prefill.projectId ?? "");
  // Production when it exists (real invoicing); test stays in the selector.
  const [pointId, setPointId] = useState(
    (data.points.find((p) => p.environment === "PRODUCCION") ?? data.points[0])?.id ?? "",
  );
  const client = data.clients.find((c) => c.id === clientId);
  const [buyer, setBuyer] = useState<Buyer>(() => buyerFromClient(client));
  const [updateClient, setUpdateClient] = useState(() => Boolean(client && (!client.taxId || !client.legalName || !client.address)));
  const [items, setItems] = useState<IssueFormItem[]>(() =>
    data.prefill.items.length
      ? data.prefill.items
      : [{ key: newKey(), code: "", description: "", quantity: "1", unitPrice: "", discount: "", vatCode: data.defaultVatCode, receivableId: null }],
  );
  const [paymentMethod, setPaymentMethod] = useState("20");
  const [extra, setExtra] = useState<Array<{ key: string; name: string; value: string }>>([]);

  const point = data.points.find((p) => p.id === pointId);
  const hitos = client?.hitos ?? [];
  const usedHitos = new Set(items.map((i) => i.receivableId).filter(Boolean));
  const freeHitos = hitos.filter((h) => !usedHitos.has(h.id));

  function pickClient(id: string) {
    const next = data.clients.find((c) => c.id === id);
    setClientId(id);
    setProjectId("");
    setBuyer(buyerFromClient(next));
    setUpdateClient(Boolean(next && (!next.taxId || !next.legalName || !next.address)));
    // Milestones belong to the previous client.
    setItems((current) => {
      const kept = current.filter((i) => !i.receivableId);
      return kept.length ? kept : [blankItem()];
    });
  }

  function blankItem(): IssueFormItem {
    return { key: newKey(), code: "", description: "", quantity: "1", unitPrice: "", discount: "", vatCode: data.defaultVatCode, receivableId: null };
  }

  /** Adds a line, replacing the first one if it is still blank. */
  function addItem(item: IssueFormItem) {
    setItems((current) => {
      const blank = current.length === 1 && !current[0].description && !current[0].unitPrice && !current[0].receivableId;
      return blank ? [item] : [...current, item];
    });
  }

  function addFromCatalog(id: string) {
    const product = data.catalog.find((p) => p.id === id);
    if (!product) return;
    const vatCode = product.vatCode && data.vatOptions.some((o) => o.code === product.vatCode) ? product.vatCode : data.defaultVatCode;
    addItem({ ...blankItem(), code: product.code ?? "", description: product.name, unitPrice: product.unitPrice, vatCode });
  }

  function addHito(id: string) {
    const hito = hitos.find((h) => h.id === id);
    if (!hito) return;
    addItem({ ...blankItem(), description: hito.title, unitPrice: hito.amount, receivableId: hito.id });
    if (!projectId && hito.projectId) setProjectId(hito.projectId);
  }

  function updateItem(key: string, patch: Partial<IssueFormItem>) {
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // Live figures, with the signing code.
  const calc = useMemo(() => {
    const normalized = items.map((i) => ({
      code: i.code,
      description: i.description,
      quantity: i.quantity.replace(",", ".").trim(),
      unitPrice: i.unitPrice.replace(",", ".").trim() || "0",
      discount: i.discount.replace(",", ".").trim() || "0",
      vatCode: i.vatCode,
    }));
    try {
      const totals = computeInvoiceTotals(normalized, data.vatOptions.length ? [...new Set(data.vatOptions.map((o) => o.rate))] : []);
      return { totals, problem: null as string | null };
    } catch (error) {
      return { totals: null, problem: error instanceof Error ? error.message : String(error) };
    }
  }, [items, data.vatOptions]);

  const idCheck = checkBuyerId(buyer.idType, buyer.id);
  const missingPrice = items.some((i) => !i.unitPrice.trim());
  const consumerOver = buyer.idType === "07" && calc.totals && calc.totals.totalCents > CONSUMER_MAX_CENTS;

  const blockers = [
    data.taxProblem,
    data.points.length === 0 ? "No hay un punto de emisión activo." : null,
    data.certificate ? null : "Falta la firma electrónica vigente.",
    point?.environment === "PRODUCCION" && !data.productionAllowed
      ? "El envío a producción está deshabilitado en el servidor (SRI_ALLOW_PRODUCTION)."
      : null,
  ].filter(Boolean) as string[];

  const problems = [
    !clientId ? "Elige el cliente." : null,
    idCheck.ok ? null : idCheck.error,
    !buyer.name.trim() ? "Falta la razón social del comprador." : null,
    missingPrice ? "Falta el precio de un ítem." : calc.problem,
    consumerOver ? "Una factura a consumidor final no puede superar USD 50: identifica al comprador." : null,
  ].filter(Boolean) as string[];

  const request: IssueRequest = {
    clientId,
    projectId: projectId || null,
    emissionPointId: pointId,
    buyer,
    items: items.map((i) => ({
      code: i.code,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      vatCode: i.vatCode,
      receivableId: i.receivableId,
    })),
    paymentMethod,
    additionalInfo: extra.map(({ name, value }) => ({ name, value })),
    updateClient,
  };

  const vatSelect = data.vatOptions.map((o) => ({ value: o.code, label: o.label }));
  const taxedLines = calc.totals?.taxes ?? [];

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/* Side panel: environment, number, totals and the one action. */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:order-last">
        <section className="rounded-2xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Calculado con el mismo código que firma.</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            {point ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                  point.environment === "PRUEBAS"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {point.environment === "PRUEBAS" ? "Pruebas · sin validez tributaria" : "Producción · factura real"}
              </span>
            ) : null}

            {data.points.length > 1 ? (
              <Field>
                <FieldLabel>Punto de emisión</FieldLabel>
                <Pick
                  value={pointId}
                  onChange={setPointId}
                  options={data.points.map((p) => ({
                    value: p.id,
                    label: `${p.prefix} · ${p.environment === "PRUEBAS" ? "Pruebas" : "Producción"}`,
                  }))}
                />
              </Field>
            ) : null}

            <dl className="space-y-2 text-sm">
              {[
                ["Número", point ? point.nextNumber : "—"],
                ["Emisión", issueDayLabel],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-mono text-xs font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm">
              {taxedLines.map((tax) => (
                <div key={tax.vatCode} className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Subtotal {data.vatOptions.find((o) => o.code === tax.vatCode)?.label ?? `${tax.vatRate} %`}
                  </span>
                  <span className="tabular-nums">{formatCurrency(fromCents(tax.baseCents))}</span>
                </div>
              ))}
              {calc.totals && calc.totals.discountCents > 0 ? (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="tabular-nums">{formatCurrency(fromCents(calc.totals.discountCents))}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{calc.totals ? formatCurrency(fromCents(calc.totals.vatCents)) : "—"}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
                {calc.totals ? formatCurrency(fromCents(calc.totals.totalCents)) : "—"}
              </p>
            </div>

            {blockers.length ? (
              <div className="space-y-1 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {blockers.map((b) => (
                  <p key={b}>{b}</p>
                ))}
                <Link href="/admin/finanzas/impuestos" className="font-medium underline underline-offset-2">
                  Revisar en Finanzas › Impuestos
                </Link>
              </div>
            ) : problems.length ? (
              <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}

            <IssueReviewDialog
              request={request}
              disabled={blockers.length > 0 || problems.length > 0}
              environment={point?.environment ?? "PRUEBAS"}
              number={point?.nextNumber ?? ""}
              total={calc.totals ? formatCurrency(fromCents(calc.totals.totalCents)) : ""}
              clientName={client?.name ?? ""}
              buyerEmail={buyer.email}
            />
          </div>
        </section>
      </aside>

      <div className="min-w-0 space-y-4">
        {/* Client and buyer */}
        <section className="rounded-2xl border bg-card">
          <CardHeader title="Cliente y comprador" hint="El comprador sale del cliente; puedes corregirlo para esta factura." />
          <FieldGroup className="px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Pick
                  value={clientId}
                  onChange={pickClient}
                  placeholder="Elige el cliente"
                  options={data.clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <Pick
                  value={projectId || "none"}
                  onChange={(v) => setProjectId(v === "none" ? "" : v)}
                  options={[
                    { value: "none", label: "Sin proyecto" },
                    ...(client?.projects ?? []).map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Field>
                <FieldLabel>Identificación</FieldLabel>
                <Pick
                  value={buyer.idType}
                  onChange={(v) => {
                    const idType = v as BuyerIdType;
                    setBuyer((b) =>
                      idType === "07"
                        ? { ...b, idType, id: CONSUMER_ID, name: "CONSUMIDOR FINAL" }
                        : { ...b, idType, id: b.id === CONSUMER_ID ? "" : b.id, name: b.name === "CONSUMIDOR FINAL" ? (client?.legalName ?? client?.name ?? "") : b.name },
                    );
                  }}
                  options={(Object.keys(BUYER_ID_LABELS) as BuyerIdType[]).map((k) => ({ value: k, label: BUYER_ID_LABELS[k] }))}
                />
              </Field>
              <Field>
                <FieldLabel>Número</FieldLabel>
                <Input
                  value={buyer.id}
                  onChange={(e) => setBuyer((b) => ({ ...b, id: e.target.value }))}
                  disabled={buyer.idType === "07"}
                  inputMode={buyer.idType === "04" || buyer.idType === "05" ? "numeric" : "text"}
                  aria-invalid={Boolean(buyer.id) && !idCheck.ok}
                  className="font-mono tabular-nums"
                />
                {buyer.id && !idCheck.ok ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{idCheck.error}</p>
                ) : idCheck.ok && idCheck.warning ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{idCheck.warning}</p>
                ) : null}
              </Field>
            </div>
            <Field>
              <FieldLabel>Razón social</FieldLabel>
              <Input value={buyer.name} onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))} maxLength={300} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Dirección</FieldLabel>
                <Input value={buyer.address} onChange={(e) => setBuyer((b) => ({ ...b, address: e.target.value }))} maxLength={300} />
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input type="email" value={buyer.email} onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))} />
                <FieldDescription>Va en la información adicional y es el destino del envío.</FieldDescription>
              </Field>
            </div>
            {client && buyer.idType !== "07" ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={updateClient} onCheckedChange={(v) => setUpdateClient(v === true)} />
                Guardar estos datos en el cliente
              </label>
            ) : null}
          </FieldGroup>
        </section>

        {/* Items */}
        <section className="rounded-2xl border bg-card">
          <CardHeader
            title="Detalle"
            hint="Código, concepto, cantidad, precio, descuento e IVA de cada ítem."
            action={
              <div className="flex flex-wrap gap-2">
                {data.catalog.length ? (
                  <Select value="" onValueChange={addFromCatalog}>
                    <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Agregar del catálogo">
                      <Package className="size-3.5" />
                      <span>Del catálogo</span>
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      {data.catalog.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {formatCurrency(p.unitPrice)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {freeHitos.length ? (
                  <Select value="" onValueChange={addHito}>
                    <SelectTrigger size="sm" className="w-auto gap-1.5" aria-label="Agregar hito pendiente">
                      <Flag className="size-3.5" />
                      <span>Hito pendiente</span>
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      {freeHitos.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.title} · {formatCurrency(h.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(blankItem())}>
                  <Plus className="size-3.5" />
                  Ítem
                </Button>
              </div>
            }
          />
          <ul className="divide-y">
            {items.map((item, index) => {
              const hito = item.receivableId ? hitos.find((h) => h.id === item.receivableId) : null;
              return (
                <li key={item.key} className="space-y-3 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-2.5 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.key, { description: e.target.value })}
                        placeholder="Concepto: desarrollo, mantenimiento, hosting…"
                        aria-label={`Concepto del ítem ${index + 1}`}
                        maxLength={300}
                      />
                      {item.receivableId ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          <Flag className="size-3" aria-hidden />
                          Hito: {hito?.title ?? "vinculado"}
                          <button
                            type="button"
                            onClick={() => updateItem(item.key, { receivableId: null })}
                            className="ml-0.5 rounded hover:text-foreground"
                            aria-label="Quitar vínculo con el hito"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2.5 shrink-0 text-sm font-semibold tabular-nums">{lineTotal(item, calc.totals, index)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setItems((current) => (current.length > 1 ? current.filter((i) => i.key !== item.key) : [blankItem()]))}
                      aria-label={`Quitar ítem ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-8 sm:grid-cols-5 sm:pr-12">
                    {[
                      { label: "Código", field: "code" as const, placeholder: "Opcional", mode: "text" as const },
                      { label: "Cantidad", field: "quantity" as const, placeholder: "1", mode: "decimal" as const },
                      { label: "Precio unit.", field: "unitPrice" as const, placeholder: "0.00", mode: "decimal" as const },
                      { label: "Descuento", field: "discount" as const, placeholder: "0.00", mode: "decimal" as const },
                    ].map((f) => (
                      <label key={f.field} className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">{f.label}</span>
                        <Input
                          value={item[f.field]}
                          onChange={(e) => updateItem(item.key, { [f.field]: e.target.value })}
                          placeholder={f.placeholder}
                          inputMode={f.mode}
                          maxLength={f.field === "code" ? 25 : 20}
                          className={cn("h-9", f.mode === "decimal" && "text-right tabular-nums")}
                        />
                      </label>
                    ))}
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">IVA</span>
                      <Pick
                        value={item.vatCode}
                        onChange={(v) => updateItem(item.key, { vatCode: v })}
                        options={vatSelect}
                        className="h-9"
                        ariaLabel={`IVA del ítem ${index + 1}`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Payment and additional information */}
        <section className="rounded-2xl border bg-card">
          <CardHeader
            title="Pago e información adicional"
            hint="Forma de pago del SRI y campos que salen al pie del RIDE."
            action={
              extra.length < 14 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExtra((current) => [...current, { key: newKey(), name: "", value: "" }])}
                >
                  <Plus className="size-3.5" />
                  Campo
                </Button>
              ) : null
            }
          />
          <FieldGroup className="px-5 py-4">
            <Field>
              <FieldLabel>Forma de pago</FieldLabel>
              <Pick
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label: `${value} · ${label}` }))}
              />
              <FieldDescription>Una transferencia es «20 · Otros con utilización del sistema financiero».</FieldDescription>
            </Field>
            {extra.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {buyer.email ? `Se agrega «Email: ${buyer.email}». ` : ""}
                Usa «Campo» para sumar otros datos, como la orden de compra o el plazo de pago.
              </p>
            ) : (
              <div className="space-y-2">
                {extra.map((field) => (
                  <div key={field.key} className="flex gap-2">
                    <Input
                      value={field.name}
                      onChange={(e) => setExtra((c) => c.map((f) => (f.key === field.key ? { ...f, name: e.target.value } : f)))}
                      placeholder="Nombre"
                      className="w-36 shrink-0 sm:w-44"
                      maxLength={300}
                    />
                    <Input
                      value={field.value}
                      onChange={(e) => setExtra((c) => c.map((f) => (f.key === field.key ? { ...f, value: e.target.value } : f)))}
                      placeholder="Valor"
                      maxLength={300}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 text-muted-foreground"
                      onClick={() => setExtra((c) => c.filter((f) => f.key !== field.key))}
                      aria-label="Quitar campo"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {point?.environment === "PRUEBAS" && items.some((i) => i.receivableId) ? (
              <p className="text-xs text-muted-foreground">
                En pruebas los hitos no se marcan como facturados: solo una factura de producción los liga.
              </p>
            ) : null}
            {data.regimeLegend ? (
              <p className="text-xs text-muted-foreground">Leyenda del RIDE: {data.regimeLegend}.</p>
            ) : null}
          </FieldGroup>
        </section>
      </div>
    </div>
  );
}
