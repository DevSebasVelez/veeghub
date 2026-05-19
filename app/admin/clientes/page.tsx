import Link from "next/link";

import {
  ClientEditDialog,
  CreateClientDialog,
} from "@/components/admin/dialogs/client-dialog";
import { forClientDialog } from "@/lib/admin/serialize";
import { getPage, Pagination } from "@/components/admin/pagination";
import prisma from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 15;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPage(pageParam);
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} cliente{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}.
          </p>
        </div>
        <CreateClientDialog />
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Cliente</TableHead>
                  <TableHead>Razón social / RUC</TableHead>
                  <TableHead>Email facturación</TableHead>
                  <TableHead className="text-center">Proyectos</TableHead>
                  <TableHead className="text-center">Hitos</TableHead>
                  <TableHead className="text-center">Facturas</TableHead>
                  <TableHead className="text-center">Credenciales</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="group">
                    <TableCell className="pl-6">
                      <Link
                        href={`/admin/clientes/${client.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {client.name}
                      </Link>
                      {client.email ? (
                        <div className="text-xs text-muted-foreground">
                          {client.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{client.legalName ?? <span className="text-muted-foreground/50">—</span>}</div>
                      {client.taxId ? (
                        <div className="text-xs text-muted-foreground">
                          {client.taxId}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.billingEmail ?? client.email ?? (
                        <span className="opacity-40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {client._count.projects > 0 ? client._count.projects : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {client._count.receivables > 0 ? client._count.receivables : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {client._count.invoices > 0 ? client._count.invoices : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {client._count.credentials > 0 ? client._count.credentials : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
                        <ClientEditDialog client={forClientDialog(client)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!clients.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Aún no hay clientes.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/admin/clientes"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
