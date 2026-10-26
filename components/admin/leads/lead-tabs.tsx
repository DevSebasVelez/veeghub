"use client";

import { useState } from "react";

import { AreaNavButtons } from "@/components/admin/area-nav";

export type LeadTab = {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
};

/**
 * Conversación, actividad y notas en pestañas: antes eran tarjetas apiladas y
 * la actividad —donde se registra el trabajo— quedaba al fondo de la página.
 */
export function LeadTabs({
  tabs,
  initial,
}: {
  tabs: LeadTab[];
  initial?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <AreaNavButtons
        items={tabs.map(({ key, label, count }) => ({ key, label, count }))}
        active={current?.key ?? ""}
        onSelect={setActive}
        className="px-5 pt-3"
      />
      <div className="p-5">{current?.content}</div>
    </section>
  );
}
