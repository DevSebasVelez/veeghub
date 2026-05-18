import { createReceivable, recordPayment } from "@/app/admin/actions";
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

export default async function FinancePage() {
  const [clients, projects, receivables] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.receivable.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
        payments: { orderBy: { paidAt: "desc" }, take: 2 },
      },
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Cuentas por cobrar</CardTitle>
          <CardDescription>
            Hitos flexibles: entrada, avances, entregas finales o pagos únicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hito</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Vence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.project?.name ?? "Sin proyecto"}
                    </div>
                  </TableCell>
                  <TableCell>{item.client.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.amount.toString())}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.paidAmount.toString())}
                  </TableCell>
                  <TableCell>{formatDate(item.dueDate)}</TableCell>
                </TableRow>
              ))}
              {!receivables.length ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aún no hay cuentas por cobrar.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Nuevo hito de cobro</CardTitle>
            <CardDescription>
              Úsalo para entradas, avances o pagos finales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createReceivable}>
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
                  <FieldLabel htmlFor="title">Concepto</FieldLabel>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Entrada proyecto web"
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="amount">Monto</FieldLabel>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="dueDate">Fecha esperada</FieldLabel>
                    <Input id="dueDate" name="dueDate" type="date" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="status">Estado</FieldLabel>
                  <select
                    id="status"
                    name="status"
                    defaultValue="PLANNED"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="PLANNED">Planificado</option>
                    <option value="INVOICED">Facturado</option>
                    <option value="PARTIALLY_PAID">Parcial</option>
                    <option value="PAID">Pagado</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Notas</FieldLabel>
                  <Textarea id="description" name="description" rows={3} />
                </Field>
                <Button type="submit" disabled={!clients.length}>
                  Crear hito
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Registrar pago</CardTitle>
            <CardDescription>
              Permite pagos parciales o completos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={recordPayment}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="receivableId">Hito</FieldLabel>
                  <select
                    id="receivableId"
                    name="receivableId"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    required
                  >
                    {receivables
                      .filter((item) => item.status !== "PAID")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} · {item.client.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="amount">Monto pagado</FieldLabel>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="paidAt">Fecha</FieldLabel>
                    <Input id="paidAt" name="paidAt" type="date" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="method">Método</FieldLabel>
                  <Input
                    id="method"
                    name="method"
                    placeholder="Transferencia, efectivo..."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reference">Referencia</FieldLabel>
                  <Input id="reference" name="reference" />
                </Field>
                <Button type="submit">Registrar pago</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
