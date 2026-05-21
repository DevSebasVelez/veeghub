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
 * These are stored as UTC midnight in the DB (e.g. 2025-05-30T00:00:00.000Z).
 * Using timeZone: "UTC" ensures the date is always rendered as "30 may 2025"
 * and never shifted to "29 may 2025" due to a negative UTC offset (Ecuador UTC-5).
 */
export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
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
