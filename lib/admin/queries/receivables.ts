import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const RECEIVABLES_PAGE_SIZE = 15;

type ReceivableSectionItem = Prisma.ReceivableGetPayload<{
  include: {
    client: { select: { id: true; name: true } };
    project: { select: { id: true; name: true } };
    invoice: { select: { id: true; invoiceNumber: true; status: true } };
  };
}>;

export async function getReceivablesSectionData({
  pageParam,
  showAll,
}: {
  pageParam?: string;
  showAll: boolean;
}) {
  const page = getPage(pageParam);
  const where: Prisma.ReceivableWhereInput = showAll
    ? {}
    : { status: { notIn: ["PAID", "CANCELLED"] } };

  const [receivables, total, clients, projects, clientsWithContext] =
    await Promise.all([
      prisma.receivable.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * RECEIVABLES_PAGE_SIZE,
        take: RECEIVABLES_PAGE_SIZE,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
        },
      }),
      prisma.receivable.count({ where }),
      prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.project.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.client.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          projects: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
          receivables: {
            where: { invoiceId: null, status: { notIn: ["CANCELLED"] } },
            orderBy: { createdAt: "desc" },
            select: { id: true, title: true, projectId: true, amount: true },
          },
        },
      }),
    ]);

  const invoiceCtx = clientsWithContext.map((c) => ({
    ...c,
    receivables: c.receivables.map((r) => ({
      id: r.id,
      title: r.title,
      projectId: r.projectId,
      amount: r.amount.toString(),
    })),
  }));

  return {
    page,
    pageSize: RECEIVABLES_PAGE_SIZE,
    total,
    receivables: receivables as ReceivableSectionItem[],
    clients,
    projects,
    invoiceCtx,
  };
}
