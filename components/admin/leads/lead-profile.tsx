import Link from "next/link";
import {
  Briefcase,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Globe,
  Layers,
  Mail,
  MapPin,
  Megaphone,
  MousePointerClick,
  Phone,
  Search,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { SOURCE_LABELS } from "@/components/admin/leads/constants";
import { LeadContactTiles } from "@/components/admin/leads/lead-contact-tiles";
import { LeadStageSelect } from "@/components/admin/leads/lead-stage-select";
import { TemperaturePill } from "@/components/admin/leads/temperature-pill";
import type { WebOrigin } from "@/lib/leads/ficha";
import { cn } from "@/lib/utils";

const AVATAR: Record<string, string> = {
  HOT: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  WARM: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  COLD: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t px-5 py-4">
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

export type LeadProfileData = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  stage: string;
  source: string;
  temperature: string | null;
  serviceLabel: string | null;
  location: string | null;
  estimatedValue: string | null;
  /** Sólo si el visitante lo mencionó en el chat. */
  budget: string | null;
  followUp: string | null;
  contacted: boolean;
  receivedLabel: string;
  about: string | null;
  meta: {
    campaign: string | null;
    adset: string | null;
    ad: string | null;
    form: string | null;
  } | null;
  web: WebOrigin | null;
};

/**
 * Columna de perfil de la ficha: quién es, cómo contactarlo y de dónde vino.
 * Todo lo que no cambia mientras trabajas el lead vive acá, y la columna
 * derecha queda para lo que sí: qué quiere, la conversación y la actividad.
 */
export function LeadProfile({ lead }: { lead: LeadProfileData }) {
  const fuente = lead.web
    ? [lead.web.utmSource, lead.web.utmMedium].filter(Boolean).join(" / ")
    : "";

  return (
    <aside className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <span
          className={cn(
            "flex size-20 items-center justify-center rounded-full text-2xl font-semibold ring-4 ring-background",
            AVATAR[lead.temperature ?? ""] ??
              "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
          )}
          aria-hidden
        >
          {initials(lead.name)}
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {lead.name}
        </h1>
        {lead.company ? (
          <p className="text-sm text-muted-foreground">{lead.company}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          <TemperaturePill temperature={lead.temperature} />
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {SOURCE_LABELS[lead.source] ?? lead.source}
          </span>
        </div>

        <div className="mt-5 w-full">
          <LeadContactTiles
            id={lead.id}
            name={lead.name}
            phone={lead.phone}
            email={lead.email}
            contacted={lead.contacted}
            about={lead.about}
          />
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              lead.contacted ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          {lead.receivedLabel}
        </p>
      </div>

      <Section title="Etapa">
        <LeadStageSelect id={lead.id} stage={lead.stage} className="mt-1 w-full" />
      </Section>

      <Section title="Contacto">
        <InfoRow
          icon={Phone}
          label="Teléfono"
          value={
            lead.phone ? (
              <a href={`tel:${lead.phone}`} className="tabular-nums hover:underline">
                {lead.phone}
              </a>
            ) : null
          }
        />
        <InfoRow
          icon={Mail}
          label="Correo"
          value={
            lead.email ? (
              <a href={`mailto:${lead.email}`} className="hover:underline">
                {lead.email}
              </a>
            ) : null
          }
        />
        <InfoRow icon={Building2} label="Empresa" value={lead.company} />
        <InfoRow icon={MapPin} label="Ubicación" value={lead.location} />
        {!lead.phone && !lead.email ? (
          <p className="py-2 text-sm text-muted-foreground">Sin datos de contacto.</p>
        ) : null}
      </Section>

      <Section title="Oportunidad">
        <InfoRow icon={Briefcase} label="Servicio" value={lead.serviceLabel} />
        <InfoRow icon={CircleDollarSign} label="Valor estimado" value={lead.estimatedValue} />
        <InfoRow icon={Wallet} label="Presupuesto que mencionó" value={lead.budget} />
        <InfoRow icon={CalendarClock} label="Próximo seguimiento" value={lead.followUp} />
        {!lead.serviceLabel && !lead.estimatedValue && !lead.followUp && !lead.budget ? (
          <p className="py-2 text-sm text-muted-foreground">
            Edita el lead para agregar valor y seguimiento.
          </p>
        ) : null}
      </Section>

      {lead.web || lead.meta ? (
        <Section title="Origen">
          {lead.web ? (
            <>
              <InfoRow icon={Globe} label="Página" value={lead.web.sourcePath} />
              <InfoRow icon={Tag} label="Landing" value={lead.web.landing} />
              <InfoRow icon={Layers} label="Tipo de negocio" value={lead.web.businessType} />
              <InfoRow icon={Megaphone} label="Fuente" value={fuente || null} />
              <InfoRow icon={Megaphone} label="Campaña" value={lead.web.utmCampaign} />
              <InfoRow icon={Search} label="Búsqueda" value={lead.web.utmTerm} />
              <InfoRow
                icon={MousePointerClick}
                label="Google Ads"
                value={lead.web.googleAdsClick ? "Llegó por un clic de anuncio" : null}
              />
            </>
          ) : null}
          {lead.meta ? (
            <>
              <InfoRow
                icon={Megaphone}
                label="Campaña Meta"
                value={
                  lead.meta.campaign ? (
                    <Link href="/admin/campanas" className="hover:underline">
                      {lead.meta.campaign}
                    </Link>
                  ) : null
                }
              />
              <InfoRow icon={Layers} label="Conjunto" value={lead.meta.adset} />
              <InfoRow icon={Tag} label="Anuncio" value={lead.meta.ad} />
              <InfoRow icon={Globe} label="Formulario" value={lead.meta.form} />
            </>
          ) : null}
        </Section>
      ) : null}
    </aside>
  );
}
