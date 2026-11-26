import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer $CRON_SECRET`, compared in constant time. */
export function cronAuthorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return expected.length === received.length && timingSafeEqual(expected, received);
}
