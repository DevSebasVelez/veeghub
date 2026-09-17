import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Megaphone, UserCheck } from "lucide-react";

import { getLeadDetail } from "@/lib/admin/queries/leads";
import { formatCurrency, formatDate } from "@/lib/admin/format";
import { ConvertLeadDialog } from "@/components/admin/dialogs/convert-lead-dialog";
import { LeadActivityForm } from "@/components/admin/leads/lead-activity-form";
import { LeadActivityTimeline } from "@/components/admin/leads/lead-activity-timeline";
import { LeadEditDialog } from "@/components/admin/dialogs/lead-dialog";
import { LeadQuickActions } from "@/components/admin/leads/lead-quick-actions";
import { LeadStageSelect } from "@/components/admin/leads/lead-stage-select";
import { SOURCE_LABELS } from "@/components/admin/leads/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm">{value || "—"}</span>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadDetail(id);

  if (!lead) notFound();

  const responseMinutes = lead.firstContactedAt
    ? Math.round(
        (lead.firstContactedAt.getTime() - lead.createdAt.getTime()) / 60000,
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/leads"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Leads
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.company ? `${lead.company} · ` : ""}
            Recibido {formatDate(lead.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LeadQuickActions
            id={lead.id}
            name={lead.name}
            phone={lead.phone}
            email={lead.email}
            contacted={Boolean(lead.firstContactedAt)}
          />
          <LeadEditDialog
            lead={{
              id: lead.id,
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              company: lead.company,
              message: lead.message,
              stage: lead.stage,
              source: lead.source,
              serviceTag: lead.serviceTag,
              estimatedValue: lead.estimatedValue?.toString() ?? null,
              notes: lead.notes,
              lostReason: lead.lostReason,
            }}
          />
          {!lead.convertedClientId ? (
            <ConvertLeadDialog
              lead={{
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                company: lead.company,
                serviceTag: lead.serviceTag,
                estimatedValue: lead.estimatedValue?.toString() ?? null,
              }}
            />
          ) : null}
        </div>
      </div>

      {lead.convertedClient ? (
        <Card className="rounded-lg border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Convertido en cliente</span>
            <Link
              href={`/admin/clientes/${lead.convertedClient.id}`}
              className="font-medium underline underline-offset-4"
            >
              {lead.convertedClient.name}
            </Link>
            {lead.convertedProject ? (
              <>
                <Briefcase className="ml-2 size-4 text-muted-foreground" />
                <Link
                  href={`/admin/proyectos/${lead.convertedProject.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {lead.convertedProject.name}
                </Link>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Datos</CardTitle>
            </CardHeader>
            <CardContent className="divide-y pt-0">
              <div className="pb-2">
                <LeadStageSelect id={lead.id} stage={lead.stage} />
              </div>
              <Row label="Teléfono" value={lead.phone} />
              <Row label="Email" value={lead.email} />
              <Row label="Empresa" value={lead.company} />
              <Row label="Servicio" value={lead.serviceTag} />
              <Row
                label="Valor estimado"
                value={
                  lead.estimatedValue
                    ? formatCurrency(lead.estimatedValue.toString())
                    : null
                }
              />
              <Row
                label="Origen"
                value={SOURCE_LABELS[lead.source] ?? lead.source}
              />
              <Row
                label="Seguimiento"
                value={
                  lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : null
                }
              />
              <Row
                label="Tiempo de respuesta"
                value={
                  responseMinutes != null
                    ? responseMinutes < 60
                      ? `${responseMinutes} min`
                      : `${Math.round(responseMinutes / 60)} h`
                    : "Sin contactar"
                }
              />
              {lead.lostReason ? (
                <Row label="Motivo de pérdida" value={lead.lostReason} />
              ) : null}
            </CardContent>
          </Card>

          {lead.metaCampaignName || lead.metaFormName ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Megaphone className="size-3.5" />
                  Atribución Meta
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y pt-0">
                <Row label="Campaña" value={lead.metaCampaignName} />
                <Row label="Conjunto" value={lead.metaAdsetName} />
                <Row label="Anuncio" value={lead.metaAdName} />
                <Row label="Formulario" value={lead.metaFormName} />
                <Row
                  label="Enviado"
                  value={
                    lead.metaCreatedAt ? formatDate(lead.metaCreatedAt) : null
                  }
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {lead.message ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Qué respondió</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{lead.message}</p>
              </CardContent>
            </Card>
          ) : null}

          {lead.notes ? (
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notas internas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Actividad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LeadActivityForm leadId={lead.id} />
              <LeadActivityTimeline activities={lead.activities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
