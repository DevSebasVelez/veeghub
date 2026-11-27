"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { actionState } from "@/lib/admin/actions/shared";
import type { AdminFormState } from "@/lib/admin/actions/types";

// Going live (B7): the PRODUCCION emission point is created on purpose, by a
// human click here, never by a migration. Its secuencial starts where the
// person says (1 if 001-002 was never used in the SRI's facturador).

export async function createProductionEmissionPoint(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const raw = String(formData.get("nextSequential") ?? "").trim();
    if (!/^\d{1,9}$/.test(raw) || Number(raw) < 1) {
      throw new Error("El primer número debe ser un entero entre 1 y 999999999.");
    }
    if (formData.get("confirm") !== "on") {
      throw new Error("Confirma que las facturas de este punto son reales ante el SRI.");
    }

    const existing = await prisma.emissionPoint.findFirst({
      where: { establishment: "001", emissionPoint: "002", environment: "PRODUCCION" },
    });
    if (existing) throw new Error("El punto 001-002 de producción ya existe.");

    // Same establishment address as the test point, which mirrors the RUC.
    const test = await prisma.emissionPoint.findFirst({
      where: { establishment: "001", emissionPoint: "002", environment: "PRUEBAS" },
      select: { address: true },
    });

    await prisma.emissionPoint.create({
      data: {
        establishment: "001",
        emissionPoint: "002",
        environment: "PRODUCCION",
        label: "VeegHub · producción",
        nextSequential: Number(raw),
        address: test?.address ?? null,
        active: true,
      },
    });

    revalidatePath("/admin/finanzas/impuestos");
    revalidatePath("/admin/facturas/nueva");
  });
}
