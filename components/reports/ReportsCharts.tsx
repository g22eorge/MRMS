"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ReportsCharts({
  statusData,
  deviceData,
  from,
  to,
}: {
  statusData: { key?: string; name: string; value: number }[];
  deviceData: { key?: string; name: string; value: number }[];
  from?: string;
  to?: string;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setShouldRender(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const rangeSuffix = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `&${qs}` : "";
  }, [from, to]);

  const tooltipStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    borderRadius: 10,
    fontSize: 12,
  } as const;

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel-shadow h-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--ink-muted)]">Jobs by Status</p>
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
          <BarChart
            data={statusData}
            margin={{ top: 8, right: 12, left: 0, bottom: 44 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={-25}
              height={54}
              textAnchor="end"
              tick={{ fontSize: 11, fill: "#111111" }}
            />
            <YAxis tick={{ fontSize: 11, fill: "#111111" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="value"
              fill="#D4AF37"
              radius={[6, 6, 0, 0]}
              cursor="pointer"
              onClick={(_, index) => {
                const item = statusData[index];
                if (!item?.key) return;
                router.push(`/jobs?status=${encodeURIComponent(item.key)}${rangeSuffix}`);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-[var(--ink-muted)]">Tip: click a bar to open the matching jobs.</p>
      </div>
      <div className="panel-shadow h-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--ink-muted)]">Repairs by Device Type</p>
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
          <PieChart>
            <Pie data={deviceData} dataKey="value" nameKey="name" outerRadius={90}>
              {deviceData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={["#000000", "#D4AF37", "#666666", "#000000", "#D4AF37", "#666666"][index % 6]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
