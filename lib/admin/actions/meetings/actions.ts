"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { AdminFormState } from "@/lib/admin/actions/types";
import { actionState } from "@/lib/admin/actions/shared";
import { meetingSchema, parseForm } from "@/lib/admin/schemas";

const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

export type MeetingStatusValue = (typeof MEETING_STATUSES)[number];

function revalidateMeetings() {
  revalidatePath("/admin");
  revalidatePath("/admin/reuniones");
}

export async function createMeeting(formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(meetingSchema, formData);

    await prisma.meeting.create({ data });

    revalidateMeetings();
  });
}

export async function updateMeeting(id: string, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {
    const data = parseForm(meetingSchema, formData);

    await prisma.meeting.update({
      where: { id },
      data,
    });

    revalidateMeetings();
  });
}

export async function updateMeetingStatus(
  id: string,
  status: MeetingStatusValue,
): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {

    if (!MEETING_STATUSES.includes(status)) {
      throw new Error("Estado de reunión inválido");
    }

    await prisma.meeting.update({
      where: { id },
      data: { status },
    });

    revalidateMeetings();
  });
}

export async function deleteMeeting(id: string): Promise<AdminFormState> {
  await requireAdmin();

  return actionState(async () => {

    await prisma.meeting.delete({ where: { id } });

    revalidateMeetings();
  });
}
