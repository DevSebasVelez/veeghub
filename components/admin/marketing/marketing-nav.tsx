"use client";

import { usePathname } from "next/navigation";

import { AreaNav } from "@/components/admin/area-nav";

// Only the sections that exist. Ideas, generador, creativos and métricas join
// as their phases land (F2, F4, F5, F7).
const SECTIONS = [
  { key: "calendario", label: "Calendario", href: "/admin/marketing/calendario" },
  { key: "biblioteca", label: "Biblioteca", href: "/admin/marketing/biblioteca" },
  { key: "directrices", label: "Directrices", href: "/admin/marketing/directrices" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const active =
    SECTIONS.find((section) => pathname.startsWith(section.href))?.key ?? "calendario";

  return <AreaNav items={SECTIONS} active={active} />;
}
