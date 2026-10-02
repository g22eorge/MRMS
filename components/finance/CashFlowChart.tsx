"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney, formatMoneyCompact } from "@/lib/currency";

const legendStyle = { fontSize: 12, color: "var(--ink-muted)" } as const;
const tooltipStyle = {
  backgroundColor: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--ink)",
} as const;

export type CashFlowPoint = {
  key: string;
  label: string;
  title: string;
  range: string;
  inflow: number;
  outflow: number;
  net: number;
};

function CashFlowTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as CashFlowPoint | undefined;
  if (!point) return null;
  const rows = [
    { label: "In", value: point.inflow, dot: "var(--accent)" },
    { label: "Out", value: point.outflow, dot: "#f87171" },
    { label: "Net", value: point.net, dot: "var(--ink)" },
  ];
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 700, marginBottom: 2 }}>{point.title}</p>
      <p style={{ color: "var(--ink-muted)", fontSize: 11, marginBottom: 6 }}>{point.range}</p>
      {rows.map((r) => (
        <p key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontVariantNumeric: "tabular-nums" } as CSSProperties}>
          <span style={{ height: 8, width: 8, borderRadius: 9999, background: r.dot, display: "inline-block" }} />
          <span style={{ color: "var(--ink-muted)" }}>{r.label}</span>
          <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 600 }}>{formatMoney(r.value, currency)}</span>
        </p>
      ))}
    </div>
  );
}

export function CashFlowChart({
  data,
  currency,
}: {
  data: CashFlowPoint[];
  currency: string;
}) {
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  if (data.length === 0) return null;
  if (!mounted) {
    return <div className="h-64 w-full animate-pulse rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]" />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="cashInArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={{ stroke: "var(--line)" }}
            tickFormatter={(v) => formatMoneyCompact(Number(v), currency).replace(`${currency} `, "")}
            width={64}
          />
          <Tooltip
            content={<CashFlowTooltip currency={currency} />}
            cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Area
            type="monotone"
            dataKey="inflow"
            name="In"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill="url(#cashInArea)"
            dot={{ fill: "var(--accent)", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Bar dataKey="outflow" name="Out" fill="#f87171" fillOpacity={0.65} radius={[4, 4, 0, 0]} barSize={18} />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="var(--ink)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            dot={{ fill: "var(--ink)", strokeWidth: 0, r: 2.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-[0.6875rem] text-[var(--ink-muted)]">Hover or tap a period for exact figures</p>
    </div>
  );
}
