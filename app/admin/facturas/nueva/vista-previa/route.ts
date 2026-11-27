import { requireAdmin } from "@/lib/auth/require-admin";
import { actionErrorMessage } from "@/lib/admin/actions/shared";
import { pdfResponse } from "@/lib/pdf/files";
import { renderRide } from "@/lib/pdf/ride";
import { previewIssuedInvoice } from "@/lib/sri/issue";
import { resolveIssueRequest } from "@/lib/sri/issue-request";

// RIDE preview of the invoice being filled in, before «Emitir». Builds the
// XML with the same code that will sign it, numbered with the next
// secuencial (not taken), and renders it marked as having no tax value.
export async function POST(request: Request) {
  await requireAdmin();

  try {
    const { input } = await resolveIssueRequest(await request.json());
    const built = await previewIssuedInvoice(input);
    const pdf = await renderRide(built.xml, { kind: "preview" });
    return pdfResponse(pdf, `Vista-previa-${built.number}.pdf`, false);
  } catch (error) {
    return Response.json({ error: actionErrorMessage(error) }, { status: 422 });
  }
}
