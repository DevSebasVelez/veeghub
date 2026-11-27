// Ecuadorian identification numbers, checked the way the Registro Civil and
// the SRI build them. celcer authorizes invoices with an invalid cédula
// (verified 2026-11-27), production may not, so VeegHub checks before issuing.
//
// - Cédula: 10 digits, province 01–24 or 30, third digit 0–5, módulo 10.
// - RUC persona natural: a valid cédula + establishment (not "000").
// - RUC sociedad pública (third digit 6) and privada (9): módulo 11. The SRI
//   has handed out sociedad RUCs that fail módulo 11, so for those a bad check
//   digit is a warning, not an error.

export type IdCheck =
  | { ok: true; warning: string | null }
  | { ok: false; error: string };

const ok = (warning: string | null = null): IdCheck => ({ ok: true, warning });
const fail = (error: string): IdCheck => ({ ok: false, error });

function provinceOk(id: string) {
  const province = Number(id.slice(0, 2));
  return (province >= 1 && province <= 24) || province === 30;
}

function digits(id: string) {
  return id.split("").map(Number);
}

/** Módulo 10 check digit over the first nine digits of a cédula. */
function cedulaCheckDigit(id: string) {
  const sum = digits(id)
    .slice(0, 9)
    .reduce((total, digit, index) => {
      const product = digit * (index % 2 === 0 ? 2 : 1);
      return total + (product > 9 ? product - 9 : product);
    }, 0);
  return (10 - (sum % 10)) % 10;
}

/** Módulo 11 check digit with the given coefficients. */
function mod11CheckDigit(id: string, coefficients: number[]) {
  const sum = coefficients.reduce((total, coefficient, index) => total + coefficient * Number(id[index]), 0);
  const rest = sum % 11;
  return rest === 0 ? 0 : 11 - rest;
}

export function checkCedula(raw: string): IdCheck {
  const id = raw.trim();
  if (!/^\d{10}$/.test(id)) return fail("La cédula debe tener 10 dígitos.");
  if (!provinceOk(id)) return fail("La cédula no empieza con un código de provincia válido.");
  if (Number(id[2]) > 5) return fail("El tercer dígito de una cédula va de 0 a 5.");
  if (cedulaCheckDigit(id) !== Number(id[9])) return fail("La cédula no es válida: el dígito verificador no cuadra.");
  return ok();
}

export function checkRuc(raw: string): IdCheck {
  const id = raw.trim();
  if (!/^\d{13}$/.test(id)) return fail("El RUC debe tener 13 dígitos.");
  if (!provinceOk(id)) return fail("El RUC no empieza con un código de provincia válido.");

  const third = Number(id[2]);
  if (third <= 5) {
    const cedula = checkCedula(id.slice(0, 10));
    if (!cedula.ok) return fail(`El RUC no es válido: ${cedula.error.replace(/^La cédula/, "la cédula")}`);
    if (id.slice(10) === "000") return fail("El RUC no puede terminar en 000.");
    return ok();
  }

  if (third === 6) {
    if (id.slice(9) === "0000") return fail("El RUC no puede terminar en 0000.");
    return mod11CheckDigit(id, [3, 2, 7, 6, 5, 4, 3, 2]) === Number(id[8])
      ? ok()
      : ok("El dígito verificador del RUC no cuadra. Confírmalo en el SRI antes de emitir.");
  }

  if (third === 9) {
    if (id.slice(10) === "000") return fail("El RUC no puede terminar en 000.");
    return mod11CheckDigit(id, [4, 3, 2, 7, 6, 5, 4, 3, 2]) === Number(id[9])
      ? ok()
      : ok("El dígito verificador del RUC no cuadra. Confírmalo en el SRI antes de emitir.");
  }

  return fail("El tercer dígito del RUC debe ser 0–6 o 9.");
}

/**
 * Checks a buyer identification by its Tabla 6 type. Passports and foreign
 * ids have no checksum; consumidor final must be 9999999999999.
 */
export function checkBuyerId(idType: string, raw: string): IdCheck {
  const id = raw.trim();
  switch (idType) {
    case "04":
      return checkRuc(id);
    case "05":
      return checkCedula(id);
    case "07":
      return id === "9999999999999" ? ok() : fail("Consumidor final se identifica con 9999999999999.");
    case "06":
    case "08":
      if (!id) return fail("Falta la identificación del comprador.");
      if (id.length > 20) return fail("La identificación supera 20 caracteres.");
      return ok();
    default:
      return fail("Tipo de identificación desconocido.");
  }
}

/** Tabla 6 type a stored taxId most likely is: 13 digits RUC, 10 cédula. */
export function guessBuyerIdType(taxId: string | null | undefined): "04" | "05" | "06" | "07" {
  const id = taxId?.trim() ?? "";
  if (!id || id === "9999999999999") return "07";
  if (/^\d{13}$/.test(id)) return "04";
  if (/^\d{10}$/.test(id)) return "05";
  return "06";
}
