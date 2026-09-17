import { createHmac, timingSafeEqual } from "crypto";

import { appSecret, webhookVerifyToken } from "@/lib/meta/config";

const SIGNATURE_PREFIX = "sha256=";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  // timingSafeEqual throws on length mismatch, so compare lengths first. The
  // length itself is not secret.
  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates the X-Hub-Signature-256 header against the RAW request body.
 * The body must be the exact bytes Meta sent — re-serializing parsed JSON
 * produces a different digest and every request would be rejected.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null) {
  if (!header || !header.startsWith(SIGNATURE_PREFIX)) return false;

  const expected =
    SIGNATURE_PREFIX +
    createHmac("sha256", appSecret()).update(rawBody, "utf8").digest("hex");

  return safeEqual(header, expected);
}

export function verifyWebhookToken(token: string | null) {
  if (!token) return false;

  return safeEqual(token, webhookVerifyToken());
}
