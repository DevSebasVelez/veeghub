import type { Prisma } from "@/app/generated/prisma/client";
import type { ProjectStatus } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const PROJECTS_PAGE_SIZE = 15;

export async function getProjectsPageData({
  pageParam,
  q,
  status,
  clientId,
}: {
  pageParam?: string;
  q: string;
  status: string;
  clientId: string;
}) {
  const page = getPage(pageParam);
  const where: Prisma.ProjectWhereInput = {
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status: status as ProjectStatus } : {}),
    ...(clientId ? { clientId } : {}),
  };

  const [clients, allProjects, projects, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PROJECTS_PAGE_SIZE,
      take: PROJECTS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        description: true,
        stack: true,
        repositoryUrl: true,
        productionUrl: true,
        stagingUrl: true,
        budget: true,
        startDate: true,
        dueDate: true,
        client: { select: { name: true } },
        tasks: { select: { id: true, status: true } },
        receivables: {
          select: { amount: true, paidAmount: true, status: true },
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
        },
        _count: { select: { tasks: true, files: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    page,
    pageSize: PROJECTS_PAGE_SIZE,
    clients,
    allProjects,
    projects,
    total,
  };
}
