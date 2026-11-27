import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { amountInWords } from "@/lib/pdf/amount-in-words";

describe("amountInWords", () => {
  const cases: Array<[number, string]> = [
    [0, "Cero dólares con 00/100"],
    [100, "Un dólar con 00/100"],
    [2150, "Veintiún dólares con 50/100"],
    [10000, "Cien dólares con 00/100"],
    [10100, "Ciento un dólares con 00/100"],
    [125000, "Mil doscientos cincuenta dólares con 00/100"],
    [3599, "Treinta y cinco dólares con 99/100"],
    [2100000, "Veintiún mil dólares con 00/100"],
    [10000000, "Cien mil dólares con 00/100"],
    [100000000, "Un millón de dólares con 00/100"],
    [250000000, "Dos millones quinientos mil dólares con 00/100"],
    [99999999, "Novecientos noventa y nueve mil novecientos noventa y nueve dólares con 99/100"],
  ];

  for (const [cents, words] of cases) {
    it(`${cents} → ${words}`, () => assert.equal(amountInWords(cents), words));
  }
});
