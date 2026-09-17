/**
 * The zone this business operates in. Hosts run on UTC, so every timestamp
 * shown to a person is pinned here explicitly: a lead that arrived at 19:30
 * would otherwise render as 00:30 the next day.
 *
 * Deliberately NOT the `TZ` variable: Vercel reserves that name, and relying on
 * the process zone would leave correctness to a deployment setting. Reading it
 * here instead means a deployment for a client in another country only changes
 * this value — parsing follows the same zone, DST included.
 */
export const APP_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIME_ZONE || "America/Guayaquil";

/**
 * Minutes to add to a wall-clock reading in `zone` to get UTC, at that instant.
 * Derived from the IANA database via Intl, so zones with DST are handled.
 */
export function zoneOffsetMinutes(instant: Date, zone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return (asIfUtc - instant.getTime()) / 60000;
}

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Formats a true timestamp (createdAt, sentAt, lastViewedAt, etc.) in Ecuador
 * time. The value has meaningful time information.
 */
export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

/**
 * Formats a date-only business field (dueDate, issueDate, paidAt, startDate).
 * Stored as DATE in Postgres; Prisma materializes them at UTC midnight.
 * timeZone: "UTC" prevents day-shift in negative-offset zones (e.g. UTC-5).
 */
export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

/**
 * Components of a calendar-date field in UTC. Use for year/month grouping
 * on @db.Date fields so a UTC-midnight value never falls into the previous
 * day/month/year when the server runs in a negative-offset timezone.
 */
export function dateOnlyParts(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

/** "yyyy-MM" key for grouping @db.Date values without TZ drift. */
export function monthKeyUTC(value: Date | string) {
  const { year, month } = dateOnlyParts(value);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Minutes elapsed since an instant. Timezone-independent by definition. */
export function minutesSince(value: Date | string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 60000);
}

/**
 * Compact "hace 3 h" age. Computed on the server and passed down as a string:
 * deriving it inside a client component makes the server and client disagree by
 * a second and React reports a hydration mismatch.
 */
export function shortAge(value: Date | string) {
  const minutes = minutesSince(value);

  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
