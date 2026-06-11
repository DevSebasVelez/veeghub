"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { taskSchema, parseForm } from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

export async function createTask(formData: FormData) {
  await requireAdmin();
  const data = parseForm(taskSchema, formData);

  await prisma.task.create({ data });

  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/proyectos");
}

export async function updateTask(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(taskSchema, formData);

  await prisma.task.update({
    where: { id },
    data: {
      ...data,
      completedAt: data.status === "DONE" ? new Date() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/proyectos");
}

export async function toggleTaskStatus(id: string, done: boolean) {
  await requireAdmin();

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
    },
    select: { projectId: true },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin/proyectos");
  revalidatePath(`/admin/proyectos/${task.projectId}`);
}

export async function renameTask(id: string, title: string) {
  await requireAdmin();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("El título no puede estar vacío");

  const task = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true },
  });

  await prisma.task.update({
    where: { id },
    data: { title: trimmed },
  });

  revalidatePath("/admin/tareas");
  if (task?.projectId) revalidatePath(`/admin/proyectos/${task.projectId}`);
}

export async function createTaskState(
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => createTask(formData));
}

export async function updateTaskState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateTask(id, formData));
}
