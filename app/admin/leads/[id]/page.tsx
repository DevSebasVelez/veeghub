import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  CalendarRange,
  ChevronRight,
  Clock,
  Flag,
  Gauge,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
  UserCheck,
} from "lucide-react";

import { getLeadDetail } from "@/lib/admin/queries/leads";
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  minutesSince,
  shortAge,
} from "@/lib/admin/format";
import { readConversation, readInsights, readWebOrigin } from "@/lib/leads/ficha";
import { ConvertLeadDialog } from "@/components/admin/dialogs/convert-lead-dialog";
import { LeadEditDialog } from "@/components/admin/dialogs/lead-dialog";
import type { Tone } from "@/components/admin/finance/kpi-card";
import { STAGE_LABELS } from "@/components/admin/leads/constants";
import { DeleteLeadButton } from "@/components/admin/leads/delete-lead-button";
import { LeadActivityForm } from "@/components/admin/leads/lead-activity-form";
import { LeadActivityTimeline } from "@/components/admin/leads/lead-activity-timeline";
import { LeadAiSummary } from "@/components/admin/leads/lead-ai-summary";
import { LeadConversation } from "@/components/admin/leads/lead-conversation";
import { LeadMessage } from "@/components/admin/leads/lead-message";
import { LeadProfile } from "@/components/admin/leads/lead-profile";
import { LeadStatsStrip, type LeadStat } from "@/components/admin/leads/lead-stats-strip";
import { LeadTabs, type LeadTab } from "@/components/admin/leads/lead-tabs";

const URGENCIA: Record<string, { label: string; tone: Tone }> = {
  alta: { label: "Alta", tone: "rose" },
  media: { label: "Media", tone: "amber" },
  baja: { label: "Baja", tone: "slate" },
};

const CONTACTO: Record<string, { label: string; icon: typeof Phone }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  llamada: { label: "Llamada", icon: Phone },
  email: { label: "Correo", icon: Mail },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

function EmptyTab({ icon: Icon, text }: { icon: typeof StickyNote; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
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

  const insights = readInsights(lead.aiInsights);
  const conversation = readConversation(lead.conversation);
  const web =
    lead.source === "WEBSITE" || lead.source === "WEB_CHAT"
      ? readWebOrigin(lead.rawPayload)
      : null;

  const contacted = Boolean(lead.firstContactedAt);
  const responseMinutes = lead.firstContactedAt
    ? Math.max(
        0,
        Math.round((lead.firstContactedAt.getTime() - lead.createdAt.getTime()) / 60000),
      )
    : null;
  const waiting = contacted ? 0 : minutesSince(lead.createdAt);

  // Tiempo de respuesta: la cifra que más pesa en cerrar un lead.
  const response: LeadStat = contacted
    ? {
        icon: Clock,
        tone: (responseMinutes ?? 0) <= 60 ? "emerald" : "amber",
        label: "Tiempo de respuesta",
        value: duration(responseMinutes ?? 0),
        hint: (responseMinutes ?? 0) <= 60 ? "Dentro de la primera hora" : "Contactado",
      }
    : {
        icon: Clock,
        tone: waiting > 60 ? "rose" : "amber",
        label: "Tiempo de respuesta",
        value: "Sin contactar",
        hint: `Esperando hace ${duration(waiting)}`,
        info: "Responder dentro de la primera hora multiplica la probabilidad de cerrar.",
      };

  const urgencia = insights?.urgencia ? URGENCIA[insights.urgencia] : null;
  const contacto = insights?.preferenciaContacto
    ? CONTACTO[insights.preferenciaContacto]
    : null;

  const stats: LeadStat[] = insights
    ? [
        response,
        {
          icon: Gauge,
          tone: urgencia?.tone ?? "slate",
          label: "Urgencia",
          value: urgencia?.label ?? "Sin dato",
        },
        {
          icon: CalendarRange,
          tone: "blue",
          label: "Plazo",
          value: insights.plazo ?? "Sin definir",
        },
        {
          icon: contacto?.icon ?? MessageCircle,
          tone: "emerald",
          label: "Prefiere",
          value: contacto?.label ?? "Sin preferencia",
        },
      ]
    : [
        response,
        {
          icon: Flag,
          tone: "violet",
          label: "Etapa",
          value: STAGE_LABELS[lead.stage] ?? lead.stage,
        },
        {
          icon: Briefcase,
          tone: "blue",
          label: "Servicio",
          value: lead.serviceTag ?? "Sin definir",
        },
        {
          icon: CalendarClock,
          tone: "slate",
          label: "Recibido",
          value: shortAge(lead.createdAt),
          hint: formatDate(lead.createdAt),
        },
      ];

  const tabs: LeadTab[] = [];

  if (conversation.length > 0) {
    tabs.push({
      key: "conversacion",
      label: "Conversación",
      count: conversation.length,
      content: (
        <LeadConversation turns={conversation} initials={initials(lead.name)} />
      ),
    });
  }

  tabs.push({
    key: "actividad",
    label: "Actividad",
    count: lead.activities.length,
    content: (
      <div className="space-y-6">
        <LeadActivityForm leadId={lead.id} />
        <LeadActivityTimeline activities={lead.activities} />
      </div>
    ),
  });

  tabs.push({
    key: "notas",
    label: "Notas",
    content: lead.notes ? (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{lead.notes}</p>
    ) : (
      <EmptyTab icon={StickyNote} text="Sin notas internas. Agrégalas desde «Editar»." />
    ),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Ruta"
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/admin/leads" className="hover:text-foreground">
            Leads
          </Link>
          <ChevronRight className="size-4 shrink-0" />
          <span className="truncate font-medium text-foreground">{lead.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
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
          <DeleteLeadButton
            id={lead.id}
            name={lead.name}
            variant="button"
            redirectTo="/admin/leads"
          />
        </div>
      </div>

      {lead.convertedClient ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
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
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4">
          <LeadProfile
            lead={{
              id: lead.id,
              name: lead.name,
              company: lead.company,
              phone: lead.phone,
              email: lead.email,
              stage: lead.stage,
              source: lead.source,
              temperature: lead.temperature,
              serviceLabel: insights?.servicio ?? lead.serviceTag,
              location: insights?.ubicacion ?? null,
              estimatedValue: lead.estimatedValue
                ? formatCurrency(lead.estimatedValue.toString())
                : null,
              budget: insights?.presupuestoMencionado ?? null,
              followUp: lead.nextFollowUpAt ? formatDateOnly(lead.nextFollowUpAt) : null,
              contacted,
              receivedLabel: `Recibido ${shortAge(lead.createdAt)} · ${formatDate(lead.createdAt)}`,
              about: insights?.necesidad ?? null,
              meta:
                lead.metaCampaignName || lead.metaFormName
                  ? {
                      campaign: lead.metaCampaignName,
                      adset: lead.metaAdsetName,
                      ad: lead.metaAdName,
                      form: lead.metaFormName,
                    }
                  : null,
              web,
            }}
          />
        </div>

        <div className="min-w-0 space-y-5">
          {lead.aiSummary ? (
            <LeadAiSummary
              name={lead.name}
              phone={lead.phone}
              summary={lead.aiSummary}
              need={insights?.necesidad ?? null}
              nextStep={insights?.siguientePaso ?? null}
            />
          ) : lead.message ? (
            <LeadMessage
              message={lead.message}
              title={lead.source === "META_ADS" ? "Qué respondió en el formulario" : "Qué escribió"}
              phone={lead.phone}
              name={lead.name}
            />
          ) : null}

          <LeadStatsStrip stats={stats} />

          <LeadTabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}
