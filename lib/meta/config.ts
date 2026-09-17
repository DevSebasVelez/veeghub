// Central place for Meta/Graph configuration. Every accessor fails loudly in
// production so a misconfigured deploy is obvious instead of silently dropping leads.

const DEFAULT_GRAPH_VERSION = "v23.0";

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Define ${name} para la integración con Meta.`);
  }

  return value;
}

export function graphVersion() {
  return process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
}

export function graphUrl(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${graphVersion()}/${clean}`;
}

export function appId() {
  return required("META_APP_ID");
}

export function appSecret() {
  return required("META_APP_SECRET");
}

export function webhookVerifyToken() {
  return required("META_WEBHOOK_VERIFY_TOKEN");
}

export function systemUserToken() {
  return required("META_SYSTEM_USER_TOKEN");
}

export function defaultPageId() {
  return required("META_PAGE_ID");
}

export function defaultPhoneCountry() {
  return process.env.DEFAULT_PHONE_COUNTRY || "EC";
}

// Reports missing configuration without throwing, for the integration health panel.
export function metaConfigStatus() {
  const keys = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN",
    "META_SYSTEM_USER_TOKEN",
    "META_PAGE_ID",
  ] as const;

  const missing = keys.filter((key) => !process.env[key]);

  return { ok: missing.length === 0, missing };
}
