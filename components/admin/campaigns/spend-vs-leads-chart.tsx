"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const compactCurrency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

// Spend in the accent (indigo), results in their meaning: leads emerald,
// WhatsApp/Messenger conversations sky.
const config = {
  spend: { label: "Gasto", color: "#6366f1" },
  leads: { label: "Leads", color: "#10b981" },
  conversations: { label: "Conversaciones", color: "#0ea5e9" },
} satisfies ChartConfig;

export type SpendPoint = { label: string; spend: number; leads: number; conversations?: number };

export function SpendVsLeadsChart({ data, className }: { data: SpendPoint[]; className?: string }) {
  const hasSpend = data.some((point) => point.spend > 0 || point.leads > 0);
  if (!hasSpend) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Sin gasto ni leads en este período. Elige otro rango o toca «Actualizar».
      </p>
    );
  }
  const showConversations = data.some((point) => (point.conversations ?? 0) > 0);

  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-56 w-full md:h-72"}>
      <ComposedChart data={data} barGap={2} margin={{ left: 0, right: 0, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis yAxisId="spend" tickLine={false} axisLine={false} width={52} tickFormatter={(v) => compactCurrency.format(Number(v))} />
        <YAxis yAxisId="leads" orientation="right" tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-36 items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: `var(--color-${String(name)})` }} />
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {name === "spend" ? currency.format(Number(value)) : Number(value)}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="spend" dataKey="spend" fill="var(--color-spend)" fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={36} />
        <Line yAxisId="leads" type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2.5} dot={{ r: 3 }} />
        {showConversations ? (
          <Line yAxisId="leads" type="monotone" dataKey="conversations" stroke="var(--color-conversations)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
