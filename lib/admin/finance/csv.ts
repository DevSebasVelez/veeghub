// CSV for Spanish-locale Excel, which is what an accountant in Ecuador will
// most likely open it with: ";" between fields, "," as decimal mark and a
// UTF-8 BOM so accents survive. Dates stay ISO (yyyy-mm-dd) to avoid
// day/month ambiguity.

import { fromCents, toCents, type MoneyInput } from "@/lib/admin/finance/money";

export type CsvCell = string | number | null | undefined;

const SEPARATOR = ";";

function escapeCell(value: CsvCell) {
  if (value == null) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvCell[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(SEPARATOR));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Money as "1234,56" (no thousands mark, so Excel reads it as a number). */
export function csvMoney(value: MoneyInput) {
  if (value == null || value === "") return "";
  return fromCents(toCents(value)).replace(".", ",");
}

/** A stored rate (Decimal "2.75") as "2,75%". */
export function csvPercent(value: { toString(): string } | null | undefined) {
  if (value == null) return "";
  return `${String(Number(value.toString())).replace(".", ",")}%`;
}

export function csvDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
