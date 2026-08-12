"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoneyCompact } from "@/lib/currency";

// Legend text wears an ink token (never the series color), per the dataviz rule.
const legendStyle = { fontSize: 12, color: "var(--ink-muted)" } as const;

export function PLTrendChart({
  data,
  currency,
}: {
  data: { key: string; revenue: number; expenses: number; net: number }[];
  currency: string;
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="key" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} />
        <YAxis tick={{ fontSize: 12, fill: "var(--ink-muted)" }} tickFormatter={(v) => formatMoneyCompact(v, currency)} width={64} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => formatMoneyCompact(v, currency)}
          contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
        />
        {/* A legend is mandatory once there are 2+ series — identity must not rest
            on color alone. Colors use the theme-adaptive --dc-* semantic tokens so
            they stay legible in both light and dark (the old #34d399/#f87171/gold
            hexes washed out on the light theme). */}
        <Legend wrapperStyle={legendStyle} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--dc-good)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--dc-crit)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="net" name="Net" stroke="var(--dc-accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
