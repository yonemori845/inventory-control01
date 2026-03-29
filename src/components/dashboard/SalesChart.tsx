"use client";

import { formatYen } from "@/lib/pricing";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DailyPoint = { date: string; sales: number };

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { value?: number }[];
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-card">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {formatYen(v)}
      </p>
      <p className="text-[10px] text-neutral-400">税込・日次</p>
    </div>
  );
}

export function SalesChart({ data }: { data: DailyPoint[] }) {
  const gid = useId().replace(/:/g, "");

  if (data.length === 0) {
    return (
      <p className="py-14 text-center text-sm text-neutral-500">
        期間内に注文がありません。
      </p>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-area-top)" />
              <stop offset="100%" stopColor="var(--chart-area-bottom)" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--foreground)", opacity: 0.45 }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--foreground)", opacity: 0.45 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "4 4" }} />
          <Area
            type="natural"
            dataKey="sales"
            stroke="var(--chart-line)"
            strokeWidth={1.75}
            fill={`url(#area-${gid})`}
            dot={false}
            activeDot={{ r: 3, fill: "var(--chart-line)", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
