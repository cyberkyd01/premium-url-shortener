"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#84cc16", "#f97316", "#64748b", "#14b8a6"];

export function ClicksChart({ data, dataKey = "clicks", xKey = "date" }: { data: Record<string, unknown>[]; dataKey?: string; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={(v) => String(v).slice(5)} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey={dataKey} stroke="#6366f1" fill="url(#g)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, dataKey = "count", xKey = "label", height = 220 }: { data: Record<string, unknown>[]; dataKey?: string; xKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -20, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey={dataKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220 }: { data: { label: string; count: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopList({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  if (!data.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between"><span className="truncate max-w-[70%]">{d.label}</span><span className="text-muted">{d.count}</span></div>
          <div className="h-1.5 rounded bg-border mt-1"><div className="h-1.5 rounded bg-primary" style={{ width: `${total ? Math.round((d.count / total) * 100) : 0}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
