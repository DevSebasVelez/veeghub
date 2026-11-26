import { runMetaSync, type SyncMode } from "@/lib/meta/sync";
import { cronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronización de Meta Ads a demanda (`?modo=full|quick`, `?forzar=1`).
 * El cron de marketing ya la corre sola; esta ruta sirve para forzarla a mano
 * o desde otro Cron Trigger sin tocar los recordatorios.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const modo = url.searchParams.get("modo");
  const mode: SyncMode | undefined = modo === "full" || modo === "quick" ? modo : undefined;

  const result = await runMetaSync({ mode, force: url.searchParams.get("forzar") === "1" });
  console.log("[meta] cron", result);

  return Response.json(result);
}
