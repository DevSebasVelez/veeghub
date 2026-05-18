import { createInvoice, sendInvoiceEmail } from "@/app/admin/actions";
import prisma from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

export default async function InvoicesPage() {
  const [clients, projects, receivables, invoices] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.receivable.findMany({
      where: { invoice: null },
      orderBy: { createdAt: "desc" },
      include: { client: true, project: true },
    }),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        project: true,
        xmlFile: true,
        rideFile: true,
        emailLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg">
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
                    <Badge variant="outline">{invoice.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      XML: {invoice.xmlFile ? "ok" : "pendiente"}
                    </div>
                    <div className="text-xs">
                      RIDE: {invoice.rideFile ? "ok" : "pendiente"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <form
                      action={sendInvoiceEmail}
                      className="flex min-w-64 gap-2"
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
                </TableRow>
              ))}
              {!invoices.length ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aún no hay facturas cargadas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
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
                <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
                <select
                  id="clientId"
                  name="clientId"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  required
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="projectId">Proyecto</FieldLabel>
                <select
                  id="projectId"
                  name="projectId"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="none">Sin proyecto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="receivableId">Hito relacionado</FieldLabel>
                <select
                  id="receivableId"
                  name="receivableId"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="none">Sin hito</option>
                  {receivables.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="invoiceNumber">Número</FieldLabel>
                  <Input id="invoiceNumber" name="invoiceNumber" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="issueDate">Fecha emisión</FieldLabel>
                  <Input id="issueDate" name="issueDate" type="date" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="accessKey">Clave de acceso</FieldLabel>
                <Input id="accessKey" name="accessKey" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="subtotal">Subtotal</FieldLabel>
                  <Input
                    id="subtotal"
                    name="subtotal"
                    type="number"
                    step="0.01"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="taxAmount">IVA</FieldLabel>
                  <Input
                    id="taxAmount"
                    name="taxAmount"
                    type="number"
                    step="0.01"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="total">Total</FieldLabel>
                  <Input
                    id="total"
                    name="total"
                    type="number"
                    step="0.01"
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="xml">XML</FieldLabel>
                <Input
                  id="xml"
                  name="xml"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ride">RIDE PDF</FieldLabel>
                <Input
                  id="ride"
                  name="ride"
                  type="file"
                  accept=".pdf,application/pdf"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="body">
                  Mensaje por defecto al enviar
                </FieldLabel>
                <Textarea
                  id="body"
                  name="body"
                  rows={3}
                  placeholder="Se usa en el formulario de envío si luego lo personalizas."
                />
              </Field>
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
