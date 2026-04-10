"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ReportsCharts({
  statusData,
  deviceData,
}: {
  statusData: { name: string; value: number }[];
  deviceData: { name: string; value: number }[];
}) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setShouldRender(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel-shadow h-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--ink-muted)]">Jobs by Status</p>
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e8" />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#000000" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="panel-shadow h-72 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--ink-muted)]">Repairs by Device Type</p>
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
          <PieChart>
            <Pie data={deviceData} dataKey="value" nameKey="name" outerRadius={90}>
              {deviceData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={["#0f766e", "#0369a1", "#047857", "#0891b2", "#0284c7", "#0d9488"][index % 6]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
