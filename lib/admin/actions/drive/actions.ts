"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  driveFileSchema,
  folderSchema,
  parseForm,
} from "@/lib/admin/schemas";
import {
  optionalId,
  requiredText,
  actionState,
} from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { uploadFileRecord } from "@/lib/admin/services/drive-files";

export async function createFolder(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(folderSchema, formData);

    await prisma.driveFolder.create({ data });

    revalidatePath("/admin/drive");
  });
}

export async function updateFolder(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(folderSchema, formData);

    await prisma.driveFolder.update({
      where: { id },
      data,
    });

    revalidatePath("/admin/drive");
    if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
    if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
  });
}

export async function uploadDriveFile(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const file = formData.get("file") as File | null;

    if (!file || !file.size) {
      throw new Error("Selecciona un archivo para subir.");
    }

    await uploadFileRecord({
      file,
      folderId: optionalId(formData, "folderId"),
      clientId: optionalId(formData, "clientId"),
      projectId: optionalId(formData, "projectId"),
      prefix: "drive",
    });

    revalidatePath("/admin/drive");
  });
}

export async function downloadDriveFile(formData: FormData) {
  await requireAdmin();
  redirect(`/admin/drive/download/${requiredText(formData, "fileId")}`);
}

export async function updateDriveFile(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(driveFileSchema, formData);

    await prisma.driveFile.update({
      where: { id },
      data,
    });

    revalidatePath("/admin/drive");
    if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
    if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
  });
}

export async function deleteFolder(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await prisma.driveFolder.delete({ where: { id } });
    revalidatePath("/admin/drive");
    revalidatePath("/admin");
  });
}

export async function deleteDriveFile(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    await prisma.driveFile.delete({ where: { id } });
    revalidatePath("/admin/drive");
    revalidatePath("/admin");
  });
}

export async function registerDriveFile(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {

    const name = String(formData.get("name") ?? "").trim();
    const objectKey = String(formData.get("objectKey") ?? "").trim();
    const mimeType =
      String(formData.get("mimeType") ?? "").trim() || "application/octet-stream";
    const size = parseInt(String(formData.get("size") ?? "0"), 10);
    const folderId = optionalId(formData, "folderId");
    const clientId = optionalId(formData, "clientId");
    const projectId = optionalId(formData, "projectId");

    if (!name || !objectKey) {
      throw new Error("Datos de archivo incompletos.");
    }

    await prisma.driveFile.create({
      data: { name, objectKey, mimeType, size, folderId, clientId, projectId },
    });

    revalidatePath("/admin/drive");
  });
}

export async function updateFolderState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return updateFolder(id, formData);
}

export async function createFolderState(
  _state: AdminFormState,
  formData: FormData,
) {
  return createFolder(formData);
}

export async function updateDriveFileState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return updateDriveFile(id, formData);
}
