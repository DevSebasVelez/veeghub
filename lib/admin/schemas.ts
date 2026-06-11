import { z } from "zod";

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

const requiredDateTime = z.preprocess(
  coerceStr,
  z
    .string()
    .trim()
    .min(1, "Campo requerido")
    .transform((v) => new Date(v))
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
