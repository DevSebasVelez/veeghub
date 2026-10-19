"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseForm, payeeSchema } from "@/lib/admin/schemas";

export async function createPayee(formData: FormData) {
  await requireAdmin();
  const data = parseForm(payeeSchema, formData);

  await prisma.payee.create({ data });

  revalidatePath("/admin/egresos");
}

export async function updatePayee(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(payeeSchema, formData);

  // Only the default for new payments changes; each expense keeps the
  // classification it was registered with.
  await prisma.payee.update({ where: { id }, data });

  revalidatePath("/admin/egresos");
}

export async function deletePayee(id: string) {
  await requireAdmin();

  const used = await prisma.expense.count({ where: { payeeId: id } });
  if (used > 0) {
    throw new Error(
      "Este beneficiario tiene egresos registrados; no se puede eliminar.",
    );
  }

  await prisma.payee.delete({ where: { id } });

  revalidatePath("/admin/egresos");
}
