import { createInvoice, sendInvoiceEmail } from "@/app/admin/actions";
import { forInvoiceDialog } from "@/lib/admin/serialize";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { InvoiceEditDialog } from "@/components/admin/dialogs/invoice-dialog";
import { FormSelect } from "@/components/admin/form-select";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPage(pageParam);
  const [clients, projects, freeReceivables, allReceivables, invoices, total] =
    await Promise.all([
      prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      // For the create form: only receivables not yet linked to an invoice
      prisma.receivable.findMany({
        where: { invoice: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, client: { select: { name: true } } },
      }),
      // For edit dialogs: all receivables (including already-linked ones)
      prisma.receivable.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, client: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          client: true,
          project: true,
          xmlFile: true,
          rideFile: true,
          emailLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.invoice.count(),
    ]);

  const freeReceivableOptions = freeReceivables.map((item) => ({
    id: item.id,
    name: `${item.title} · ${item.client.name}`,
  }));

  const allReceivableOptions = allReceivables.map((item) => ({
    id: item.id,
    name: `${item.title} · ${item.client.name}`,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg border-amber-100 bg-amber-50/30">
        <CardHeader>
          <CardTitle>Facturas SRI</CardTitle>
          <CardDescription>
            Sube XML y RIDE descargados del facturador y reenvíalos con Resend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Archivos</TableHead>
                <TableHead>Enviar</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="font-medium">
                      {invoice.invoiceNumber ?? "Sin número"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(invoice.issueDate)}
                    </div>
                  </TableCell>
                  <TableCell>{invoice.client.name}</TableCell>
                  <TableCell>
                    {formatCurrency(invoice.total.toString())}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={invoice.status} />
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-emerald-700">
                      XML: {invoice.xmlFile ? "✓" : "pendiente"}
                    </div>
                    <div className="text-xs text-blue-700">
                      RIDE: {invoice.rideFile ? "✓" : "pendiente"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <form
                      action={sendInvoiceEmail}
                      className="flex min-w-48 gap-2"
                    >
                      <input
                        type="hidden"
                        name="invoiceId"
                        value={invoice.id}
                      />
                      <Input
                        name="to"
                        type="email"
                        defaultValue={
                          invoice.client.billingEmail ??
                          invoice.client.email ??
                          ""
                        }
                        placeholder="cliente@email.com"
                        className="h-9"
                        required
                      />
                      <Button type="submit" size="sm">
                        Enviar
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right">
                    <InvoiceEditDialog
                      invoice={forInvoiceDialog(invoice)}
                      clients={clients}
                      projects={projects}
                      receivables={allReceivableOptions}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!invoices.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aún no hay facturas cargadas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/facturas"
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Cargar factura</CardTitle>
          <CardDescription>
            Adjunta el XML autorizado y el RIDE PDF del Facturador SRI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createInvoice}>
            <FieldGroup>
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <FormSelect
                  name="clientId"
                  defaultValue={clients[0]?.id}
                  options={clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  }))}
                />
              </Field>
              <Field>
                <FieldLabel>Proyecto</FieldLabel>
                <FormSelect
                  name="projectId"
                  defaultValue="none"
                  options={[
                    { value: "none", label: "Sin proyecto" },
                    ...projects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel>Hito relacionado</FieldLabel>
                <FormSelect
                  name="receivableId"
                  defaultValue="none"
                  options={[
                    { value: "none", label: "Sin hito" },
                    ...freeReceivableOptions.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Número</FieldLabel>
                  <Input name="invoiceNumber" />
                </Field>
                <Field>
                  <FieldLabel>Fecha emisión</FieldLabel>
                  <DatePickerField name="issueDate" />
                </Field>
              </div>
              <Field>
                <FieldLabel>Clave de acceso</FieldLabel>
                <Input name="accessKey" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Subtotal</FieldLabel>
                  <Input name="subtotal" type="number" step="0.01" />
                </Field>
                <Field>
                  <FieldLabel>IVA</FieldLabel>
                  <Input name="taxAmount" type="number" step="0.01" />
                </Field>
                <Field>
                  <FieldLabel>Total</FieldLabel>
                  <Input name="total" type="number" step="0.01" required />
                </Field>
              </div>
              <Field>
                <FieldLabel>XML</FieldLabel>
                <Input
                  name="xml"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                />
              </Field>
              <Field>
                <FieldLabel>RIDE PDF</FieldLabel>
                <Input name="ride" type="file" accept=".pdf,application/pdf" />
              </Field>
              <input type="hidden" name="status" value="READY_TO_SEND" />
              <Button type="submit" disabled={!clients.length}>
                Guardar factura
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
