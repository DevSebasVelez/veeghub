"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

const compactCurrency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const config = {
  spend: { label: "Gasto", color: "#2563eb" },
  leads: { label: "Leads", color: "#10b981" },
} satisfies ChartConfig;

export function SpendVsLeadsChart({
  data,
}: {
  data: Array<{ day: string; label: string; spend: number; leads: number }>;
}) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Todavía no hay gasto ni leads en este período.
      </p>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="h-56 w-full aspect-auto md:h-72"
    >
      <ComposedChart data={data} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="spend"
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => compactCurrency.format(Number(v))}
        />
        <YAxis
          yAxisId="leads"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-32 items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {name === "spend"
                      ? currency.format(Number(value))
                      : Number(value)}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="spend"
          dataKey="spend"
          fill="var(--color-spend)"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="leads"
          type="monotone"
          dataKey="leads"
          stroke="var(--color-leads)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
