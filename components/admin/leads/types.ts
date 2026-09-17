import { minutesSince, shortAge } from "@/lib/admin/format";
import { STALE_MINUTES } from "@/components/admin/leads/constants";

/** Lead shape passed from server components to the board/table (Decimal already serialized). */
export type LeadCardData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string;
  serviceTag: string | null;
  estimatedValue: string | null;
  currency: string;
  metaCampaignName: string | null;
  metaFormName: string | null;
  firstContactedAt: string | null;
  nextFollowUpAt: string | null;
  convertedClientId: string | null;
  createdAt: string;
  // Derived on the server: computing "hace 6 min" inside a client component
  // makes it disagree with the server render and React flags a hydration
  // mismatch, and on a UTC host the comparison would use the wrong clock.
  ageLabel: string;
  stale: boolean;
  followUpDue: boolean;
};

export function forLeadCard(lead: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string;
  serviceTag: string | null;
  estimatedValue: { toString(): string } | null;
  currency: string;
  metaCampaignName: string | null;
  metaFormName: string | null;
  firstContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  convertedClientId: string | null;
  createdAt: Date;
}): LeadCardData {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    stage: lead.stage,
    source: lead.source,
    serviceTag: lead.serviceTag,
    estimatedValue: lead.estimatedValue?.toString() ?? null,
    currency: lead.currency,
    metaCampaignName: lead.metaCampaignName,
    metaFormName: lead.metaFormName,
    firstContactedAt: lead.firstContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    convertedClientId: lead.convertedClientId,
    createdAt: lead.createdAt.toISOString(),
    ageLabel: shortAge(lead.createdAt),
    stale:
      lead.stage === "NEW" && minutesSince(lead.createdAt) >= STALE_MINUTES,
    followUpDue: lead.nextFollowUpAt
      ? lead.nextFollowUpAt.getTime() <= Date.now()
      : false,
  };
}
