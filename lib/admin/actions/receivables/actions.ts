"use server";

import { revalidatePath } from "next/cache";

import type { ReceivableStatus } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { receivableSchema, parseForm } from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createReceivable(formData: FormData) {
  await requireAdmin();
  const data = parseForm(receivableSchema, formData);

  await prisma.receivable.create({ data });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
}

export async function updateReceivable(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(receivableSchema, formData);

  await prisma.receivable.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
  if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  if (data.projectId) revalidatePath(`/admin/proyectos/${data.projectId}`);
}

export async function updateReceivableStatus(id: string, status: string) {
  await requireAdmin();

  const receivable = await prisma.receivable.update({
    where: { id },
    data: { status: status as ReceivableStatus },
    select: { clientId: true, projectId: true },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/finanzas");
  revalidatePath(`/admin/clientes/${receivable.clientId}`);
  if (receivable.projectId) {
    revalidatePath(`/admin/proyectos/${receivable.projectId}`);
  }
}

export async function createReceivableState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createReceivable(formData));
}

export async function updateReceivableState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateReceivable(id, formData));
}
