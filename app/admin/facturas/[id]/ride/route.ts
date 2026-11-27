import { notFound } from "next/navigation";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { renderRide } from "@/lib/pdf/ride";
import { pdfResponse } from "@/lib/pdf/files";

// RIDE of an invoice issued from VeegHub, built from its own XML. Once the SRI
// authorizes it the PDF carries the authorization; before that it is a
// preview marked as having no tax value. ?download=1 saves it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { source: true, sriXml: true, sriStatus: true, authorizedAt: true, invoiceNumber: true },
  });
  if (!invoice || invoice.source !== "ISSUED" || !invoice.sriXml) notFound();

  const authorized = invoice.sriStatus === "AUTHORIZED" && invoice.authorizedAt;
  const pdf = await renderRide(
    invoice.sriXml,
    authorized ? { kind: "authorized", authorizedAt: invoice.authorizedAt! } : { kind: "preview" },
  );
  const name = `${authorized ? "RIDE" : "Vista-previa"}-${invoice.invoiceNumber ?? id}.pdf`;
  return pdfResponse(pdf, name, new URL(request.url).searchParams.get("download") === "1");
}
