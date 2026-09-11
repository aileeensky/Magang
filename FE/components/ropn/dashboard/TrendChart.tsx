"use client";

import React from "react";
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
import { COLORS } from "../../../lib/ropn-dashboard";
import ChartTip from "./charts/ChartTip";

type TrendChartProps = {
  years: number[];
  trend: { kinerja: boolean; anggaran: boolean };
  setTrend: React.Dispatch<
    React.SetStateAction<{ kinerja: boolean; anggaran: boolean }>
  >;
  trendData: any[];
};

export default function TrendChart({
  years,
  trend,
  setTrend,
  trendData,
}: TrendChartProps) {
  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <b>Grafik ROPN</b>
        <div className="toggles">
          <button
            className={trend.kinerja ? "active" : ""}
            onClick={() =>
              setTrend((value) => ({ ...value, kinerja: !value.kinerja }))
            }
          >
            Kinerja
          </button>
          <button
            className={trend.anggaran ? "active" : ""}
            onClick={() =>
              setTrend((value) => ({ ...value, anggaran: !value.anggaran }))
            }
          >
            Anggaran
          </button>
        </div>
      </div>

      <div className="chart trend-chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData} margin={{ top: 10, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#e8eef5" strokeDasharray="4 6" vertical={false} />
            <XAxis
              dataKey="period"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#7b8794" }}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 10, fill: "#8b96a3" }}
              width={42}
            />
            <Tooltip content={<ChartTip />} cursor={{ stroke: "#cbd8e6", strokeDasharray: "4 4" }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "14px" }}
            />

            {years.map((year, index) => {
              const color = COLORS[index % COLORS.length];

              return (
                <React.Fragment key={year}>
                  {trend.kinerja && (
                    <Line
                      type="monotone"
                      dataKey={`kinerja_${year}`}
                      name={`Kinerja ${year}`}
                      stroke={color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={{ r: 3.5, fill: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6, strokeWidth: 3, fill: "#fff" }}
                      animationDuration={850}
                      animationEasing="ease-out"
                    />
                  )}
                  {trend.anggaran && (
                    <Line
                      type="monotone"
                      dataKey={`anggaran_${year}`}
                      name={`Anggaran ${year}`}
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="8 7"
                      strokeOpacity={0.58}
                      dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 5.5, strokeWidth: 3, fill: "#fff" }}
                      animationDuration={950}
                      animationEasing="ease-out"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
