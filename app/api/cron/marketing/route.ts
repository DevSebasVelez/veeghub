import { runMarketingCron } from "@/lib/marketing/reminders";
import { runMetaSync } from "@/lib/meta/sync";
import { cronAuthorized } from "@/lib/security/cron-auth";

// Lee y escribe la base en cada pasada: nada que cachear.
export const dynamic = "force-dynamic";
// La sincronización completa de Meta (una vez al día) hace ~20 llamadas.
export const maxDuration = 60;

/**
 * Recordatorios del calendario de marketing y sincronización de Meta Ads.
 * Debe llamarse cada 15 minutos con `Authorization: Bearer $CRON_SECRET`.
 * Vercel Hobby sólo permite crons diarios, así que lo dispara un Worker de
 * Cloudflare con Cron Trigger (plan de marketing, decisión 12). Es idempotente:
 * los avisos no se repiten y Meta se sincroniza como mucho cada 50 min (la
 * completa, una vez al día).
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runMarketingCron();
  console.log("[marketing] cron", result);

  // Meta nunca debe tumbar los recordatorios: su fallo queda en el log y en
  // MetaAdAccount.lastSyncError, que la página de campañas muestra.
  let meta: unknown = null;
  if (process.env.META_SYSTEM_USER_TOKEN) {
    try {
      const sync = await runMetaSync();
      meta = { status: sync.status, mode: sync.mode, reason: sync.reason };
      console.log("[meta] cron", sync);
    } catch (error) {
      console.error("[meta] cron falló", error);
      meta = { status: "failed" };
    }
  }

  return Response.json({ ...result, meta });
}
