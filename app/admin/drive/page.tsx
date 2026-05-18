import Link from "next/link";

import { createFolder, uploadDriveFile } from "@/app/admin/actions";
import prisma from "@/lib/db/prisma";
import { formatBytes, formatDate } from "@/lib/admin/format";
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

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  const folderId = folder ?? null;
  const [clients, projects, currentFolder, folders, files] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    folderId
      ? prisma.driveFolder.findUnique({
          where: { id: folderId },
          include: { parent: true },
        })
      : null,
    prisma.driveFolder.findMany({
      where: { parentId: folderId },
      orderBy: { name: "asc" },
      include: { client: true, project: true },
    }),
    prisma.driveFile.findMany({
      where: { folderId },
      orderBy: { createdAt: "desc" },
      include: { client: true, project: true },
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Drive R2</CardTitle>
          <CardDescription>
            Carpetas y archivos asociados a clientes, proyectos o facturas.
          </CardDescription>
          <div className="text-sm text-muted-foreground">
            {currentFolder ? (
              <>
                Carpeta actual: {currentFolder.name} ·{" "}
                <Link
                  href="/admin/drive"
                  className="underline underline-offset-4"
                >
                  volver a raíz
                </Link>
              </>
            ) : (
              "Carpeta raíz"
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium">Carpetas</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/admin/drive?folder=${item.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {item.project?.name ?? item.client?.name ?? "General"}
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {!folders.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Sin carpetas aquí.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">Archivos</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.mimeType}
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>
                      {file.project?.name ?? file.client?.name ?? "General"}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/drive/download/${file.id}`}>
                          Descargar
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!files.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-16 text-center text-muted-foreground"
                    >
                      Sin archivos aquí.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Nueva carpeta</CardTitle>
            <CardDescription>
              Organiza por cliente, proyecto o tema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createFolder}>
              <FieldGroup>
                <input
                  type="hidden"
                  name="parentId"
                  value={folderId ?? "none"}
                />
                <Field>
                  <FieldLabel htmlFor="name">Nombre</FieldLabel>
                  <Input id="name" name="name" required />
                </Field>
                <RelationFields clients={clients} projects={projects} />
                <Button type="submit">Crear carpeta</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Subir archivo</CardTitle>
            <CardDescription>
              Se guarda en Cloudflare R2 y queda indexado en Veeghub.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadDriveFile}>
              <FieldGroup>
                <input
                  type="hidden"
                  name="folderId"
                  value={folderId ?? "none"}
                />
                <Field>
                  <FieldLabel htmlFor="file">Archivo</FieldLabel>
                  <Input id="file" name="file" type="file" required />
                </Field>
                <RelationFields clients={clients} projects={projects} />
                <Button type="submit">Subir a R2</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RelationFields({
  clients,
  projects,
}: {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
}) {
  return (
    <>
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
    </>
  );
}
