import Link from "next/link";

import {
  ClientEditDialog,
  CreateClientDialog,
} from "@/components/admin/dialogs/client-dialog";
import { ClientAvatar } from "@/components/admin/entity-avatar";
import { forClientDialog } from "@/lib/admin/serialize";
import { Pagination } from "@/components/admin/pagination";
import { getClientsPageData } from "@/lib/admin/queries/clients";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CountPill({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
      {value}
    </span>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const { page, pageSize, clients, total } =
    await getClientsPageData(pageParam);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} cliente{total !== 1 ? "s" : ""} registrado
            {total !== 1 ? "s" : ""}.
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
                  <TableHead className="pl-5">Cliente</TableHead>
                  <TableHead>Razón social / RUC</TableHead>
                  <TableHead>Email facturación</TableHead>
                  <TableHead className="text-center">Proyectos</TableHead>
                  <TableHead className="text-center">Hitos</TableHead>
                  <TableHead className="text-center">Facturas</TableHead>
                  <TableHead className="text-center">Credenciales</TableHead>
                  <TableHead className="pr-5 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="group">
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <ClientAvatar name={client.name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/clientes/${client.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {client.name}
                          </Link>
                          {client.email ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {client.email}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {client.legalName ?? (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
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
                    <TableCell className="text-center">
                      <CountPill value={client._count.projects} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CountPill value={client._count.receivables} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CountPill value={client._count.invoices} />
                    </TableCell>
                    <TableCell className="text-center">
                      <CountPill value={client._count.credentials} />
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
              pageSize={pageSize}
              total={total}
              basePath="/admin/clientes"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
