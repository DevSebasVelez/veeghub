import prisma from "@/lib/db/prisma";
import { getPage } from "@/components/admin/pagination";

const INVOICES_PAGE_SIZE = 12;

type InvoiceStatusFilter = "READY_TO_SEND" | "SENT" | "PAID" | "CANCELLED";

export async function getInvoicesPageData({
  pageParam,
  statusFilter,
}: {
  pageParam?: string;
  statusFilter?: string;
}) {
  const page = getPage(pageParam);
  const whereStatus =
    statusFilter && statusFilter !== ""
      ? { status: statusFilter as InvoiceStatusFilter }
      : {};

  const [clientsWithContext, invoices, total] = await Promise.all([
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
    prisma.invoice.findMany({
      where: whereStatus,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * INVOICES_PAGE_SIZE,
      take: INVOICES_PAGE_SIZE,
      include: {
        client: true,
        project: true,
        xmlFile: true,
        rideFile: true,
        receivables: { select: { id: true } },
        emailLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.invoice.count({ where: whereStatus }),
  ]);

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const clientsForEdit = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      projects: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      receivables: {
        where: {
          OR: [{ invoiceId: null }, { invoiceId: { in: invoiceIds } }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          projectId: true,
          amount: true,
          invoiceId: true,
        },
      },
    },
  });

  const serializeRecv = (r: {
    id: string;
    title: string;
    projectId: string | null;
    amount: { toString(): string };
  }) => ({
    id: r.id,
    title: r.title,
    projectId: r.projectId,
    amount: r.amount.toString(),
  });

  return {
    page,
    pageSize: INVOICES_PAGE_SIZE,
    whereStatus,
    clientsForCreate: clientsWithContext.map((c) => ({
      ...c,
      receivables: c.receivables.map(serializeRecv),
    })),
    clientsForEdit,
    invoices,
    total,
    serializeRecv,
  };
}

/**
 * Figures for the invoices KPI strip. "This year" is counted by issue date
 * (a calendar day) in the business timezone; cancelled invoices never count.
 */
export async function getInvoiceStats(year: number) {
  const issuedThisYear = {
    issueDate: {
      gte: new Date(`${year}-01-01T00:00:00.000Z`),
      lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    },
  };

  const [billed, byStatus, missingDocs] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...issuedThisYear, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.count({
      where: {
        status: { not: "CANCELLED" },
        OR: [{ xmlFileId: null }, { rideFileId: null }],
      },
    }),
  ]);

  const status = (s: string) => byStatus.find((row) => row.status === s);

  return {
    billedTotal: billed._sum.total?.toString() ?? "0",
    billedCount: billed._count,
    toSendCount: status("READY_TO_SEND")?._count ?? 0,
    toSendTotal: status("READY_TO_SEND")?._sum.total?.toString() ?? "0",
    toCollectCount: status("SENT")?._count ?? 0,
    toCollectTotal: status("SENT")?._sum.total?.toString() ?? "0",
    paidCount: status("PAID")?._count ?? 0,
    paidTotal: status("PAID")?._sum.total?.toString() ?? "0",
    missingDocs,
  };
}
