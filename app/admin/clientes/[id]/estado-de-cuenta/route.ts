import { requireAdmin } from "@/lib/auth/require-admin";
import { cleanParam } from "@/lib/admin/finance/period";
import { getAccountStatementData } from "@/lib/admin/receipts/data";
import { renderAccountStatement } from "@/lib/pdf/account-statement";
import { pdfResponse, statementFilename } from "@/lib/pdf/files";

// Account statement of a client: ?desde=yyyy-MM-dd&hasta=yyyy-MM-dd
// (&todo=1 from the first payment) &proyecto=<id> &download=1.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const get = (key: string) => cleanParam(search.get(key) ?? undefined);

  const data = await getAccountStatementData({
    clientId: id,
    projectId: get("proyecto"),
    desde: get("desde"),
    hasta: get("hasta"),
    all: search.get("todo") === "1",
  });
  const pdf = await renderAccountStatement(data);

  return pdfResponse(pdf, statementFilename(data), search.get("download") === "1");
}
