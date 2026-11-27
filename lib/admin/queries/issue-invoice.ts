import prisma from "@/lib/db/prisma";
import { dayStartUtc } from "@/lib/admin/format";
import { fromCents, sumCents, toCents } from "@/lib/admin/finance/money";
import { getCatalogItems } from "@/lib/admin/queries/catalog";
import { SriEmissionError, getSriTaxContext } from "@/lib/sri/emission";
import { vatOptions } from "@/lib/sri/invoice-calc";
import { guessBuyerIdType } from "@/lib/sri/identification";

// Everything the «Emitir factura» screen needs, as plain values, plus what it
// prefills when opened from a milestone (?hito=a,b) or a project (?proyecto=).

export type IssueFormItem = {
  key: string;
  code: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  vatCode: string;
  receivableId: string | null;
};

export type IssueFormPrefill = {
  clientId: string | null;
  projectId: string | null;
  items: IssueFormItem[];
};

let keySeed = 0;
function itemKey() {
  keySeed += 1;
  return `p${keySeed}`;
}

/** Shortest decimal text of a Decimal ("120.00" → "120", "33.50" → "33.5"). */
function plain(value: { toString(): string }) {
  const text = value.toString();
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

export async function getIssueInvoiceData({ hito, proyecto, cliente }: { hito?: string; proyecto?: string; cliente?: string }) {
  const today = dayStartUtc(new Date());

  let tax: Awaited<ReturnType<typeof getSriTaxContext>> | null = null;
  let taxProblem: string | null = null;
  try {
    tax = await getSriTaxContext(today);
  } catch (error) {
    if (!(error instanceof SriEmissionError)) throw error;
    taxProblem = error.message;
  }

  const [clients, catalog, points, certificate, pendingItems] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        legalName: true,
        taxId: true,
        address: true,
        email: true,
        billingEmail: true,
        projects: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        receivables: {
          where: { invoiceId: null, status: { not: "CANCELLED" } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, amount: true, projectId: true },
        },
      },
    }),
    getCatalogItems(),
    prisma.emissionPoint.findMany({
      where: { active: true },
      orderBy: [{ environment: "asc" }, { establishment: "asc" }, { emissionPoint: "asc" }],
    }),
    prisma.sriCertificate.findFirst({ where: { active: true }, select: { holder: true, validTo: true } }),
    // Milestones already on an invoice still on its way to the SRI.
    prisma.invoiceItem.findMany({
      where: {
        receivableId: { not: null },
        invoice: { source: "ISSUED", sriStatus: { in: ["DRAFT", "SIGNED", "RECEIVED", "AUTHORIZED"] } },
      },
      select: { receivableId: true },
    }),
  ]);

  const taken = new Set(pendingItems.map((i) => i.receivableId));
  const vat = vatOptions(tax?.vatRates ?? []);
  const defaultVatCode = vat[0]?.code ?? "0";

  const plainClients = clients.map((client) => ({
    id: client.id,
    name: client.name,
    legalName: client.legalName,
    taxId: client.taxId,
    idType: guessBuyerIdType(client.taxId),
    address: client.address,
    email: client.billingEmail ?? client.email,
    projects: client.projects,
    hitos: client.receivables
      .filter((r) => !taken.has(r.id))
      .map((r) => ({ id: r.id, title: r.title, amount: plain(r.amount), projectId: r.projectId })),
  }));

  // Prefill.
  const prefill: IssueFormPrefill = { clientId: cliente ?? null, projectId: null, items: [] };
  const hitoIds = (hito ?? "").split(",").filter(Boolean);
  if (hitoIds.length) {
    const hitos = await prisma.receivable.findMany({
      where: { id: { in: hitoIds }, invoiceId: null, status: { not: "CANCELLED" } },
      select: { id: true, title: true, amount: true, clientId: true, projectId: true },
    });
    const usable = hitos.filter((h) => h.clientId === hitos[0]?.clientId && !taken.has(h.id));
    if (usable.length) {
      prefill.clientId = usable[0].clientId;
      const projects = [...new Set(usable.map((h) => h.projectId))];
      prefill.projectId = projects.length === 1 ? projects[0] : null;
      prefill.items = usable.map((h) => ({
        key: itemKey(),
        code: "",
        description: h.title,
        quantity: "1",
        unitPrice: plain(h.amount),
        discount: "",
        vatCode: defaultVatCode,
        receivableId: h.id,
      }));
    }
  } else if (proyecto) {
    const project = await prisma.project.findUnique({
      where: { id: proyecto },
      select: {
        id: true,
        name: true,
        clientId: true,
        budget: true,
        invoices: { where: { status: { not: "CANCELLED" } }, select: { total: true } },
      },
    });
    if (project?.clientId) {
      prefill.clientId = project.clientId;
      prefill.projectId = project.id;
      // What is left of the budget after the invoices already registered.
      const left = project.budget ? toCents(project.budget) - sumCents(project.invoices, (i) => i.total) : 0;
      prefill.items = [
        {
          key: itemKey(),
          code: "",
          description: project.name,
          quantity: "1",
          unitPrice: left > 0 ? plain(fromCents(left)) : "",
          discount: "",
          vatCode: defaultVatCode,
          receivableId: null,
        },
      ];
    }
  }
  if (prefill.clientId && !plainClients.some((c) => c.id === prefill.clientId)) prefill.clientId = null;

  return {
    clients: plainClients,
    catalog,
    vatOptions: vat,
    defaultVatCode,
    taxProblem,
    regimeLegend: tax?.legend ?? null,
    points: points.map((p) => ({
      id: p.id,
      environment: p.environment,
      label: p.label,
      prefix: `${p.establishment}-${p.emissionPoint}`,
      nextNumber: `${p.establishment}-${p.emissionPoint}-${String(p.nextSequential).padStart(9, "0")}`,
    })),
    certificate: certificate && certificate.validTo > new Date() ? { holder: certificate.holder } : null,
    prefill,
  };
}

export type IssueInvoiceData = Awaited<ReturnType<typeof getIssueInvoiceData>>;
