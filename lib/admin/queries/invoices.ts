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
