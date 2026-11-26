"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Line, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const config = {
  spend: { label: "Gasto", color: "#6366f1" },
  leads: { label: "Leads", color: "#10b981" },
  cpl: { label: "Costo por lead", color: "#f59e0b" },
} satisfies ChartConfig;

export function MonthlyChart({ data }: { data: Array<{ label: string; spend: number; leads: number; cpl: number | null }> }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full md:h-80">
      <ComposedChart data={data} margin={{ top: 20, left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis yAxisId="spend" tickLine={false} axisLine={false} width={52} tickFormatter={(v) => currency.format(Number(v))} />
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
                    {name === "leads" ? Number(value) : value == null ? "—" : `$${Number(value).toFixed(2)}`}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="spend" dataKey="spend" fill="var(--color-spend)" fillOpacity={0.85} radius={[8, 8, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="spend" position="top" className="fill-muted-foreground text-[10px]" formatter={(v: unknown) => (Number(v) ? currency.format(Number(v)) : "")} />
        </Bar>
        <Line yAxisId="leads" type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2.5} dot={{ r: 4 }} />
        <Line yAxisId="spend" type="monotone" dataKey="cpl" stroke="var(--color-cpl)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ChartContainer>
  );
}
