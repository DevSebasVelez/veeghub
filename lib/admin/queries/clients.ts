import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const CLIENTS_PAGE_SIZE = 15;

export async function getClientsPageData(pageParam?: string) {
  const page = getPage(pageParam);
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * CLIENTS_PAGE_SIZE,
      take: CLIENTS_PAGE_SIZE,
      include: {
        _count: {
          select: {
            projects: true,
            receivables: true,
            invoices: true,
            credentials: true,
          },
        },
      },
    }),
    prisma.client.count(),
  ]);

  return { page, pageSize: CLIENTS_PAGE_SIZE, clients, total };
}
