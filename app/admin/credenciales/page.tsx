import { CredentialSecret } from "@/app/admin/credenciales/credential-secret";
import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { getPage, Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forCredentialDialog } from "@/lib/admin/serialize";
import prisma from "@/lib/db/prisma";
import { formatDate } from "@/lib/admin/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPage(pageParam);
  const [clients, projects, credentials, total] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.credential.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.credential.count(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credenciales</h1>
          <p className="text-sm text-muted-foreground">
            Accesos cifrados para reemplazar notas expuestas en Notion.
          </p>
        </div>
        <CredentialDialog clients={clients} projects={projects} mode="create" />
      </div>

      <Card className="rounded-lg border-violet-100 bg-violet-50/30">
        <CardHeader>
          <CardTitle>Vault</CardTitle>
          <CardDescription>
            Passwords, tokens, accesos OAuth y notas seguras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acceso</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Método / secreto</TableHead>
                <TableHead>Visto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <div className="font-medium">{credential.title}</div>
                    <div className="mt-1">
                      <StatusBadge value={credential.kind} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {credential.project?.name ?? credential.client?.name ?? "General"}
                  </TableCell>
                  <TableCell>{credential.username ?? "Sin usuario"}</TableCell>
                  <TableCell>
                    {credential.accessMethod ? (
                      <div className="mb-1 text-xs text-muted-foreground">
                        {credential.accessMethod}
                      </div>
                    ) : null}
                    <CredentialSecret id={credential.id} preview={credential.secretPreview} />
                  </TableCell>
                  <TableCell>{formatDate(credential.lastViewedAt)}</TableCell>
                  <TableCell className="text-right">
                    <CredentialDialog
                      credential={forCredentialDialog(credential)}
                      clients={clients}
                      projects={projects}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!credentials.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Aún no hay credenciales guardadas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/credenciales" />
        </CardContent>
      </Card>
    </div>
  );
}
