import { dayKeyInAppZone, zoneOffsetMinutes } from "@/lib/admin/format";

/** Hour (Ecuador) of the day-before reminder. */
export const REMINDER_HOUR = 8;

function addDaysToKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The instant a calendar day of the business zone begins. */
export function dayKeyStart(key: string) {
  const asIfUtc = Date.parse(`${key}T00:00:00.000Z`);
  const guess = new Date(asIfUtc - zoneOffsetMinutes(new Date(asIfUtc)) * 60000);
  return new Date(asIfUtc - zoneOffsetMinutes(guess) * 60000);
}

/** Wall-clock hour in the business zone. Independent of the host's TZ. */
export function hourInAppZone(now: Date) {
  const local = new Date(now.getTime() + zoneOffsetMinutes(now) * 60000);
  return local.getUTCHours();
}

/**
 * Bounds the cron needs at `now`: today's and tomorrow's day in Ecuador, as
 * instants, and whether the 8:00 reminder hour has been reached.
 */
export function scheduleWindow(now: Date) {
  const todayKey = dayKeyInAppZone(now);
  const tomorrowKey = addDaysToKey(todayKey, 1);

  return {
    todayKey,
    tomorrowKey,
    todayStart: dayKeyStart(todayKey),
    tomorrowStart: dayKeyStart(tomorrowKey),
    dayAfterStart: dayKeyStart(addDaysToKey(todayKey, 2)),
    reminderHourReached: hourInAppZone(now) >= REMINDER_HOUR,
  };
}
