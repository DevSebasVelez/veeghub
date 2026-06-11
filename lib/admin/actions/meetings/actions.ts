"use server";

import { revalidatePath } from "next/cache";

import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { meetingSchema, parseForm } from "@/lib/admin/schemas";

const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

export type MeetingStatusValue = (typeof MEETING_STATUSES)[number];

function revalidateMeetings() {
  revalidatePath("/admin");
  revalidatePath("/admin/reuniones");
}

export async function createMeeting(formData: FormData) {
  await requireAdmin();
  const data = parseForm(meetingSchema, formData);

  await prisma.meeting.create({ data });

  revalidateMeetings();
}

export async function updateMeeting(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(meetingSchema, formData);

  await prisma.meeting.update({
    where: { id },
    data,
  });

  revalidateMeetings();
}

export async function updateMeetingStatus(
  id: string,
  status: MeetingStatusValue,
) {
  await requireAdmin();

  if (!MEETING_STATUSES.includes(status)) {
    throw new Error("Estado de reunión inválido");
  }

  await prisma.meeting.update({
    where: { id },
    data: { status },
  });

  revalidateMeetings();
}

export async function deleteMeeting(id: string) {
  await requireAdmin();

  await prisma.meeting.delete({ where: { id } });

  revalidateMeetings();
}
