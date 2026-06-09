import prisma from "@/lib/db/prisma";

export async function getPaymentsSectionData(selectedYear: number) {
  return Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: {
          gte: new Date(`${selectedYear}-01-01`),
          lt: new Date(`${selectedYear + 1}-01-01`),
        },
      },
      orderBy: { paidAt: "desc" },
      include: {
        receivable: {
          select: {
            id: true,
            title: true,
            client: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      select: { paidAt: true },
      orderBy: { paidAt: "asc" },
      distinct: ["paidAt"],
    }),
  ]);
}
