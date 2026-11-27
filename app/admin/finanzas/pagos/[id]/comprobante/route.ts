import { requireAdmin } from "@/lib/auth/require-admin";
import { getPaymentReceiptData } from "@/lib/admin/receipts/data";
import { pdfResponse, receiptFilename } from "@/lib/pdf/files";
import { renderPaymentReceipt } from "@/lib/pdf/payment-receipt";

// The receipt of one payment. Issuing it the first time assigns its folio.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const data = await getPaymentReceiptData(id);
  const pdf = await renderPaymentReceipt(data);

  return pdfResponse(pdf, receiptFilename(data), download);
}
