"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { AreaNav } from "@/components/admin/area-nav";

const SECTIONS = [
  { key: "resumen", label: "Resumen", href: "/admin/campanas" },
  { key: "mensual", label: "Mes a mes", href: "/admin/campanas/mensual" },
  { key: "anuncios", label: "Anuncios", href: "/admin/campanas/anuncios" },
  { key: "audiencia", label: "Audiencia", href: "/admin/campanas/audiencia" },
];

/** Keeps the selected period when switching sections; hidden on a campaign's page. */
export function CampaignsNav({ alerts }: { alerts: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const section = SECTIONS.find((item) => item.href !== "/admin/campanas" && pathname.startsWith(item.href));
  if (!section && pathname !== "/admin/campanas") return null;

  const keep = new URLSearchParams();
  for (const key of ["dias", "mes", "desde", "hasta"]) {
    const value = params.get(key);
    if (value) keep.set(key, value);
  }
  const query = keep.toString();

  return (
    <AreaNav
      className="mb-0"
      active={section?.key ?? "resumen"}
      items={SECTIONS.map((item) => ({
        ...item,
        href: query ? `${item.href}?${query}` : item.href,
        count: item.key === "resumen" ? alerts : undefined,
      }))}
    />
  );
}
