import prisma from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/security/credentials";
import { graphUrl, systemUserToken } from "@/lib/meta/config";

export type GraphError = {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export class MetaGraphError extends Error {
  code?: number;
  subcode?: number;
  traceId?: string;

  constructor(error: GraphError) {
    super(error.message);
    this.name = "MetaGraphError";
    this.code = error.code;
    this.subcode = error.error_subcode;
    this.traceId = error.fbtrace_id;
  }
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(graphUrl(path));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // Graph responses must never be cached: tokens rotate and leads are one-shot.
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();

  if (payload?.error) {
    throw new MetaGraphError(payload.error as GraphError);
  }

  if (!response.ok) {
    throw new Error(`Graph API respondió ${response.status}`);
  }

  return payload as T;
}

async function graphPost<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(graphUrl(path));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { method: "POST", cache: "no-store" });
  const payload = await response.json();

  if (payload?.error) {
    throw new MetaGraphError(payload.error as GraphError);
  }

  return payload as T;
}

/** Graph error code for an invalid or revoked access token. */
export const INVALID_TOKEN_CODE = 190;

export function isInvalidTokenError(error: unknown) {
  return error instanceof MetaGraphError && error.code === INVALID_TOKEN_CODE;
}

/**
 * Page access tokens derived from a system user do not expire on their own, so
 * they are cached (encrypted) in MetaPage. They DO become invalid when the
 * system user token is regenerated, which is a routine operation — pass
 * forceRefresh to discard the cached copy and fetch a new one.
 */
export async function getPageAccessToken(pageId: string, forceRefresh = false) {
  const stored = forceRefresh
    ? null
    : await prisma.metaPage.findUnique({ where: { pageId } });

  if (stored?.encryptedToken && stored.tokenIv && stored.tokenTag) {
    return decryptSecret({
      encryptedSecret: stored.encryptedToken,
      secretIv: stored.tokenIv,
      secretTag: stored.tokenTag,
    });
  }

  const { access_token, name } = await graphGet<{
    access_token: string;
    name?: string;
  }>(pageId, {
    fields: "access_token,name",
    access_token: systemUserToken(),
  });

  const encrypted = encryptSecret(access_token);

  await prisma.metaPage.upsert({
    where: { pageId },
    create: {
      pageId,
      pageName: name ?? null,
      encryptedToken: encrypted.encryptedSecret,
      tokenIv: encrypted.secretIv,
      tokenTag: encrypted.secretTag,
      tokenPreview: encrypted.secretPreview,
    },
    update: {
      pageName: name ?? undefined,
      encryptedToken: encrypted.encryptedSecret,
      tokenIv: encrypted.secretIv,
      tokenTag: encrypted.secretTag,
      tokenPreview: encrypted.secretPreview,
    },
  });

  return access_token;
}

export type MetaFieldEntry = { name: string; values: string[] };

export type MetaLead = {
  id: string;
  created_time: string;
  field_data: MetaFieldEntry[];
  ad_id?: string;
  form_id?: string;
  campaign_id?: string;
  platform?: string;
  is_organic?: boolean;
};

export async function fetchLead(leadgenId: string, pageToken: string) {
  return graphGet<MetaLead>(leadgenId, {
    fields:
      "id,created_time,field_data,ad_id,form_id,campaign_id,platform,is_organic",
    access_token: pageToken,
  });
}

export type AdContext = {
  adId: string | null;
  adName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
};

/**
 * Campaign/adset names are presentation sugar and need ads_read. A failure here
 * must never cost us the lead, so the caller gets nulls instead of a throw.
 */
export async function fetchAdContext(
  adId: string,
  pageToken: string,
): Promise<AdContext> {
  const empty: AdContext = {
    adId,
    adName: null,
    adsetId: null,
    adsetName: null,
    campaignId: null,
    campaignName: null,
  };

  try {
    const ad = await graphGet<{
      id: string;
      name?: string;
      adset?: { id: string; name: string };
      campaign?: { id: string; name: string };
    }>(adId, {
      fields: "name,adset{id,name},campaign{id,name}",
      access_token: pageToken,
    });

    return {
      adId,
      adName: ad.name ?? null,
      adsetId: ad.adset?.id ?? null,
      adsetName: ad.adset?.name ?? null,
      campaignId: ad.campaign?.id ?? null,
      campaignName: ad.campaign?.name ?? null,
    };
  } catch {
    return empty;
  }
}

export async function fetchFormName(formId: string, pageToken: string) {
  try {
    const form = await graphGet<{ id: string; name?: string }>(formId, {
      fields: "name",
      access_token: pageToken,
    });

    return form.name ?? null;
  } catch {
    return null;
  }
}

export async function listSubscribedApps(pageId: string, pageToken: string) {
  return graphGet<{
    data: Array<{ id: string; name: string; subscribed_fields: string[] }>;
  }>(`${pageId}/subscribed_apps`, { access_token: pageToken });
}

export async function subscribePageToLeadgen(pageId: string, pageToken: string) {
  return graphPost<{ success: boolean }>(`${pageId}/subscribed_apps`, {
    subscribed_fields: "leadgen",
    access_token: pageToken,
  });
}

export async function debugSystemUserToken(appId: string, appSecret: string) {
  return graphGet<{
    data: {
      type?: string;
      app_id?: string;
      user_id?: string;
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
    };
  }>("debug_token", {
    input_token: systemUserToken(),
    access_token: `${appId}|${appSecret}`,
  });
}
