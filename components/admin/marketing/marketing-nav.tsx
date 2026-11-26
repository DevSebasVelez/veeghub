"use client";

import { usePathname } from "next/navigation";

import { AreaNav } from "@/components/admin/area-nav";

// Only the sections that exist. Generador, creativos and métricas join as
// their phases land (F4, F5, F7).
const SECTIONS = [
  { key: "calendario", label: "Calendario", href: "/admin/marketing/calendario" },
  { key: "ideas", label: "Ideas", href: "/admin/marketing/ideas" },
  { key: "biblioteca", label: "Biblioteca", href: "/admin/marketing/biblioteca" },
  { key: "directrices", label: "Directrices", href: "/admin/marketing/directrices" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const active =
    SECTIONS.find((section) => pathname.startsWith(section.href))?.key ?? "calendario";

  return <AreaNav items={SECTIONS} active={active} />;
}
