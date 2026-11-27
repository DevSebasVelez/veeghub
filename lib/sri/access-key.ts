// Clave de acceso of an SRI electronic document (Ficha Técnica, esquema
// offline). 49 digits:
//
//   ddmmaaaa | codDoc(2) | RUC(13) | ambiente(1) | estab+ptoEmi(6)
//   | secuencial(9) | código numérico(8) | tipoEmisión(1) | DV(1)
//
// In the offline scheme the clave is also the número de autorización.

export type SriEnvironment = "PRUEBAS" | "PRODUCCION";

export type AccessKeyParts = {
  /** Calendar day as "yyyy-MM-dd". */
  issueDay: string;
  docType: string;
  ruc: string;
  environment: SriEnvironment;
  establishment: string;
  emissionPoint: string;
  sequential: string;
  numericCode: string;
  emissionType: string;
  checkDigit: number;
};

const KEY = /^\d{49}$/;

/** Módulo 11 with weights 2..7 from the right; 11 → 0 and 10 → 1. */
export function accessKeyCheckDigit(first48: string) {
  let sum = 0;
  let weight = 2;
  for (let i = first48.length - 1; i >= 0; i -= 1) {
    sum += Number(first48[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const digit = 11 - (sum % 11);
  if (digit === 11) return 0;
  if (digit === 10) return 1;
  return digit;
}

export function isValidAccessKey(value: string) {
  return KEY.test(value) && accessKeyCheckDigit(value.slice(0, 48)) === Number(value[48]);
}

/** Splits a clave into its parts, or null when it is malformed or its DV fails. */
export function parseAccessKey(value: string): AccessKeyParts | null {
  const key = value.trim();
  if (!isValidAccessKey(key)) return null;

  const dd = key.slice(0, 2);
  const mm = key.slice(2, 4);
  const yyyy = key.slice(4, 8);
  const env = key[23];
  if (env !== "1" && env !== "2") return null;

  return {
    issueDay: `${yyyy}-${mm}-${dd}`,
    docType: key.slice(8, 10),
    ruc: key.slice(10, 23),
    environment: env === "1" ? "PRUEBAS" : "PRODUCCION",
    establishment: key.slice(24, 27),
    emissionPoint: key.slice(27, 30),
    sequential: key.slice(30, 39),
    numericCode: key.slice(39, 47),
    emissionType: key[47],
    checkDigit: Number(key[48]),
  };
}

/** First 49-digit run with a valid DV inside free text (a RIDE's text, a paste). */
export function findAccessKey(text: string) {
  // A RIDE may wrap the clave over lines or space it out: join digit groups,
  // then slide over every run long enough to hold one.
  const joined = text.replace(/(\d)[\s-]+(?=\d)/g, "$1");
  for (const [run] of joined.matchAll(/\d{49,}/g)) {
    for (let i = 0; i + 49 <= run.length; i += 1) {
      const candidate = run.slice(i, i + 49);
      if (parseAccessKey(candidate)) return candidate;
    }
  }
  return null;
}

export type AccessKeyInput = {
  /** Calendar day "yyyy-MM-dd". */
  issueDay: string;
  docType: string;
  ruc: string;
  environment: SriEnvironment;
  establishment: string;
  emissionPoint: string;
  sequential: string | number;
  /** 8 digits chosen by the emitter. */
  numericCode: string;
  /** "1" = emisión normal, the only one the offline scheme uses. */
  emissionType?: string;
};

/** Builds the 49-digit clave with its check digit; throws on malformed parts. */
export function buildAccessKey(input: AccessKeyInput) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.issueDay);
  if (!day) throw new Error(`Fecha de emisión inválida: ${input.issueDay}`);
  const sequential = String(input.sequential).padStart(9, "0");
  const parts: [string, RegExp][] = [
    [`${day[3]}${day[2]}${day[1]}`, /^\d{8}$/],
    [input.docType, /^\d{2}$/],
    [input.ruc, /^\d{13}$/],
    [input.environment === "PRUEBAS" ? "1" : "2", /^[12]$/],
    [input.establishment, /^\d{3}$/],
    [input.emissionPoint, /^\d{3}$/],
    [sequential, /^\d{9}$/],
    [input.numericCode, /^\d{8}$/],
    [input.emissionType ?? "1", /^\d$/],
  ];
  for (const [value, shape] of parts) {
    if (!shape.test(value)) throw new Error(`Parte inválida de la clave de acceso: «${value}»`);
  }
  const first48 = parts.map(([value]) => value).join("");
  return `${first48}${accessKeyCheckDigit(first48)}`;
}
