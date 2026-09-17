import { defaultPhoneCountry } from "@/lib/meta/config";
import type { MetaFieldEntry, MetaLead } from "@/lib/meta/graph";

// Country dialing codes for phone normalization. Only what we actually sell into;
// anything else falls through and is stored as-is.
const DIALING_CODES: Record<string, string> = {
  EC: "593",
  CO: "57",
  PE: "51",
  MX: "52",
  ES: "34",
  US: "1",
  AR: "54",
  CL: "56",
};

// Meta's standard field names. Custom questions use arbitrary keys.
const NAME_KEYS = ["full_name", "nombre_completo", "name", "nombre"];
const FIRST_NAME_KEYS = ["first_name", "nombre"];
const LAST_NAME_KEYS = ["last_name", "apellido", "apellidos"];
const EMAIL_KEYS = ["email", "correo", "correo_electrónico", "correo_electronico"];
const PHONE_KEYS = ["phone_number", "telefono", "teléfono", "celular", "whatsapp"];
// Form builders let you rename fields freely ("whatsapp_number", "tu_celular"),
// so an exact match is not enough — these are matched as substrings too.
const PHONE_HINTS = ["phone", "telefono", "celular", "whatsapp", "movil", "wpp"];
const EMAIL_HINTS = ["email", "correo", "mail"];
const COMPANY_KEYS = ["company_name", "empresa", "compañía", "compania"];

// Custom questions that identify which service the lead is after.
const SERVICE_HINTS = ["servicio", "necesit", "interes", "interés", "producto"];

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function firstValue(entry: MetaFieldEntry | undefined) {
  const value = entry?.values?.[0];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pick(fields: MetaFieldEntry[], keys: string[]) {
  const normalizedKeys = keys.map(normalizeKey);

  const match = fields.find((field) =>
    normalizedKeys.includes(normalizeKey(field.name)),
  );

  return firstValue(match);
}

/** Exact match first, then a substring pass for renamed fields. */
function pickFuzzy(
  fields: MetaFieldEntry[],
  keys: string[],
  hints: string[],
) {
  const exact = pick(fields, keys);
  if (exact) return exact;

  const normalizedHints = hints.map(normalizeKey);

  const match = fields.find((field) => {
    const key = normalizeKey(field.name);
    return normalizedHints.some((hint) => key.includes(hint));
  });

  return firstValue(match);
}

function isPhoneField(name: string) {
  const key = normalizeKey(name);
  return (
    PHONE_KEYS.map(normalizeKey).includes(key) ||
    PHONE_HINTS.some((hint) => key.includes(normalizeKey(hint)))
  );
}

function isEmailField(name: string) {
  const key = normalizeKey(name);
  return (
    EMAIL_KEYS.map(normalizeKey).includes(key) ||
    EMAIL_HINTS.some((hint) => key.includes(normalizeKey(hint)))
  );
}

/**
 * Meta returns option values in snake_case ("software_a_medida"). Shown raw on a
 * card it reads like a database key, so underscores become spaces for display.
 */
export function humanizeValue(value: string | null) {
  if (!value) return null;

  const cleaned = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Normalizes a phone number to E.164 (+593999999999).
 * Meta returns wildly inconsistent formats depending on how the user typed it,
 * and wa.me links need E.164 without the plus sign.
 */
export function normalizePhone(raw: string | null, country = defaultPhoneCountry()) {
  if (!raw) return null;

  const dialing = DIALING_CODES[country.toUpperCase()] ?? DIALING_CODES.EC;
  let digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+")) {
    const body = digits.slice(1).replace(/\D/g, "");
    return body ? `+${body}` : null;
  }

  digits = digits.replace(/\D/g, "");
  if (!digits) return null;

  // Already carries the country code (e.g. 593999999999).
  if (digits.startsWith(dialing) && digits.length > dialing.length + 6) {
    return `+${digits}`;
  }

  // National format with trunk zero: 0999999999 -> +593999999999
  if (digits.startsWith("0")) {
    return `+${dialing}${digits.slice(1)}`;
  }

  return `+${dialing}${digits}`;
}

/** wa.me requires E.164 with no plus sign. */
export function whatsappNumber(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits || null;
}

export type MappedLead = {
  name: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
  company: string | null;
  message: string | null;
  serviceTag: string | null;
};

/**
 * Turns Meta's field_data array into Lead columns. Unknown custom questions are
 * preserved verbatim in `message` so nothing the prospect wrote is ever lost —
 * the full payload also goes to Lead.rawPayload.
 */
export function mapLeadFields(lead: MetaLead): MappedLead {
  const fields = Array.isArray(lead.field_data) ? lead.field_data : [];

  const fullName = pick(fields, NAME_KEYS);
  const firstName = pick(fields, FIRST_NAME_KEYS);
  const lastName = pick(fields, LAST_NAME_KEYS);

  const name = fullName || [firstName, lastName].filter(Boolean).join(" ").trim();

  const phoneRaw = pickFuzzy(fields, PHONE_KEYS, PHONE_HINTS);

  const knownKeys = new Set(
    [
      ...NAME_KEYS,
      ...FIRST_NAME_KEYS,
      ...LAST_NAME_KEYS,
      ...EMAIL_KEYS,
      ...PHONE_KEYS,
      ...COMPANY_KEYS,
    ].map(normalizeKey),
  );

  const custom = fields.filter((field) => {
    const key = normalizeKey(field.name);
    return (
      !knownKeys.has(key) && !isPhoneField(field.name) && !isEmailField(field.name)
    );
  });

  const message =
    custom
      .map((field) => {
        const value = firstValue(field);
        if (!value) return null;
        // Question keys arrive as "¿que_necesitas?" — readable in the timeline
        // only once the underscores are gone.
        return `${humanizeValue(field.name)}: ${humanizeValue(value)}`;
      })
      .filter(Boolean)
      .join("\n") || null;

  const serviceField = custom.find((field) => {
    const key = normalizeKey(field.name);
    return SERVICE_HINTS.some((hint) => key.includes(normalizeKey(hint)));
  });

  return {
    name: name || "Lead sin nombre",
    email: pickFuzzy(fields, EMAIL_KEYS, EMAIL_HINTS),
    phone: normalizePhone(phoneRaw),
    phoneRaw,
    company: pick(fields, COMPANY_KEYS),
    message,
    serviceTag: humanizeValue(firstValue(serviceField)),
  };
}
