import { createCredential } from "@/app/admin/actions";
import { CredentialSecret } from "@/app/admin/credenciales/credential-secret";
import prisma from "@/lib/db/prisma";
import { formatDate } from "@/lib/admin/format";
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

export default async function CredentialsPage() {
  const [clients, projects, credentials] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.credential.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Credenciales</CardTitle>
          <CardDescription>
            Accesos cifrados para reemplazar notas expuestas en Notion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acceso</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Secreto</TableHead>
                <TableHead>Visto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <div className="font-medium">{credential.title}</div>
                    <Badge variant="outline" className="mt-1">
                      {credential.kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {credential.project?.name ??
                      credential.client?.name ??
                      "General"}
                  </TableCell>
                  <TableCell>{credential.username ?? "Sin usuario"}</TableCell>
                  <TableCell>
                    <CredentialSecret
                      id={credential.id}
                      preview={credential.secretPreview}
                    />
                  </TableCell>
                  <TableCell>{formatDate(credential.lastViewedAt)}</TableCell>
                </TableRow>
              ))}
              {!credentials.length ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aún no hay credenciales guardadas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Nuevo acceso</CardTitle>
          <CardDescription>
            El secreto se cifra antes de guardarse en la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCredential}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Nombre</FieldLabel>
                <Input
                  id="title"
                  name="title"
                  placeholder="Google Workspace cliente"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="kind">Tipo</FieldLabel>
                <select
                  id="kind"
                  name="kind"
                  defaultValue="LOGIN"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="LOGIN">Login</option>
                  <option value="API_KEY">API key</option>
                  <option value="DATABASE">Base de datos</option>
                  <option value="HOSTING">Hosting</option>
                  <option value="SOCIAL_MEDIA">Red social</option>
                  <option value="EMAIL">Email</option>
                  <option value="OTHER">Otro</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
                <select
                  id="clientId"
                  name="clientId"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="none">General</option>
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
                <FieldLabel htmlFor="url">URL</FieldLabel>
                <Input id="url" name="url" type="url" />
              </Field>
              <Field>
                <FieldLabel htmlFor="username">Usuario</FieldLabel>
                <Input id="username" name="username" autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret">Contraseña / token</FieldLabel>
                <Textarea id="secret" name="secret" rows={3} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notas</FieldLabel>
                <Textarea id="notes" name="notes" rows={3} />
              </Field>
              <Button type="submit">Guardar cifrado</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
