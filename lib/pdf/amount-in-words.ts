// Amount in Spanish words, the way receipts in Ecuador spell it out:
// 1250.5 → "Mil doscientos cincuenta dólares con 50/100".

const UNITS = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function belowHundred(n: number) {
  if (n < 30) return UNITS[n];
  const unit = n % 10;
  return unit ? `${TENS[Math.floor(n / 10)]} y ${UNITS[unit]}` : TENS[n / 10];
}

function belowThousand(n: number) {
  if (n === 100) return "cien";
  const rest = n % 100;
  const hundreds = HUNDREDS[Math.floor(n / 100)];
  return [hundreds, rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** "uno" becomes "un" before a noun: "veintiún mil", "un millón", "un dólar". */
function apocope(words: string) {
  return words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

function integerToWords(n: number): string {
  if (n === 0) return "cero";

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];

  if (millions) {
    parts.push(millions === 1 ? "un millón" : `${apocope(integerToWords(millions))} millones`);
  }
  if (thousands) {
    parts.push(thousands === 1 ? "mil" : `${apocope(belowThousand(thousands))} mil`);
  }
  if (rest) parts.push(belowThousand(rest));

  return parts.join(" ");
}

/** Whole cents → "Mil doscientos cincuenta dólares con 00/100". */
export function amountInWords(cents: number) {
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");

  let words = apocope(integerToWords(whole));
  // "un millón de dólares", "dos millones de dólares".
  if (/(millón|millones)$/.test(words)) words += " de";
  const currency = whole === 1 ? "dólar" : "dólares";
  const text = `${words} ${currency} con ${fraction}/100`;

  return text.charAt(0).toUpperCase() + text.slice(1);
}
