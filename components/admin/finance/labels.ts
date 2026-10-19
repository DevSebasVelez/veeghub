// Display labels for the expense / tax enums. Classifications are what the
// user decides from the documentation; none of them implies a legal status.

export const PAYEE_KIND_LABELS: Record<string, string> = {
  COLLABORATOR: "Colaborador",
  SUPPLIER: "Proveedor",
  EMPLOYEE: "Empleado",
  OTHER: "Otro",
};

export const TAX_TREATMENT_LABELS: Record<string, string> = {
  UNCLASSIFIED: "Sin clasificar",
  DEDUCTIBLE: "Deducible",
  NON_DEDUCTIBLE: "No deducible",
  UNDETERMINED: "Por determinar",
};

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
};

export const WITHHOLDING_KIND_LABELS: Record<string, string> = {
  VAT: "Retención de IVA",
  INCOME: "Retención de Renta",
};

export function labelOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
