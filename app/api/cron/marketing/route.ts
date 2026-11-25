import { timingSafeEqual } from "node:crypto";

import { runMarketingCron } from "@/lib/marketing/reminders";

// Lee y escribe la base en cada pasada: nada que cachear.
export const dynamic = "force-dynamic";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Recordatorios del calendario de marketing. Vercel Cron lo llama cada 15
 * minutos (`vercel.json`) con `Authorization: Bearer $CRON_SECRET`; cualquier
 * otro programador externo sirve igual con la misma cabecera.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runMarketingCron();
  console.log("[marketing] cron", result);

  return Response.json(result);
}
