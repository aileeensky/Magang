"use client";

import { useEffect, useMemo, useState } from "react";
import DetailRopn from "./dashboard/DetailRopn";
import ExecutiveSummary from "./dashboard/ExecutiveSummary";
import FilterDashboard from "./dashboard/FilterDashboard";
import ManagementSummary from "./dashboard/ManagementSummary";
import RankingSection from "./dashboard/RankingSection";
import SectionTitle from "./dashboard/SectionTitle";
import TrendChart from "./dashboard/TrendChart";
import {
  avg,
  cleanRows,
  KINERJA,
  ANGGARAN,
  latestPeriod,
  measurementTW,
  Row,
  shortName,
  TW,
} from "../../lib/ropn-dashboard";

export default function RopnDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [unit, setUnit] = useState("Semua Unit");
  const [ropn, setRopn] = useState("Semua ROPN");
  const [trend, setTrend] = useState({ kinerja: true, anggaran: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/ropn-data.json", { cache: "no-store" });
        if (!response.ok) throw new Error("File data ROPN tidak dapat dimuat.");
        const data = await response.json();
        if (mounted) {
          const cleaned = cleanRows(data);
          setRows(cleaned);
          const availableYears = Array.from(
            new Set(cleaned.map((row) => row.Tahun)),
          ).sort((a, b) => a - b);
          if (availableYears.length)
            setYears([availableYears[availableYears.length - 1]]);
        }
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Gagal memuat data ROPN.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const allYears = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.Tahun))).sort((a, b) => a - b),
    [rows],
  );
  const units = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((row) => years.includes(row.Tahun))
            .map((row) => row.Unit),
        ),
      ).sort(),
    [rows, years],
  );
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          years.includes(row.Tahun) &&
          (unit === "Semua Unit" || row.Unit === unit),
      ),
    [rows, years, unit],
  );
  const ropns = useMemo(
    () => Array.from(new Set(filtered.map((row) => row.ROPN))).sort(),
    [filtered],
  );
  const detailRows = useMemo(
    () => filtered.filter((row) => ropn === "Semua ROPN" || row.ROPN === ropn),
    [filtered, ropn],
  );
  const period = latestPeriod(years);
  const activeYear = years.length ? Math.max(...years) : null;
  const kpis = useMemo(
    () =>
      years.map((year) => {
        const data = filtered.filter((row) => row.Tahun === year);
        const tw = measurementTW(year);
        return {
          y: year,
          tw,
          ropn: new Set(data.map((row) => row.ROPN)).size,
          kinerja: avg(data, KINERJA, tw),
          anggaran: avg(data, ANGGARAN, tw),
        };
      }),
    [years, filtered],
  );
  const trendData = useMemo(
    () =>
      TW.map((tw) => {
        const point: Record<string, string | number> = { period: tw };
        years.forEach((year) => {
          const data = filtered.filter((row) => row.Tahun === year);
          point[`kinerja_${year}`] = avg(data, KINERJA, tw);
          point[`anggaran_${year}`] = avg(data, ANGGARAN, tw);
        });
        return point;
      }),
    [years, filtered],
  );
  const rank = (jenis: string) => {
    const data = filtered.filter((row) => row.Tahun === activeYear);
    return Array.from(new Set(data.map((row) => row.ROPN)))
      .map((name) => ({
        name: shortName(name),
        full: name,
        value: avg(
          data.filter((row) => row.ROPN === name),
          jenis,
          period,
        ),
      }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 5);
  };

  if (loading)
    return (
      <div className="ropn-loading">
        <div className="loading">Memuat data ROPN...</div>
      </div>
    );
  if (error)
    return (
      <div className="ropn-error">
        <i className="bi bi-exclamation-triangle" />
        <b>Data ROPN belum dapat dimuat</b>
        <span>{error}</span>
      </div>
    );

  return (
    <div className="ropn-dashboard">
      <SectionTitle>🔎 Filter Dashboard</SectionTitle>
      <FilterDashboard
        allYears={allYears}
        years={years}
        setYears={setYears}
        units={units}
        unit={unit}
        setUnit={setUnit}
        setRopn={setRopn}
      />
      {!years.length ? (
        <div className="empty">👆 Pilih tahun untuk menampilkan dashboard.</div>
      ) : !filtered.length ? (
        <div className="empty">
          ⚠️ Tidak terdapat data untuk filter yang dipilih.
        </div>
      ) : (
        <>
          <SectionTitle>📌 Ringkasan Eksekutif</SectionTitle>
          <ExecutiveSummary kpis={kpis} />
          <SectionTitle>📈 Analisis Tahun Terpilih</SectionTitle>
          <TrendChart
            years={years}
            trend={trend}
            setTrend={setTrend}
            trendData={trendData}
          />
          <RankingSection
            period={period}
            lowK={rank(KINERJA)}
            lowA={rank(ANGGARAN)}
          />
          <DetailRopn
            years={years}
            ropns={ropns}
            ropn={ropn}
            setRopn={setRopn}
            detailRows={detailRows}
          />
          <ManagementSummary kpis={kpis} />
        </>
      )}
    </div>
  );
}
