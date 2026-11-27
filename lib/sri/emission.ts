import type { Prisma, SriEnvironment } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { isSriRegime, rimpeLegend, type SriRegime } from "@/lib/sri/regime";

// Database side of issuing: which emission point, which secuencial, which
// regime. Pure XML building lives in build-invoice.ts.

export class SriEmissionError extends Error {}

export type SriTaxContext = {
  profileId: string;
  regime: SriRegime;
  /** contribuyenteRimpe legend, null for régimen general. */
  legend: string | null;
  /** IVA rates the profile allows, as numbers (0, 15...). */
  vatRates: number[];
};

/**
 * Regime and IVA in force on the invoice's issue day (a calendar day stored as
 * UTC midnight, like every @db.Date). Refuses instead of guessing when no
 * profile covers the day or its SRI regime was never set.
 */
export async function getSriTaxContext(
  issueDay: Date,
  db: Prisma.TransactionClient = prisma,
): Promise<SriTaxContext> {
  const profile = await db.taxProfile.findFirst({
    where: {
      validFrom: { lte: issueDay },
      OR: [{ validTo: null }, { validTo: { gte: issueDay } }],
    },
    orderBy: { validFrom: "desc" },
  });
  if (!profile) {
    throw new SriEmissionError(
      "No hay configuración tributaria vigente para la fecha de emisión. Créala en Finanzas › Impuestos.",
    );
  }
  if (!isSriRegime(profile.sriRegime)) {
    throw new SriEmissionError(
      "La configuración tributaria vigente no indica el régimen para la factura electrónica.",
    );
  }
  return {
    profileId: profile.id,
    regime: profile.sriRegime,
    legend: rimpeLegend(profile.sriRegime),
    vatRates: profile.vatRates.map((rate) => Number(rate.toString())),
  };
}

/**
 * Takes the next secuencial of an emission point. Must run inside the same
 * transaction that creates the invoice: the row update locks the point, so two
 * emissions wait for each other, and a rollback gives the number back. A
 * number is never reused once the invoice commits.
 */
export async function takeSequential(
  tx: Prisma.TransactionClient,
  emissionPointId: string,
  environment: SriEnvironment,
) {
  const point = await tx.emissionPoint.findUnique({
    where: { id: emissionPointId },
    select: { environment: true, active: true },
  });
  if (!point) throw new SriEmissionError("El punto de emisión no existe.");
  if (!point.active) throw new SriEmissionError("El punto de emisión está inactivo.");
  // The environment is always explicit and must match the point's: a test
  // invoice never takes a production number, nor the other way round.
  if (point.environment !== environment) {
    throw new SriEmissionError(
      `El punto de emisión es de ${point.environment} y la factura de ${environment}.`,
    );
  }

  const updated = await tx.emissionPoint.update({
    where: { id: emissionPointId },
    data: { nextSequential: { increment: 1 } },
    select: { establishment: true, emissionPoint: true, nextSequential: true },
  });
  const sequential = updated.nextSequential - 1;
  return {
    establishment: updated.establishment,
    emissionPoint: updated.emissionPoint,
    sequential,
    /** "001-002-000000001", how VeegHub numbers invoices. */
    number: `${updated.establishment}-${updated.emissionPoint}-${String(sequential).padStart(9, "0")}`,
  };
}
