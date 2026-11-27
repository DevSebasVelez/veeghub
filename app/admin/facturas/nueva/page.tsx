import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IssueInvoiceForm } from "@/components/admin/finance/issue-invoice-form";
import { getIssueInvoiceData } from "@/lib/admin/queries/issue-invoice";
import { dayStartUtc, formatDateOnly } from "@/lib/admin/format";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ hito?: string; proyecto?: string; cliente?: string }>;
}) {
  const params = await searchParams;
  const data = await getIssueInvoiceData(params);

  return (
    <div className="space-y-6">
      <div className="min-w-0 space-y-2">
        <Link
          href="/admin/facturas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Facturas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva factura</h1>
        <p className="text-sm text-muted-foreground">
          Emitida desde VeegHub con tu firma electrónica. Revisas el RIDE antes de enviarla al SRI.
        </p>
      </div>

      {/* Keyed by the query: «Facturar» from another milestone starts fresh. */}
      <IssueInvoiceForm
        key={JSON.stringify(params)}
        data={data}
        issueDayLabel={formatDateOnly(dayStartUtc(new Date()))}
      />
    </div>
  );
}
