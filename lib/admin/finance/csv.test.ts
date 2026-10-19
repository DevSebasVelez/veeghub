import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvDate, csvMoney, csvPercent, toCsv } from "@/lib/admin/finance/csv";

describe("csv export", () => {
  it("uses ; separators, CRLF lines and a UTF-8 BOM", () => {
    const csv = toCsv(["Concepto", "Total"], [["Diseño", "10,50"]]);
    assert.equal(csv, "﻿Concepto;Total\r\nDiseño;10,50\r\n");
  });

  it("quotes cells with separators, quotes or line breaks", () => {
    const csv = toCsv(["a"], [['Pago; "anticipo"\nfinal']]);
    assert.equal(csv.split("\r\n")[1], '"Pago; ""anticipo""\nfinal"');
  });

  it("writes money with a decimal comma and no thousands mark", () => {
    assert.equal(csvMoney("1234.5"), "1234,50");
    assert.equal(csvMoney(null), "");
    assert.equal(csvMoney("-7"), "-7,00");
  });

  it("writes rates with a decimal comma", () => {
    assert.equal(csvPercent("2.75"), "2,75%");
    assert.equal(csvPercent("15.00"), "15%");
    assert.equal(csvPercent(null), "");
  });

  it("writes calendar dates as ISO days", () => {
    assert.equal(csvDate(new Date("2026-10-05T00:00:00.000Z")), "2026-10-05");
    assert.equal(csvDate(null), "");
  });
});
