"use server";

import { revalidatePath } from "next/cache";

import type { CredentialKind } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { credentialSchema, parseForm } from "@/lib/admin/schemas";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createCredential(formData: FormData) {
  await requireAdmin();
  const data = parseForm(credentialSchema, formData);
  const encrypted = data.secret ? encryptSecret(data.secret) : {};

  await prisma.credential.create({
    data: {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      kind: data.kind as CredentialKind,
      url: data.url,
      username: data.username,
      accessMethod: data.accessMethod,
      notes: data.notes,
      ...encrypted,
    },
  });

  revalidatePath("/admin/credenciales");
}

export async function updateCredential(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(credentialSchema, formData);
  const encrypted = data.secret ? encryptSecret(data.secret) : {};

  await prisma.credential.update({
    where: { id },
    data: {
      clientId: data.clientId,
      projectId: data.projectId,
      title: data.title,
      kind: data.kind as CredentialKind,
      url: data.url,
      username: data.username,
      accessMethod: data.accessMethod,
      notes: data.notes,
      ...encrypted,
    },
  });

  revalidatePath("/admin/credenciales");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

export async function revealCredential(id: string) {
  await requireAdmin();

  const credential = await prisma.credential.update({
    where: { id },
    data: { lastViewedAt: new Date() },
  });

  if (
    !credential.encryptedSecret ||
    !credential.secretIv ||
    !credential.secretTag
  ) {
    return credential.accessMethod ?? "Sin secreto guardado";
  }

  return decryptSecret({
    encryptedSecret: credential.encryptedSecret,
    secretIv: credential.secretIv,
    secretTag: credential.secretTag,
  });
}

export async function createCredentialState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createCredential(formData));
}

export async function updateCredentialState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateCredential(id, formData));
}
