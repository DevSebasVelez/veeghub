import Link from "next/link";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "hitos", label: "Hitos", href: "/admin/finanzas" },
  { key: "pagos", label: "Pagos", href: "/admin/finanzas?section=pagos" },
  { key: "resumen", label: "Resumen", href: "/admin/finanzas/resumen" },
  { key: "impuestos", label: "Impuestos", href: "/admin/finanzas/impuestos" },
];

export function FinanceTabs({ active }: { active: string }) {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border bg-background p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            tab.key === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
