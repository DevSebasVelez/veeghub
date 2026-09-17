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
  };
}
