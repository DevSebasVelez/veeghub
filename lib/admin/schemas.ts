import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const requiredText = z.string().trim().min(1, "Campo requerido");

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value ? new Date(value) : null));

const optionalId = z
  .string()
  .trim()
  .transform((value) => (!value || value === "none" ? null : value));

const money = z
  .string()
  .trim()
  .min(1, "Ingresa un monto")
  .transform((value) => Number(value.replace(",", ".")))
  .refine((value) => Number.isFinite(value) && value >= 0, "Monto inválido");

const optionalMoney = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value.replace(",", ".")) : null))
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    "Monto inválido",
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
  stagingUrl: optionalText.optional(),
  budget: optionalMoney,
  startDate: optionalDate.optional(),
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

export const invoiceSchema = z.object({
  clientId: requiredText,
  projectId: optionalId,
  receivableId: optionalId,
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
    existingSecret: optionalText.optional(),
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
