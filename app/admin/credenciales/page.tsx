import { CredentialSecret } from "@/app/admin/credenciales/credential-secret";
import { CredentialDialog } from "@/components/admin/dialogs/credential-dialog";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { forCredentialDialog } from "@/lib/admin/serialize";
import { getCredentialsPageData } from "@/lib/admin/queries/credentials";
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

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const { page, pageSize, clients, projects, credentials, total } =
    await getCredentialsPageData(pageParam);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Credenciales
          </h1>
          <p className="text-sm text-muted-foreground">
            Accesos cifrados para reemplazar notas expuestas en Notion.
          </p>
        </div>
        <CredentialDialog clients={clients} projects={projects} mode="create" />
      </div>

      <Card className="rounded-lg border-violet-100 bg-violet-50/30 dark:border-violet-900/40 dark:bg-violet-950/20">
        <CardHeader>
          <CardTitle>Vault</CardTitle>
          <CardDescription>
            Passwords, tokens, accesos OAuth y notas seguras.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Acceso</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Método / secreto</TableHead>
                  <TableHead>Visto</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{credential.title}</div>
                      <div className="mt-1">
                        <StatusBadge value={credential.kind} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {credential.project?.name ??
                        credential.client?.name ??
                        "General"}
                    </TableCell>
                    <TableCell>
                      {credential.username ?? "Sin usuario"}
                    </TableCell>
                    <TableCell>
                      {credential.accessMethod ? (
                        <div className="mb-1 text-xs text-muted-foreground">
                          {credential.accessMethod}
                        </div>
                      ) : null}
                      <CredentialSecret
                        id={credential.id}
                        preview={credential.secretPreview}
                      />
                    </TableCell>
                    <TableCell>{formatDate(credential.lastViewedAt)}</TableCell>
                    <TableCell className="pr-6 text-right">
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
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Aún no hay credenciales guardadas.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pt-2">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              basePath="/admin/credenciales"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
