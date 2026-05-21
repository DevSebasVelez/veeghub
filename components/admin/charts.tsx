"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const billingConfig = {
  invoiced: { label: "Facturado", color: "#2563eb" },
  collected: { label: "Cobrado", color: "#10b981" },
  pending: { label: "Pendiente", color: "#f59e0b" },
} satisfies ChartConfig;

const cashFlowConfig = {
  collected: { label: "Cobrado", color: "#10b981" },
  pending: { label: "Por cobrar", color: "#f59e0b" },
} satisfies ChartConfig;

export function MonthlyBillingChart({
  data,
}: {
  data: Array<{
    month: string;
    invoiced: number;
    collected: number;
    pending: number;
  }>;
}) {
  return (
    <ChartContainer config={billingConfig} className="h-72 w-full aspect-auto">
      <BarChart data={data} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => compactCurrency.format(Number(v))}
          width={52}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-36 items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {billingConfig[name as keyof typeof billingConfig]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {currency.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="invoiced"
          fill="var(--color-invoiced)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="collected"
          fill="var(--color-collected)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="pending"
          fill="var(--color-pending)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function CashFlowChart({
  data,
}: {
  data: Array<{ month: string; collected: number; pending: number }>;
}) {
  return (
    <ChartContainer config={cashFlowConfig} className="h-72 w-full aspect-auto">
      <AreaChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => compactCurrency.format(Number(v))}
          width={52}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-36 items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {cashFlowConfig[name as keyof typeof cashFlowConfig]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {currency.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="collected"
          stroke="var(--color-collected)"
          fill="var(--color-collected)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="pending"
          stroke="var(--color-pending)"
          fill="var(--color-pending)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
