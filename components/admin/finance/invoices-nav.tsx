import { AreaNav } from "@/components/admin/area-nav";

/** Sections of Facturas: the invoices and the catalogue they reuse. */
export function InvoicesNav({ active, catalogCount }: { active: "facturas" | "catalogo"; catalogCount?: number }) {
  return (
    <AreaNav
      active={active}
      items={[
        { key: "facturas", label: "Facturas", href: "/admin/facturas" },
        { key: "catalogo", label: "Productos y servicios", count: catalogCount, href: "/admin/facturas/catalogo" },
      ]}
    />
  );
}
