import type { Prisma } from "@/app/generated/prisma/client";

import prisma from "@/lib/db/prisma";
import {
  fetchAdContext,
  fetchFormName,
  fetchLead,
  getPageAccessToken,
  isInvalidTokenError,
  MetaGraphError,
} from "@/lib/meta/graph";
import { mapLeadFields } from "@/lib/meta/lead-mapper";

export type LeadgenChange = {
  leadgenId: string;
  pageId: string | null;
  formId: string | null;
  adId: string | null;
  createdTime: number | null;
};

/**
 * Extracts leadgen changes from a Page webhook payload. Meta batches several
 * changes per entry, and non-leadgen fields share the same envelope.
 */
export function extractLeadgenChanges(payload: unknown): LeadgenChange[] {
  const body = payload as {
    object?: string;
    entry?: Array<{
      id?: string | number;
      changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
    }>;
  };

  if (body?.object !== "page" || !Array.isArray(body.entry)) return [];

  const changes: LeadgenChange[] = [];

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;

      const value = change.value ?? {};
      const leadgenId = value.leadgen_id;

      if (leadgenId == null) continue;

      changes.push({
        leadgenId: String(leadgenId),
        pageId: value.page_id != null ? String(value.page_id) : null,
        formId: value.form_id != null ? String(value.form_id) : null,
        adId: value.ad_id != null ? String(value.ad_id) : null,
        createdTime:
          typeof value.created_time === "number" ? value.created_time : null,
      });
    }
  }

  return changes;
}

/**
 * Records the raw event before doing any slow work. This is the durability
 * boundary: once it is stored, a failed Graph call can be retried by the cron
 * without Meta having to redeliver.
 */
export async function recordWebhookEvents(
  changes: LeadgenChange[],
  payload: Prisma.InputJsonValue,
) {
  const stored: LeadgenChange[] = [];

  for (const change of changes) {
    try {
      await prisma.metaWebhookEvent.upsert({
        where: { leadgenId: change.leadgenId },
        create: {
          leadgenId: change.leadgenId,
          pageId: change.pageId,
          formId: change.formId,
          payload,
        },
        // A redelivery of an already-processed event must not reset its status.
        update: {},
      });

      stored.push(change);
    } catch (error) {
      console.error("[meta] no se pudo registrar el evento", change, error);
    }
  }

  return stored;
}

function errorMessage(error: unknown) {
  if (error instanceof MetaGraphError) {
    return `Graph ${error.code ?? ""}: ${error.message}`.trim();
  }

  return error instanceof Error ? error.message : String(error);
}

export type IngestResult =
  | { status: "created"; leadId: string }
  | { status: "duplicate"; leadId: string }
  | { status: "failed"; error: string };

/**
 * Fetches the lead from Graph and stores it. Safe to call more than once for the
 * same leadgenId: Lead.metaLeadId is unique and a second call short-circuits.
 */
export async function ingestLeadgen(
  change: LeadgenChange,
): Promise<IngestResult> {
  const existing = await prisma.lead.findUnique({
    where: { metaLeadId: change.leadgenId },
    select: { id: true },
  });

  if (existing) {
    await prisma.metaWebhookEvent.updateMany({
      where: { leadgenId: change.leadgenId, status: { not: "PROCESSED" } },
      data: { status: "IGNORED", processedAt: new Date() },
    });

    return { status: "duplicate", leadId: existing.id };
  }

  try {
    const pageId = change.pageId ?? process.env.META_PAGE_ID;

    if (!pageId) {
      throw new Error("El evento no trae page_id y META_PAGE_ID no está definido.");
    }

    let pageToken = await getPageAccessToken(pageId);
    let metaLead;

    try {
      metaLead = await fetchLead(change.leadgenId, pageToken);
    } catch (error) {
      // Regenerating the system user token invalidates the cached page token.
      // Without this retry the integration would stay broken until someone
      // cleared the MetaPage row by hand.
      if (!isInvalidTokenError(error)) throw error;

      pageToken = await getPageAccessToken(pageId, true);
      metaLead = await fetchLead(change.leadgenId, pageToken);
    }

    const mapped = mapLeadFields(metaLead);

    const formId = metaLead.form_id ?? change.formId;
    const adId = metaLead.ad_id ?? change.adId;

    const [formName, adContext] = await Promise.all([
      formId ? fetchFormName(formId, pageToken) : Promise.resolve(null),
      adId ? fetchAdContext(adId, pageToken) : Promise.resolve(null),
    ]);

    const lead = await prisma.lead.create({
      data: {
        name: mapped.name,
        email: mapped.email,
        phone: mapped.phone,
        phoneRaw: mapped.phoneRaw,
        company: mapped.company,
        message: mapped.message,
        serviceTag: mapped.serviceTag,
        source: metaLead.is_organic ? "INSTAGRAM" : "META_ADS",
        metaLeadId: metaLead.id,
        metaFormId: formId ?? null,
        metaFormName: formName,
        metaPageId: pageId,
        metaAdId: adContext?.adId ?? adId ?? null,
        metaAdName: adContext?.adName ?? null,
        metaAdsetId: adContext?.adsetId ?? null,
        metaAdsetName: adContext?.adsetName ?? null,
        metaCampaignId: adContext?.campaignId ?? metaLead.campaign_id ?? null,
        metaCampaignName: adContext?.campaignName ?? null,
        metaCreatedAt: metaLead.created_time
          ? new Date(metaLead.created_time)
          : null,
        rawPayload: metaLead as unknown as Prisma.InputJsonValue,
        activities: {
          create: {
            type: "SYSTEM",
            body: `Lead recibido desde ${adContext?.campaignName ?? "Meta Ads"}.`,
          },
        },
      },
      select: { id: true, name: true, phone: true },
    });

    await Promise.all([
      prisma.metaWebhookEvent.updateMany({
        where: { leadgenId: change.leadgenId },
        data: { status: "PROCESSED", processedAt: new Date(), error: null },
      }),
      prisma.metaPage.updateMany({
        where: { pageId },
        data: { lastEventAt: new Date() },
      }),
      flagPossibleDuplicate(lead.id, mapped.phone, mapped.email),
    ]);

    return { status: "created", leadId: lead.id };
  } catch (error) {
    const message = errorMessage(error);

    await prisma.metaWebhookEvent.updateMany({
      where: { leadgenId: change.leadgenId },
      data: {
        status: "FAILED",
        error: message,
        attempts: { increment: 1 },
      },
    });

    console.error("[meta] fallo al ingerir lead", change.leadgenId, message);

    return { status: "failed", error: message };
  }
}

/**
 * Leaves a trail when the same person comes back through a different campaign.
 * Never merges automatically — that decision belongs to a human.
 */
async function flagPossibleDuplicate(
  leadId: string,
  phone: string | null,
  email: string | null,
) {
  if (!phone && !email) return;

  const previous = await prisma.lead.findFirst({
    where: {
      id: { not: leadId },
      stage: { not: "LOST" },
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  if (!previous) return;

  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "SYSTEM",
      body: `Posible duplicado del lead ${previous.name} (${previous.id}).`,
    },
  });
}
