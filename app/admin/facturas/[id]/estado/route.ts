import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// Where an issued invoice stands, for the live progress of «Emitir». A route
// handler and not a server action: the client runs server actions one at a
// time, and this is polled while the sending action is still running.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { sriStatus: true, sriLastError: true, invoiceNumber: true, xmlFileId: true, rideFileId: true },
  });
  if (!invoice) return Response.json({ error: "No existe." }, { status: 404 });

  return Response.json(
    {
      status: invoice.sriStatus,
      problem: invoice.sriLastError,
      number: invoice.invoiceNumber,
      documentsReady: Boolean(invoice.xmlFileId && invoice.rideFileId),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
