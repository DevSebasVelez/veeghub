import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const TASKS_PAGE_SIZE = 30;

export async function getTasksPageData({
  pageParam,
  projectFilter,
  showDone,
}: {
  pageParam?: string;
  projectFilter: string;
  showDone: boolean;
}) {
  const page = getPage(pageParam);
  const where = {
    ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
    ...(showDone ? {} : { status: { not: "DONE" as const } }),
  };

  const [projects, tasks, total, pendingTotal, doneTotal] = await Promise.all([
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where,
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * TASKS_PAGE_SIZE,
      take: TASKS_PAGE_SIZE,
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where }),
    prisma.task.count({
      where: {
        ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
        status: { not: "DONE" },
      },
    }),
    showDone
      ? prisma.task.count({
          where: {
            ...(projectFilter !== "all" ? { projectId: projectFilter } : {}),
            status: "DONE",
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    page,
    pageSize: TASKS_PAGE_SIZE,
    projects,
    tasks,
    total,
    pendingTotal,
    doneTotal,
  };
}
