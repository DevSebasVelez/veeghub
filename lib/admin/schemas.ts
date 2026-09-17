import { z } from "zod";

import { APP_TIME_ZONE, zoneOffsetMinutes } from "@/lib/admin/format";

// Preprocess normalizes null/undefined to "" so downstream validators don't choke on missing form fields.
const coerceStr = (val: unknown) => (val == null ? "" : String(val));

const optionalText = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .transform((v) => v || null),
);

const requiredText = z.string().trim().min(1, "Campo requerido");

const optionalDate = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .transform((v) => (v ? new Date(v) : null)),
);

const HAS_OFFSET = /([zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * A datetime-local input submits "2026-09-20T15:00" with no offset, and
 * `new Date()` then reads it in the RUNTIME's timezone. On a UTC host that
 * silently stores 15:00 as 10:00 Ecuador time.
 *
 * The wall-clock reading is resolved against APP_TIME_ZONE instead, so the
 * value means the same instant on any host and does not depend on the `TZ`
 * variable — which Vercel reserves anyway.
 *
 * The offset is looked up twice because it depends on the very instant being
 * computed: on a DST changeover the first guess can land on the wrong side.
 */
export function parseLocalDateTime(value: string, zone = APP_TIME_ZONE) {
  const trimmed = value.trim();

  if (HAS_OFFSET.test(trimmed)) return new Date(trimmed);

  const withSeconds = /T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00`
    : trimmed;

  const asIfUtc = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(asIfUtc)) return new Date(NaN);

  const firstGuess = new Date(
    asIfUtc - zoneOffsetMinutes(new Date(asIfUtc), zone) * 60000,
  );

  return new Date(
    asIfUtc - zoneOffsetMinutes(firstGuess, zone) * 60000,
  );
}

const requiredDateTime = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .min(1, "Campo requerido")
    .transform((v) => parseLocalDateTime(v))
    .refine((d) => !Number.isNaN(d.getTime()), "Fecha inválida"),
);

const optionalId = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .transform((v) => (!v || v === "none" ? null : v)),
);

// Parses a comma-separated list of ids (from a hidden CSV field) into a string[].
const idList = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
);

const money = z
  .preprocess(coerceStr, z.string().trim().min(1, "Ingresa un monto"))
  .transform((v) => Number(String(v).replace(",", ".")))
  .refine((v) => Number.isFinite(v) && v >= 0, "Monto inválido");

const optionalMoney = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 0),
      "Monto inválido",
    ),
);

export const clientSchema = z.object({
  name: requiredText,
  legalName: optionalText,
  taxId: optionalText,
  email: optionalText,
  billingEmail: optionalText,
  phone: optionalText,
  website: optionalText,
  address: optionalText,
  notes: optionalText,
});

export const projectSchema = z.object({
  name: requiredText,
  clientId: optionalId,
  status: z.enum(["LEAD", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
  description: optionalText,
  stack: optionalText,
  repositoryUrl: optionalText,
  productionUrl: optionalText,
  stagingUrl: optionalText,
  budget: optionalMoney,
  startDate: optionalDate,
  dueDate: optionalDate,
});

export const taskSchema = z.object({
  projectId: requiredText,
  title: requiredText,
  description: optionalText,
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: optionalDate,
});

export const receivableSchema = z.object({
  clientId: requiredText,
  projectId: optionalId,
  title: requiredText,
  description: optionalText,
  amount: money,
  dueDate: optionalDate,
  status: z.enum([
    "PLANNED",
    "INVOICED",
    "PARTIALLY_PAID",
    "PAID",
    "OVERDUE",
    "CANCELLED",
  ]),
});

export const paymentSchema = z.object({
  receivableId: requiredText,
  amount: money,
  paidAt: optionalDate,
  method: optionalText,
  reference: optionalText,
  notes: optionalText,
});

export const paymentUpdateSchema = z.object({
  amount: money,
  paidAt: optionalDate,
  method: optionalText,
  reference: optionalText,
  notes: optionalText,
});

export const invoiceSchema = z.object({
  clientId: requiredText,
  projectId: optionalId,
  receivableIds: idList,
  invoiceNumber: optionalText,
  accessKey: optionalText,
  subtotal: optionalMoney,
  taxAmount: optionalMoney,
  total: money,
  issueDate: optionalDate,
  status: z
    .enum(["READY_TO_SEND", "SENT", "PAID", "CANCELLED"])
    .default("READY_TO_SEND"),
});

export const folderSchema = z.object({
  name: requiredText,
  parentId: optionalId,
  clientId: optionalId,
  projectId: optionalId,
});

export const driveFileSchema = z.object({
  name: requiredText,
  folderId: optionalId,
  clientId: optionalId,
  projectId: optionalId,
});

export const meetingSchema = z
  .object({
    title: requiredText,
    clientId: optionalId,
    startsAt: requiredDateTime,
    endsAt: requiredDateTime,
    meetLink: optionalText.refine(
      (v) => v === null || /^https?:\/\//.test(v),
      "El enlace debe iniciar con http:// o https://",
    ),
    notes: optionalText,
    status: z
      .enum(["SCHEDULED", "COMPLETED", "CANCELLED"])
      .default("SCHEDULED"),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "La hora de fin debe ser posterior a la de inicio.",
    path: ["endsAt"],
  });

export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const LEAD_SOURCES = [
  "META_ADS",
  "INSTAGRAM",
  "WHATSAPP",
  "REFERRAL",
  "WEBSITE",
  "MANUAL",
  "CSV_IMPORT",
  "OTHER",
] as const;

export const LEAD_ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
] as const;

export const leadSchema = z.object({
  name: requiredText,
  email: optionalText,
  phone: optionalText,
  company: optionalText,
  message: optionalText,
  stage: z.enum(LEAD_STAGES).default("NEW"),
  source: z.enum(LEAD_SOURCES).default("MANUAL"),
  serviceTag: optionalText,
  estimatedValue: optionalMoney,
  nextFollowUpAt: optionalDate,
  notes: optionalText,
  lostReason: optionalText,
});

export const leadActivitySchema = z.object({
  type: z.enum(LEAD_ACTIVITY_TYPES).default("NOTE"),
  body: requiredText,
});

// Conversion pre-fills a Client from the lead; project and receivable are opt-in
// so a won lead that is not a project yet still becomes a client.
export const leadConvertSchema = z.object({
  clientName: requiredText,
  email: optionalText,
  phone: optionalText,
  createProject: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  projectName: optionalText,
  budget: optionalMoney,
  createReceivable: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  receivableTitle: optionalText,
  receivableAmount: optionalMoney,
});

export const credentialSchema = z
  .object({
    clientId: optionalId,
    projectId: optionalId,
    title: requiredText,
    kind: z.enum([
      "LOGIN",
      "OAUTH",
      "API_KEY",
      "DATABASE",
      "HOSTING",
      "SOCIAL_MEDIA",
      "EMAIL",
      "OTHER",
    ]),
    url: optionalText,
    username: optionalText,
    accessMethod: optionalText,
    secret: optionalText,
    existingSecret: optionalText,
    notes: optionalText,
  })
  .refine(
    (value) => value.secret || value.accessMethod || value.existingSecret,
    {
      message: "Guarda un secreto o un método de acceso.",
      path: ["secret"],
    },
  );

export function parseForm<T extends z.ZodType>(schema: T, formData: FormData) {
  return schema.parse(Object.fromEntries(formData));
}

export function formErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}
