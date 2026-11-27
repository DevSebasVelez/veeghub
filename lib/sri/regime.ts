// Tax regime as the SRI electronic documents need it.
//
// The regime and IVA in force come from TaxProfile by issue date (plan §3.3),
// never from constants here: this file only knows how each regime is written
// in the XML (infoTributaria/contribuyenteRimpe, Ficha Técnica v2.34).

export const SRI_REGIMES = ["RIMPE_NEGOCIO_POPULAR", "RIMPE_EMPRENDEDOR", "GENERAL"] as const;
export type SriRegime = (typeof SRI_REGIMES)[number];

export const SRI_REGIME_LABELS: Record<SriRegime, string> = {
  RIMPE_NEGOCIO_POPULAR: "RIMPE · Negocio Popular",
  RIMPE_EMPRENDEDOR: "RIMPE · Emprendedor",
  GENERAL: "Régimen general",
};

/** contribuyenteRimpe legend; null means the node is left out (régimen general). */
export function rimpeLegend(regime: SriRegime): string | null {
  switch (regime) {
    case "RIMPE_NEGOCIO_POPULAR":
      return "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE";
    case "RIMPE_EMPRENDEDOR":
      return "CONTRIBUYENTE RÉGIMEN RIMPE";
    case "GENERAL":
      return null;
  }
}

export function isSriRegime(value: unknown): value is SriRegime {
  return typeof value === "string" && (SRI_REGIMES as readonly string[]).includes(value);
}
