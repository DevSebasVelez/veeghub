import prisma from "@/lib/db/prisma";
import {
  appId,
  appSecret,
  defaultPageId,
  graphUrl,
  metaConfigStatus,
  systemUserToken,
} from "@/lib/meta/config";

export type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
  hint?: string;
};

const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "leads_retrieval",
  "ads_read",
  "business_management",
];

// Needed only for the backfill; the webhook works without it, so it is reported
// as a warning rather than a failure.
const BACKFILL_SCOPE = "pages_manage_ads";

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(graphUrl(path));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { cache: "no-store" });
  return response.json();
}

/**
 * Live health check of the Meta integration. Every failure carries the exact
 * fix, because the failure modes here are all configuration, not code.
 */
export async function getMetaIntegrationStatus() {
  const config = metaConfigStatus();

  if (!config.ok) {
    return {
      checks: [
        {
          label: "Variables de entorno",
          ok: false,
          detail: `Faltan: ${config.missing.join(", ")}`,
          hint: "Definilas en el entorno de producción y volvé a desplegar.",
        },
      ] as CheckResult[],
      events: [],
      page: null,
    };
  }

  const checks: CheckResult[] = [];
  const pageId = defaultPageId();

  // 1. Token
  let pageToken = "";

  try {
    const debug = await graph("debug_token", {
      input_token: systemUserToken(),
      access_token: `${appId()}|${appSecret()}`,
    });

    const data = debug?.data ?? {};
    const scopes: string[] = data.scopes ?? [];
    const missing = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));

    checks.push({
      label: "Token del usuario del sistema",
      ok: Boolean(data.is_valid) && missing.length === 0,
      detail: data.is_valid
        ? `${data.type ?? "?"} · ${data.expires_at === 0 ? "no expira" : "expira"} · ${scopes.length} permisos`
        : "Token inválido",
      hint: missing.length
        ? `Faltan permisos: ${missing.join(", ")}. Regenerá el token del usuario del sistema.`
        : undefined,
    });

    checks.push({
      label: "Permiso de backfill",
      ok: scopes.includes(BACKFILL_SCOPE),
      detail: scopes.includes(BACKFILL_SCOPE)
        ? "pages_manage_ads presente"
        : "Falta pages_manage_ads",
      hint: scopes.includes(BACKFILL_SCOPE)
        ? undefined
        : "El webhook funciona igual. Sin este permiso no se pueden listar formularios ni recuperar leads históricos.",
    });
  } catch (error) {
    checks.push({
      label: "Token del usuario del sistema",
      ok: false,
      detail: error instanceof Error ? error.message : "Error al validar",
    });
  }

  // 2. Page token
  try {
    const page = await graph(pageId, {
      fields: "access_token,name",
      access_token: systemUserToken(),
    });

    pageToken = page?.access_token ?? "";

    checks.push({
      label: "Acceso a la Página",
      ok: Boolean(pageToken),
      detail: page?.name ? `${page.name} (${pageId})` : "Sin acceso",
      hint: pageToken
        ? undefined
        : "El usuario del sistema no tiene la Página asignada como activo.",
    });
  } catch (error) {
    checks.push({
      label: "Acceso a la Página",
      ok: false,
      detail: error instanceof Error ? error.message : "Error",
    });
  }

  // 3. Conexión A — app-level webhook declaration
  try {
    const subs = await graph(`${appId()}/subscriptions`, {
      access_token: `${appId()}|${appSecret()}`,
    });

    const pageSub = (subs?.data ?? []).find(
      (item: { object?: string }) => item.object === "page",
    );

    const hasLeadgen = (pageSub?.fields ?? []).some(
      (field: { name?: string }) => field.name === "leadgen",
    );

    checks.push({
      label: "A · Webhook declarado por la app",
      ok: Boolean(pageSub?.active) && hasLeadgen,
      detail: pageSub
        ? `${pageSub.callback_url} · ${hasLeadgen ? "leadgen" : "sin leadgen"}`
        : "Sin suscripción",
      hint: pageSub
        ? undefined
        : "App Dashboard → Webhooks → objeto Página → suscribir el campo leadgen.",
    });
  } catch (error) {
    checks.push({
      label: "A · Webhook declarado por la app",
      ok: false,
      detail: error instanceof Error ? error.message : "Error",
    });
  }

  // 4. Conexión B — app installed on the page
  try {
    const apps = await graph(`${pageId}/subscribed_apps`, {
      access_token: pageToken,
    });

    const installed = (apps?.data ?? []).find(
      (item: { id?: string }) => item.id === appId(),
    );

    checks.push({
      label: "B · App instalada en la Página",
      ok: Boolean(installed),
      detail: installed
        ? `${installed.name} · ${(installed.subscribed_fields ?? []).join(", ")}`
        : "No instalada",
      hint: installed
        ? undefined
        : "POST /{page-id}/subscribed_apps?subscribed_fields=leadgen — no hay botón en ningún panel de Meta.",
    });
  } catch (error) {
    checks.push({
      label: "B · App instalada en la Página",
      ok: false,
      detail: error instanceof Error ? error.message : "Error",
    });
  }

  const [events, page] = await Promise.all([
    prisma.metaWebhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
    prisma.metaPage.findUnique({ where: { pageId } }),
  ]);

  return { checks, events, page };
}
