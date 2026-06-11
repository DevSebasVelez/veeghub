"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { optionalId, requiredText } from "@/lib/admin/actions/shared";

export async function createComment(formData: FormData) {
  await requireAdmin();
  const body = requiredText(formData, "body");
  const clientId = optionalId(formData, "clientId");
  const projectId = optionalId(formData, "projectId");

  await prisma.comment.create({ data: { body, clientId, projectId } });

  if (clientId) revalidatePath(`/admin/clientes/${clientId}`);
  if (projectId) revalidatePath(`/admin/proyectos/${projectId}`);
}

export async function deleteComment(id: string) {
  await requireAdmin();
  const comment = await prisma.comment.delete({ where: { id } });

  if (comment.clientId) revalidatePath(`/admin/clientes/${comment.clientId}`);
  if (comment.projectId) {
    revalidatePath(`/admin/proyectos/${comment.projectId}`);
  }
}
