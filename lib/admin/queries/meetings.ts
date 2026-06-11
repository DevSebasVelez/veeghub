import prisma from "@/lib/db/prisma";

export async function getMeetingsInRange(start: Date, end: Date) {
  return prisma.meeting.findMany({
    where: {
      startsAt: { lt: end },
      endsAt: { gt: start },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function getClientOptions() {
  return prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getUpcomingMeetings(limit = 5) {
  return prisma.meeting.findMany({
    where: {
      status: "SCHEDULED",
      endsAt: { gte: new Date() },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}
