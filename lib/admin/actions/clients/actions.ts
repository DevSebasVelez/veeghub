"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { clientSchema, parseForm } from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createClient(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(clientSchema, formData);

    await prisma.client.create({ data });

    revalidatePath("/admin");
    revalidatePath("/admin/clientes");
  });
}

export async function updateClient(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(clientSchema, formData);

    await prisma.client.update({
      where: { id },
      data,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${id}`);
  });
}

export async function updateClientState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return updateClient(id, formData);
}
