import { CHANNELS, type ContentChannelValue } from "./constants";

/** utm_campaign of posts that belong to no campaign. */
export const DEFAULT_UTM_CAMPAIGN = "general";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/**
 * The destination URL with the UTM of the post (decision 10): source and
 * medium by channel, the campaign slug and the post id as utm_content, which
 * is what lets F7 tie a visit or a lead back to the exact piece.
 *
 * Any utm_* already in the URL is replaced, so pasting a link copied from an
 * older post never ends up with two campaigns. Returns null for an empty or
 * malformed URL instead of throwing: the editor previews it while typing.
 */
export function buildUtmUrl({
  linkUrl,
  channel,
  campaignSlug,
  postId,
}: {
  linkUrl: string | null | undefined;
  channel: ContentChannelValue;
  campaignSlug?: string | null;
  postId?: string | null;
}) {
  const raw = linkUrl?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  for (const key of UTM_KEYS) url.searchParams.delete(key);

  const info = CHANNELS[channel];
  url.searchParams.set("utm_source", info.utmSource);
  url.searchParams.set("utm_medium", info.utmMedium);
  url.searchParams.set("utm_campaign", campaignSlug || DEFAULT_UTM_CAMPAIGN);
  if (postId) url.searchParams.set("utm_content", postId);

  return url.toString();
}

/** Strips utm_* so the stored linkUrl stays clean (the UTM is built later). */
export function stripUtm(linkUrl: string) {
  try {
    const url = new URL(linkUrl.trim());
    for (const key of UTM_KEYS) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return linkUrl.trim();
  }
}

/**
 * The first comment as it is pasted on LinkedIn: its text, then the link with
 * UTM on its own line. The link is not stored inside the comment so that the
 * UTM always carries the real post id.
 */
export function renderFirstComment(
  firstComment: string | null | undefined,
  utmUrl: string | null,
) {
  const text = firstComment?.trim() ?? "";
  if (!utmUrl) return text || null;
  return text ? `${text}\n${utmUrl}` : utmUrl;
}
