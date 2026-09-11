"use client";

import { Dispatch, SetStateAction } from "react";
import { COLORS, Row } from "../../../lib/ropn-dashboard";
import DetailChart from "./charts/DetailChart";
import SectionTitle from "./SectionTitle";

type DetailRopnProps = {
  years: number[];
  ropns: string[];
  ropn: string;
  setRopn: Dispatch<SetStateAction<string>>;
  detailRows: Row[];
};

export default function DetailRopn({
  years,
  ropns,
  ropn,
  setRopn,
  detailRows,
}: DetailRopnProps) {
  return (
    <div id="detail-ropn">
      <SectionTitle>🔎 Detail ROPN</SectionTitle>

      <label className="inline-label">
        Pilih ROPN
        <select value={ropn} onChange={(event) => setRopn(event.target.value)}>
          <option>Semua ROPN</option>
          {ropns.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>

      {years.map((year, yearIndex) => (
        <div key={year} className="detail-year">
          <div className="year-label">Tahun {year}</div>
          <div className="detail-grid">
            {ropns
              .filter((name) => ropn === "Semua ROPN" || name === ropn)
              .filter((name) =>
                detailRows.some(
                  (row) => row.Tahun === year && row.ROPN === name,
                ),
              )
              .map((name) => (
                <DetailChart
                  key={`${name}-${year}`}
                  name={name}
                  rows={detailRows.filter(
                    (row) => row.Tahun === year && row.ROPN === name,
                  )}
                  year={year}
                  color={COLORS[yearIndex % COLORS.length]}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
