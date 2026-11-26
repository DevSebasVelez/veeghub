"use client";

import { usePathname } from "next/navigation";
import { BookOpenText, CalendarDays, Images, Lightbulb } from "lucide-react";

import { AreaNav } from "@/components/admin/area-nav";

// Only the sections that exist. Generador, creativos and métricas join as
// their phases land (F4, F5, F7). Each keeps its tone across the module.
const SECTIONS = [
  { key: "calendario", label: "Calendario", href: "/admin/marketing/calendario", icon: CalendarDays, iconClassName: "text-blue-500" },
  { key: "ideas", label: "Ideas", href: "/admin/marketing/ideas", icon: Lightbulb, iconClassName: "text-amber-500" },
  { key: "biblioteca", label: "Biblioteca", href: "/admin/marketing/biblioteca", icon: Images, iconClassName: "text-pink-500" },
  { key: "directrices", label: "Directrices", href: "/admin/marketing/directrices", icon: BookOpenText, iconClassName: "text-teal-500" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const active =
    SECTIONS.find((section) => pathname.startsWith(section.href))?.key ?? "calendario";

  return <AreaNav items={SECTIONS} active={active} />;
}
