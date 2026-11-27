import { COMPANY } from "@/lib/company";

// The emitter exactly as the SRI has it in the RUC (infoTributaria). Note the
// SRI writes the name surnames-first, unlike COMPANY.legalName on receipts.
// Regime and IVA are NOT here: they come from TaxProfile by issue date.

export type SriEmitter = {
  ruc: string;
  legalName: string;
  tradeName: string | null;
  /** dirMatriz. */
  headOfficeAddress: string;
  /** obligadoContabilidad. */
  keepsAccounting: boolean;
};

export const SRI_EMITTER: SriEmitter = {
  ruc: COMPANY.taxId ?? "",
  legalName: "VELEZ PALOMEQUE CHRISTIAN SEBASTIAN",
  tradeName: "VEEGSOFT",
  headOfficeAddress:
    "Barrio: LA FLORIDA Calle: RAFAEL AGUILAR Numero: SN Interseccion: ISAURO RODRIGUEZ",
  keepsAccounting: false,
};
