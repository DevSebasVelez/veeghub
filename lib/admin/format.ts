export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Formats a true timestamp (createdAt, sentAt, lastViewedAt, etc.) using the
 * server/browser local timezone. The value has meaningful time information.
 */
export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
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
