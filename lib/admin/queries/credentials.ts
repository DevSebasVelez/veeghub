import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const CREDENTIALS_PAGE_SIZE = 10;

export async function getCredentialsPageData(pageParam?: string) {
  const page = getPage(pageParam);
  const [clients, projects, credentials, total] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.credential.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * CREDENTIALS_PAGE_SIZE,
      take: CREDENTIALS_PAGE_SIZE,
      include: {
        client: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.credential.count(),
  ]);

  return {
    page,
    pageSize: CREDENTIALS_PAGE_SIZE,
    clients,
    projects,
    credentials,
    total,
  };
}
