import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RankChartProps = {
  title: string;
  data: any[];
};

export default function RankChart({ title, data }: RankChartProps) {
  return (
    <section className="panel rank-panel">
      <h3 className="rank-title">{title}</h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, left: 8, right: 38, bottom: 4 }}
            barCategoryGap={12}
          >
            <defs>
              <linearGradient id="rankBarGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f8ff7" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#edf2f7" strokeDasharray="4 6" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 9, fill: "#8b96a3" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={95}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9.5, fill: "#64748b" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(47,128,237,.05)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 32px rgba(15,23,42,.12)",
                fontSize: 12,
              }}
              formatter={(value: any) => [
                `${Number(value).toFixed(1)}%`,
                "Nilai",
              ]}
            />
            <Bar
              dataKey="value"
              fill="url(#rankBarGradient)"
              radius={[0, 8, 8, 0]}
              maxBarSize={20}
              animationDuration={800}
              animationEasing="ease-out"
              label={{
                position: "right",
                fontSize: 10,
                fill: "#475569",
                formatter: (value: any) => `${Number(value).toFixed(1)}%`,
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} className="rank-bar-cell" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
