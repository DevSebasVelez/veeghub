"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  LEAD_STAGES,
  leadActivitySchema,
  leadConvertSchema,
  leadSchema,
  parseForm,
} from "@/lib/admin/schemas";
import { actionState } from "@/lib/admin/actions/shared";
import { slugify } from "@/lib/admin/slug";
import type { AdminFormState } from "@/lib/admin/actions/types";
import type { LeadStage } from "@/app/generated/prisma/client";

function revalidateLeads(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  if (id) revalidatePath(`/admin/leads/${id}`);
}

export async function createLead(formData: FormData) {
  await requireAdmin();
  const data = parseForm(leadSchema, formData);

  const lead = await prisma.lead.create({
    data: {
      ...data,
      activities: { create: { type: "SYSTEM", body: "Lead creado a mano." } },
    },
    select: { id: true },
  });

  revalidateLeads(lead.id);
}

export async function updateLead(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(leadSchema, formData);

  await prisma.lead.update({ where: { id }, data });

  revalidateLeads(id);
}

export async function updateLeadState(
  id: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => updateLead(id, formData));
}

/**
 * Moving out of NEW stamps firstContactedAt once. That timestamp is the only
 * way to measure response time, which is the metric that decides whether a
 * lead from a paid campaign converts.
 */
export async function updateLeadStage(id: string, stage: string) {
  await requireAdmin();

  if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) {
    throw new Error("Etapa inválida");
  }

  const next = stage as LeadStage;

  const current = await prisma.lead.findUniqueOrThrow({
    where: { id },
    select: { stage: true, firstContactedAt: true },
  });

  if (current.stage === next) return;

  const leavingNew = current.stage === "NEW" && next !== "NEW";

  await prisma.lead.update({
    where: { id },
    data: {
      stage: next,
      stageChangedAt: new Date(),
      ...(leavingNew && !current.firstContactedAt
        ? { firstContactedAt: new Date() }
        : {}),
      activities: {
        create: {
          type: "STAGE_CHANGE",
          fromStage: current.stage,
          toStage: next,
        },
      },
    },
  });

  revalidateLeads(id);
}

/** One-tap "I called them" from the board, without opening the lead. */
export async function markLeadContacted(id: string) {
  await requireAdmin();

  const current = await prisma.lead.findUniqueOrThrow({
    where: { id },
    select: { stage: true, firstContactedAt: true },
  });

  await prisma.lead.update({
    where: { id },
    data: {
      ...(current.stage === "NEW" ? { stage: "CONTACTED" } : {}),
      ...(current.firstContactedAt ? {} : { firstContactedAt: new Date() }),
      stageChangedAt: new Date(),
      activities: { create: { type: "CALL", body: "Primer contacto." } },
    },
  });

  revalidateLeads(id);
}

export async function addLeadActivity(leadId: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(leadActivitySchema, formData);

  await prisma.leadActivity.create({ data: { ...data, leadId } });

  revalidateLeads(leadId);
}

export async function addLeadActivityState(
  leadId: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => addLeadActivity(leadId, formData));
}

export async function setLeadFollowUp(id: string, date: string | null) {
  await requireAdmin();

  await prisma.lead.update({
    where: { id },
    // A date-only value ("2026-09-20") is parsed as UTC midnight by spec and
    // displayed with formatDateOnly, matching how @db.Date fields behave here.
    data: { nextFollowUpAt: date ? new Date(date) : null },
  });

  revalidateLeads(id);
}

export async function deleteLead(id: string) {
  await requireAdmin();

  await prisma.lead.delete({ where: { id } });

  revalidateLeads();
}

/**
 * Converts a won lead into a Client, optionally with a Project and a Receivable.
 * Runs in a transaction: a half-converted lead would leave a client with no
 * trace of where it came from.
 */
export async function convertLeadToClient(leadId: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(leadConvertSchema, formData);

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: data.clientName,
        email: data.email,
        phone: data.phone,
      },
      select: { id: true },
    });

    let projectId: string | null = null;

    if (data.createProject && data.projectName) {
      const base = slugify(data.projectName);
      const taken = await tx.project.findUnique({ where: { slug: base } });

      const project = await tx.project.create({
        data: {
          name: data.projectName,
          slug: taken ? `${base}-${Date.now().toString(36)}` : base,
          clientId: client.id,
          status: "LEAD",
          budget: data.budget,
        },
        select: { id: true },
      });

      projectId = project.id;
    }

    if (data.createReceivable && data.receivableAmount != null) {
      await tx.receivable.create({
        data: {
          clientId: client.id,
          projectId,
          title: data.receivableTitle ?? "Anticipo",
          amount: data.receivableAmount,
          status: "PLANNED",
        },
      });
    }

    // Claims the lead inside the transaction: updateMany with
    // convertedClientId: null only matches an unconverted lead, so a double
    // submit hits 0 rows and rolls the whole thing back. Checking before the
    // transaction would let two concurrent requests both pass and leave an
    // orphan client behind.
    const claimed = await tx.lead.updateMany({
      where: { id: leadId, convertedClientId: null },
      data: {
        stage: "WON",
        stageChangedAt: new Date(),
        convertedClientId: client.id,
        convertedProjectId: projectId,
        convertedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new Error("Este lead ya fue convertido en cliente.");
    }

    await tx.leadActivity.create({
      data: {
        leadId,
        type: "SYSTEM",
        body: `Convertido en cliente ${data.clientName}.`,
      },
    });
  });

  revalidateLeads(leadId);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/proyectos");
}

export async function convertLeadToClientState(
  leadId: string,
  _state: AdminFormState,
  formData: FormData,
) {
  return actionState(() => convertLeadToClient(leadId, formData));
}
