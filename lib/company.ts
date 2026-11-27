// Issuer identity printed on receipts and account statements.
//
// Any field left null is simply not printed.

export const COMPANY = {
  brand: "VEEGSOFT",
  legalName: "CHRISTIAN SEBASTIAN VELEZ PALOMEQUE" as string | null,
  taxId: "0104885694001" as string | null,
  tagline: "Desarrollo de software a medida",
  address: "Cuenca - Ecuador" as string | null,
  phone: "096 000 4989" as string | null,
  email: "info@veegsoft.com",
  website: "veegsoft.com",
} as const;
