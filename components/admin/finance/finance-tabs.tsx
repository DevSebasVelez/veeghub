import { AreaNav } from "@/components/admin/area-nav";

// Hitos and Pagos are sections of /admin/finanzas; Resumen and Impuestos are
// their own routes. All of them are plain links, so each view keeps its URL.
const ITEMS = [
  { key: "hitos", label: "Hitos", href: "/admin/finanzas" },
  { key: "pagos", label: "Pagos", href: "/admin/finanzas?section=pagos" },
  { key: "resumen", label: "Resumen", href: "/admin/finanzas/resumen" },
  { key: "impuestos", label: "Impuestos", href: "/admin/finanzas/impuestos" },
];

export function FinanceTabs({ active }: { active: string }) {
  return <AreaNav items={ITEMS} active={active} />;
}
