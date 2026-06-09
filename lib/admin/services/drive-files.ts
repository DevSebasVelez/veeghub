import prisma from "@/lib/db/prisma";
import { compactId } from "@/lib/admin/slug";
import { uploadToR2 } from "@/lib/storage/r2";
import { text } from "@/lib/admin/actions/shared";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uploadFileRecord({
  file,
  folderId,
  clientId,
  projectId,
  prefix,
}: {
  file: File;
  folderId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  prefix: string;
}) {
  if (!file.size) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const objectKey = `${prefix}/${Date.now()}-${compactId()}-${safeFileName(file.name)}`;

  await uploadToR2({
    key: objectKey,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  return prisma.driveFile.create({
    data: {
      name: file.name,
      objectKey,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      folderId,
      clientId,
      projectId,
    },
  });
}

export function fileMetaFromForm(
  formData: FormData,
  prefix: string,
): { objectKey: string; name: string; mimeType: string; size: number } | null {
  const objectKey = text(formData, `${prefix}ObjectKey`);
  const name = text(formData, `${prefix}Name`);
  const mimeType = text(formData, `${prefix}MimeType`);
  const sizeRaw = text(formData, `${prefix}Size`);
  if (!objectKey || !name || !mimeType || !sizeRaw) return null;
  const size = parseInt(sizeRaw, 10);
  if (!Number.isFinite(size) || size <= 0) return null;
  return { objectKey, name, mimeType, size };
}

export async function registerFileKey({
  objectKey,
  name,
  mimeType,
  size,
  clientId,
  projectId,
}: {
  objectKey: string;
  name: string;
  mimeType: string;
  size: number;
  clientId: string | null;
  projectId: string | null;
}) {
  return prisma.driveFile.create({
    data: { name, objectKey, mimeType, size, clientId, projectId },
  });
}
