"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Cash in vs cash out per month. Blue/orange are categorical slots 1 and 2 of
// the validated reference palette (light and dark steps both pass the CVD,
// contrast and lightness checks against the card surfaces). They are
// identities, not good/bad status colors.
const config = {
  cobrado: {
    label: "Cobrado",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
  pagado: {
    label: "Pagado",
    theme: { light: "#eb6834", dark: "#d95926" },
  },
} satisfies ChartConfig;

const currency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

const compact = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type MoneyFlowPoint = {
  key: string;
  label: string;
  cobrado: number;
  pagado: number;
};

/**
 * Grouped columns, one pair per month. The selected month stays at full
 * strength and the rest step back, so the eye lands on the month the page is
 * about while the trend stays readable.
 */
export function MoneyFlowChart({
  data,
  selected,
}: {
  data: MoneyFlowPoint[];
  selected: string;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => compact.format(Number(v))}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) => (
                <div className="flex min-w-36 items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {currency.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {(["cobrado", "pagado"] as const).map((series) => (
          <Bar
            key={series}
            dataKey={series}
            fill={`var(--color-${series})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          >
            {data.map((point) => (
              <Cell
                key={point.key}
                fillOpacity={point.key === selected ? 1 : 0.35}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}
