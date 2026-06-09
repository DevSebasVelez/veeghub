"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { clientSchema, parseForm } from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createClient(formData: FormData) {
  await requireAdmin();
  const data = parseForm(clientSchema, formData);

  await prisma.client.create({ data });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
}

export async function updateClient(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(clientSchema, formData);

  await prisma.client.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
}

export async function updateClientState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateClient(id, formData));
}
