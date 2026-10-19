// Money arithmetic in integer cents.
//
// Prisma returns Decimal columns as Decimal objects and the forms submit
// strings. Adding them as JavaScript numbers drifts (0.1 + 0.2), so every
// figure the financial summary shows is parsed from its decimal string into
// whole cents, added as integers and only formatted back at the edge.

export type MoneyInput =
  | string
  | number
  | { toString(): string }
  | null
  | undefined;

const DECIMAL = /^([+-])?(\d*)(?:[.,](\d*))?$/;

/** Parses a decimal amount into whole cents, rounding half away from zero. */
export function toCents(value: MoneyInput): number {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  const match = DECIMAL.exec(raw);
  if (!match || (!match[2] && !match[3])) {
    // Exponent notation and other forms numbers can print as.
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return roundHalfAway(parsed * 100);
  }

  const [, sign, whole = "", fraction = ""] = match;
  const digits = fraction.padEnd(3, "0");
  let cents = Number(whole || "0") * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;

  return sign === "-" ? -cents : cents;
}

/** Cents back to a "123.45" string, the form Prisma and formatCurrency take. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function sumCents<T>(items: T[], pick: (item: T) => MoneyInput) {
  return items.reduce((total, item) => total + toCents(pick(item)), 0);
}

/**
 * `cents × rate%`, rounded to the cent. The rate goes through toCents too, so
 * "15", "15.00" and 15 all become 1500 hundredths and the product stays an
 * exact integer before the single rounding step.
 */
export function percentOfCents(cents: number, rate: MoneyInput) {
  return roundHalfAway((cents * toCents(rate)) / 10000);
}

function roundHalfAway(value: number) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}
