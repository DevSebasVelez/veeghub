import prisma from "@/lib/db/prisma";
import { dayStartUtc } from "@/lib/admin/format";

export async function getTaxProfiles() {
  return prisma.taxProfile.findMany({
    orderBy: { validFrom: "desc" },
  });
}

/** The profile in force today, if one was configured. */
export async function getCurrentTaxProfile() {
  const today = dayStartUtc(new Date());

  return prisma.taxProfile.findFirst({
    where: {
      validFrom: { lte: today },
      OR: [{ validTo: null }, { validTo: { gte: today } }],
    },
    orderBy: { validFrom: "desc" },
  });
}
