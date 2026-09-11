import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ANGGARAN,
  avg,
  KINERJA,
  lightenColor,
  Row,
  shortName,
  TW,
} from "../../../../lib/ropn-dashboard";

type DetailChartProps = {
  name: string;
  rows: Row[];
  year: number;
  color: string;
};

export default function DetailChart({
  name,
  rows,
  year,
  color,
}: DetailChartProps) {
  const anggaranColor = lightenColor(color, 0.55);
  const gradientId = `detail-${year}-${name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
  const data = TW.map((tw) => ({
    tw,
    kinerja: avg(rows, KINERJA, tw),
    anggaran: avg(rows, ANGGARAN, tw),
  }));

  return (
    <section className="detail-card">
      <h3>{shortName(name, 45)}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 24, right: 10, left: -6, bottom: 0 }} barGap={4}>
          <defs>
            <linearGradient id={`${gradientId}-k`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id={`${gradientId}-a`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={anggaranColor} />
              <stop offset="100%" stopColor={anggaranColor} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf2f7" strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey="tw" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#7b8794" }} />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 9, fill: "#8b96a3" }}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "rgba(47,128,237,.045)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 32px rgba(15,23,42,.12)",
              fontSize: 12,
            }}
            formatter={(value: any) => `${Number(value).toFixed(1)}%`}
          />
          <Bar
            dataKey="kinerja"
            name={`Kinerja ${year}`}
            fill={`url(#${gradientId}-k)`}
            radius={[7, 7, 2, 2]}
            maxBarSize={28}
            animationDuration={800}
            animationEasing="ease-out"
            label={{
              position: "top",
              fontSize: 9,
              fill: "#64748b",
              formatter: (value: any) => `${Number(value).toFixed(0)}%`,
            }}
          />
          <Bar
            dataKey="anggaran"
            name={`Anggaran ${year}`}
            fill={`url(#${gradientId}-a)`}
            radius={[7, 7, 2, 2]}
            maxBarSize={28}
            animationDuration={950}
            animationEasing="ease-out"
            label={{
              position: "top",
              fontSize: 9,
              fill: "#64748b",
              formatter: (value: any) => `${Number(value).toFixed(0)}%`,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
