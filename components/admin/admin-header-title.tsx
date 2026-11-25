"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { activeNavItem } from "@/components/admin/nav-config";

/** «Sección › Página» in the top bar, so you always know where you are. */
export function AdminHeaderTitle() {
  const item = activeNavItem(usePathname());

  if (!item) return <span className="text-sm font-medium">Panel administrativo</span>;

  return (
    <nav aria-label="Ubicación" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{item.section.label}</span>
      <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" aria-hidden="true" />
      <span className="truncate font-medium" aria-current="page">
        {item.label}
      </span>
    </nav>
  );
}
