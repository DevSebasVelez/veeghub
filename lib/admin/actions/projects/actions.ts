"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { compactId, slugify } from "@/lib/admin/slug";
import { projectSchema, parseForm } from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createProject(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(projectSchema, formData);
    const baseSlug = slugify(data.name) || compactId();

    await prisma.project.create({
      data: {
        ...data,
        slug: `${baseSlug}-${compactId()}`,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/proyectos");
  });
}

export async function updateProject(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(projectSchema, formData);

    await prisma.project.update({
      where: { id },
      data,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/proyectos");
    revalidatePath(`/admin/proyectos/${id}`);
    if (data.clientId) revalidatePath(`/admin/clientes/${data.clientId}`);
  });
}

export async function createProjectState(
  _state: AdminFormState,
  formData: FormData,
) {
  return createProject(formData);
}

export async function updateProjectState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return updateProject(id, formData);
}
