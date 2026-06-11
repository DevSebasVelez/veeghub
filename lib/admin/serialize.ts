// Converts Prisma entity objects (with Decimal/Date) to plain objects safe for
// passing as props to client components across the server/client boundary.

export function forClientDialog(c: {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
}) {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName,
    taxId: c.taxId,
    email: c.email,
    billingEmail: c.billingEmail,
    phone: c.phone,
    website: c.website,
    address: c.address,
    notes: c.notes,
  };
}

export function forProjectDialog(p: {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  description: string | null;
  stack: string | null;
  repositoryUrl: string | null;
  productionUrl: string | null;
  stagingUrl: string | null;
  budget: { toString(): string } | null;
  startDate: Date | null;
  dueDate: Date | null;
}) {
  return {
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    status: p.status,
    description: p.description,
    stack: p.stack,
    repositoryUrl: p.repositoryUrl,
    productionUrl: p.productionUrl,
    stagingUrl: p.stagingUrl ?? null,
    budget: p.budget?.toString() ?? null,
    startDate: p.startDate?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
  };
}

export function forTaskDialog(t: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
}) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
  };
}

export function forReceivableDialog(r: {
  id: string;
  clientId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  amount: { toString(): string };
  dueDate: Date | null;
  status: string;
}) {
  return {
    id: r.id,
    clientId: r.clientId,
    projectId: r.projectId,
    title: r.title,
    description: r.description,
    amount: r.amount.toString(),
    dueDate: r.dueDate?.toISOString() ?? null,
    status: r.status,
  };
}

export function forInvoiceDialog(i: {
  id: string;
  clientId: string;
  projectId: string | null;
  receivables?: { id: string }[];
  invoiceNumber: string | null;
  accessKey: string | null;
  subtotal: { toString(): string } | null;
  taxAmount: { toString(): string } | null;
  total: { toString(): string };
  issueDate: Date | null;
  status: string;
  xmlFile?: { name: string } | null;
  rideFile?: { name: string } | null;
}) {
  return {
    id: i.id,
    clientId: i.clientId,
    projectId: i.projectId,
    receivableIds: i.receivables?.map((r) => r.id) ?? [],
    invoiceNumber: i.invoiceNumber,
    accessKey: i.accessKey,
    subtotal: i.subtotal?.toString() ?? null,
    taxAmount: i.taxAmount?.toString() ?? null,
    total: i.total.toString(),
    issueDate: i.issueDate?.toISOString() ?? null,
    status: i.status,
    xmlFileName: i.xmlFile?.name ?? null,
    rideFileName: i.rideFile?.name ?? null,
  };
}

export function forMeeting(m: {
  id: string;
  title: string;
  clientId: string | null;
  startsAt: Date;
  endsAt: Date;
  meetLink: string | null;
  notes: string | null;
  status: string;
  client?: { id: string; name: string } | null;
}) {
  return {
    id: m.id,
    title: m.title,
    clientId: m.clientId,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    meetLink: m.meetLink,
    notes: m.notes,
    status: m.status,
    clientName: m.client?.name ?? null,
  };
}

export type MeetingDTO = ReturnType<typeof forMeeting>;

export function forCredentialDialog(c: {
  id: string;
  clientId: string | null;
  projectId: string | null;
  title: string;
  kind: string;
  url: string | null;
  username: string | null;
  accessMethod: string | null;
  notes: string | null;
}) {
  return {
    id: c.id,
    clientId: c.clientId,
    projectId: c.projectId,
    title: c.title,
    kind: c.kind,
    url: c.url,
    username: c.username,
    accessMethod: c.accessMethod,
    notes: c.notes,
  };
}

export function forFolderDialog(f: {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
}) {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    clientId: f.clientId,
    projectId: f.projectId,
  };
}

export function forDriveViewFile(f: {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  clientId: string | null;
  projectId: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
}) {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    folderId: f.folderId,
    clientId: f.clientId,
    projectId: f.projectId,
    client: f.client ?? null,
    project: f.project ?? null,
  };
}

export function forDriveViewFolder(f: {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  _count?: { children: number; files: number };
}) {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    clientId: f.clientId,
    projectId: f.projectId,
    client: f.client ?? null,
    project: f.project ?? null,
    _count: f._count,
  };
}

export function forDriveFileDialog(f: {
  id: string;
  name: string;
  folderId: string | null;
  clientId: string | null;
  projectId: string | null;
}) {
  return {
    id: f.id,
    name: f.name,
    folderId: f.folderId,
    clientId: f.clientId,
    projectId: f.projectId,
  };
}
