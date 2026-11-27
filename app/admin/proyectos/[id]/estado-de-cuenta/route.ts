import { notFound } from "next/navigation";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cleanParam } from "@/lib/admin/finance/period";
import { getAccountStatementData } from "@/lib/admin/receipts/data";
import { renderAccountStatement } from "@/lib/pdf/account-statement";
import { pdfResponse, statementFilename } from "@/lib/pdf/files";

// Account statement of one project: every milestone of the project plus the
// payments received. With no period it covers the whole project (from its
// first payment); ?desde&hasta narrow the payments, &download=1 saves it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, clientId: true },
  });
  // A statement is addressed to a client; a project without one has none.
  if (!project?.clientId) notFound();

  const search = new URL(request.url).searchParams;
  const get = (key: string) => cleanParam(search.get(key) ?? undefined);
  const desde = get("desde");
  const hasta = get("hasta");

  const data = await getAccountStatementData({
    clientId: project.clientId,
    projectId: project.id,
    desde,
    hasta,
    all: search.get("todo") === "1" || (!desde && !hasta),
  });
  const pdf = await renderAccountStatement(data);

  return pdfResponse(pdf, statementFilename(data), search.get("download") === "1");
}
