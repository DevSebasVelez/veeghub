import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { dayKeyInAppZone } from "@/lib/admin/format";
import { PAYMENT_METHODS, VAT_CODE_RATES } from "@/lib/sri/invoice-calc";
import { SriEmissionError } from "@/lib/sri/emission";
import { checkBuyerId } from "@/lib/sri/identification";
import type { CreateIssuedInvoiceInput } from "@/lib/sri/issue";

// What the «Emitir factura» screen sends, checked on the server before it
// reaches the builder: the client, project, emission point and milestones
// exist and fit together, and the buyer's id is a real one. The figures are
// checked by buildInvoiceXml itself.

const text = (max: number) => z.string().trim().max(max);

export const issueRequestSchema = z.object({
  clientId: z.string().min(1, "Elige el cliente."),
  projectId: z.string().nullable(),
  emissionPointId: z.string().min(1, "Falta el punto de emisión."),
  buyer: z.object({
    idType: z.enum(["04", "05", "06", "07", "08"]),
    id: text(20),
    name: text(300).min(1, "Falta la razón social del comprador."),
    address: text(300),
    email: text(300),
  }),
  items: z
    .array(
      z.object({
        code: text(25),
        description: text(300),
        quantity: z.string().trim(),
        unitPrice: z.string().trim(),
        discount: z.string().trim(),
        vatCode: z.string().refine((v) => v in VAT_CODE_RATES, "Tarifa de IVA desconocida."),
        receivableId: z.string().nullable(),
      }),
    )
    .min(1, "Agrega al menos un ítem.")
    .max(100, "Una factura admite hasta 100 ítems aquí."),
  paymentMethod: z.string().refine((v) => v in PAYMENT_METHODS, "Forma de pago desconocida."),
  additionalInfo: z.array(z.object({ name: text(300), value: text(300) })).max(14),
  /** Save buyer id, name, address and e-mail on the client. */
  updateClient: z.boolean(),
  /** Idempotency id of the «Emitir» click (absent for the preview). */
  requestId: z.string().uuid().optional(),
});

export type IssueRequest = z.infer<typeof issueRequestSchema>;

/** "1,5" → "1.5"; empty → fallback. */
function decimal(value: string, fallback: string) {
  const normalized = value.replace(",", ".").trim();
  return normalized === "" ? fallback : normalized;
}

/**
 * Validates a request against the database and turns it into the input of
 * createIssuedInvoice / previewIssuedInvoice. Throws Spanish messages.
 */
export async function resolveIssueRequest(raw: unknown) {
  const request = issueRequestSchema.parse(raw);

  const idCheck = checkBuyerId(request.buyer.idType, request.buyer.id);
  if (!idCheck.ok) throw new SriEmissionError(idCheck.error);

  const [client, point] = await Promise.all([
    prisma.client.findUnique({ where: { id: request.clientId }, select: { id: true } }),
    prisma.emissionPoint.findUnique({
      where: { id: request.emissionPointId },
      select: { id: true, environment: true, active: true },
    }),
  ]);
  if (!client) throw new SriEmissionError("El cliente ya no existe.");
  if (!point || !point.active) throw new SriEmissionError("El punto de emisión no está activo.");

  if (request.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: request.projectId, clientId: request.clientId },
      select: { id: true },
    });
    if (!project) throw new SriEmissionError("El proyecto no es de ese cliente.");
  }

  const receivableIds = [...new Set(request.items.map((i) => i.receivableId).filter((id): id is string => Boolean(id)))];
  if (receivableIds.length) {
    const hitos = await prisma.receivable.findMany({
      where: { id: { in: receivableIds } },
      select: { id: true, title: true, clientId: true, invoiceId: true, status: true },
    });
    for (const id of receivableIds) {
      const hito = hitos.find((h) => h.id === id);
      if (!hito || hito.clientId !== request.clientId) throw new SriEmissionError("Un hito no es de ese cliente.");
      if (hito.invoiceId) throw new SriEmissionError(`El hito «${hito.title}» ya tiene factura.`);
      if (hito.status === "CANCELLED") throw new SriEmissionError(`El hito «${hito.title}» está cancelado.`);
    }
    // A milestone on a real invoice still on its way to the SRI is taken
    // too. Test invoices never link milestones, so they never hold one.
    const pending = await prisma.invoiceItem.findFirst({
      where: {
        receivableId: { in: receivableIds },
        invoice: {
          source: "ISSUED",
          environment: "PRODUCCION",
          sriStatus: { in: ["DRAFT", "SIGNED", "RECEIVED", "AUTHORIZED"] },
        },
      },
      select: { receivable: { select: { title: true } }, invoice: { select: { invoiceNumber: true } } },
    });
    if (pending) {
      throw new SriEmissionError(
        `El hito «${pending.receivable?.title}» ya está en la factura ${pending.invoice.invoiceNumber ?? "en curso"}.`,
      );
    }
  }

  const email = request.buyer.email.trim();
  const additionalInfo = [
    ...(email ? [{ name: "Email", value: email }] : []),
    ...request.additionalInfo.filter((f) => f.name.trim() && f.value.trim()),
  ];

  const input: CreateIssuedInvoiceInput = {
    clientId: request.clientId,
    projectId: request.projectId,
    emissionPointId: point.id,
    environment: point.environment,
    issueDay: dayKeyInAppZone(new Date()),
    buyer: {
      idType: request.buyer.idType,
      id: request.buyer.id.trim(),
      name: request.buyer.name.trim(),
      address: request.buyer.address.trim() || null,
    },
    items: request.items.map((item) => ({
      code: item.code || null,
      description: item.description,
      quantity: decimal(item.quantity, ""),
      unitPrice: decimal(item.unitPrice, ""),
      discount: decimal(item.discount, "0"),
      vatCode: item.vatCode,
      receivableId: item.receivableId,
    })),
    payments: [{ method: request.paymentMethod as keyof typeof PAYMENT_METHODS }],
    additionalInfo,
    requestId: request.requestId ?? null,
  };

  return { request, input, warning: idCheck.warning };
}
