import type { AccountStatementData, PaymentReceiptData } from "@/lib/admin/receipts/data";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function receiptFilename(data: PaymentReceiptData) {
  return `Comprobante-${data.folio}.pdf`;
}

export function statementFilename(data: AccountStatementData) {
  const day = data.cutoff.toISOString().slice(0, 10);
  const owner = data.project ? `${slug(data.client.name)}-${slug(data.project)}` : slug(data.client.name);
  return `Estado-de-cuenta-${owner}-${day}.pdf`;
}

/** Inline by default so the browser previews it; `download` forces a save. */
export function pdfResponse(body: Buffer, filename: string, download: boolean) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
