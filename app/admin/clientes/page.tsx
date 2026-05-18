import Link from "next/link";

import { createClient } from "@/app/admin/actions";
import { ClientEditDialog } from "@/components/admin/dialogs/client-dialog";
import { forClientDialog } from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import prisma from "@/lib/db/prisma";
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

const PAGE_SIZE = 10;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPage(pageParam);
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: {
          select: {
            projects: true,
            receivables: true,
            invoices: true,
            credentials: true,
          },
        },
      },
    }),
    prisma.client.count(),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            Contactos, datos de facturación y relación con proyectos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Facturación</TableHead>
                <TableHead>Proyectos</TableHead>
                <TableHead>Credenciales</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/admin/clientes/${client.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {client.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {client.email ?? "Sin email principal"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {client.billingEmail ?? client.email ?? "Sin correo"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {client.taxId ?? "Sin RUC/cédula"}
                    </div>
                  </TableCell>
                  <TableCell>{client._count.projects}</TableCell>
                  <TableCell>{client._count.credentials}</TableCell>
                  <TableCell className="text-right">
                    <ClientEditDialog client={forClientDialog(client)} />
                  </TableCell>
                </TableRow>
              ))}
              {!clients.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aún no hay clientes.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/clientes"
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Nuevo cliente</CardTitle>
          <CardDescription>
            Guarda datos comerciales y de envío de facturas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createClient}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nombre visible</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="legalName">Razón social</FieldLabel>
                <Input id="legalName" name="legalName" />
              </Field>
              <Field>
                <FieldLabel htmlFor="taxId">RUC o cédula</FieldLabel>
                <Input id="taxId" name="taxId" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="email">Email principal</FieldLabel>
                  <Input id="email" name="email" type="email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="billingEmail">
                    Email facturación
                  </FieldLabel>
                  <Input id="billingEmail" name="billingEmail" type="email" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                <Input id="phone" name="phone" />
              </Field>
              <Field>
                <FieldLabel htmlFor="website">Sitio web</FieldLabel>
                <Input id="website" name="website" type="url" />
              </Field>
              <Field>
                <FieldLabel htmlFor="address">Dirección</FieldLabel>
                <Textarea id="address" name="address" rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notas</FieldLabel>
                <Textarea id="notes" name="notes" rows={3} />
              </Field>
              <Button type="submit">Crear cliente</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
