"use client";

import { useEffect, useRef, useState } from "react";

type FilterDashboardProps = {
  allYears: number[];
  years: number[];
  setYears: (years: number[]) => void;
  units: string[];
  unit: string;
  setUnit: (unit: string) => void;
  setRopn: (ropn: string) => void;
};

export default function FilterDashboard({
  allYears,
  years,
  setYears,
  units,
  unit,
  setUnit,
  setRopn,
}: FilterDashboardProps) {
  const [yearOpen, setYearOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target as Node)
      ) {
        setYearOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearYears = () => {
    setYears([]);
    setUnit("Semua Unit");
    setRopn("Semua ROPN");
    setYearOpen(false);
  };

  return (
    <section className={`filter-card ${yearOpen ? "year-filter-open" : ""}`}>
      <label className="filter-field">
        <span className="filter-label">
          <i className="bi bi-calendar3 me-1" />
          Tahun
        </span>

        <div
          className="dropdown year-dropdown-bootstrap"
          ref={yearDropdownRef}
        >
          <button
            type="button"
            className={`btn btn-light border dropdown-toggle w-100 text-start ${
              yearOpen ? "show" : ""
            }`}
            onClick={() => setYearOpen((value) => !value)}
            aria-expanded={yearOpen}
          >
            <span className="year-button-content">
              <i className="bi bi-calendar3 text-primary me-2" />

              {years.length > 0 ? (
                <span className="selected-years">
                  {years.map((year) => (
                    <span key={year} className="year-badge">
                      {year}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted">Pilih Tahun</span>
              )}
            </span>
          </button>

          <div
            className={`dropdown-menu w-100 p-0 ${yearOpen ? "show" : ""}`}
          >
            <div className="year-menu-header">
              <div>
                <div className="fw-semibold">Pilih Tahun</div>
                <small className="text-muted">Pilih satu atau lebih tahun</small>
              </div>

              {years.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger text-decoration-none"
                  onClick={clearYears}
                >
                  <i className="bi bi-x-circle me-1" />
                  Hapus
                </button>
              )}
            </div>

            <div className="year-menu-body">
              {allYears.map((year) => {
                const checked = years.includes(year);

                return (
                  <label
                    key={year}
                    className={`year-check-item ${checked ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? years.filter((value) => value !== year)
                          : [...years, year].sort((a, b) => a - b);

                        setYears(next);
                        setUnit("Semua Unit");
                        setRopn("Semua ROPN");
                      }}
                    />

                    <span className="year-check-label">
                      <span>{year}</span>
                      {checked && <i className="bi bi-check-lg text-primary" />}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="year-menu-footer">
              <span>
                <i className="bi bi-check2-square me-1" />
                {years.length} tahun dipilih
              </span>
            </div>
          </div>
        </div>
      </label>

      <label>
        Unit{" "}
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          disabled={!years.length}
        >
          {years.length ? (
            <>
              <option>Semua Unit</option>
              {units
                .filter((value) => value !== "#NA")
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </>
          ) : (
            <option>-- Pilih Tahun --</option>
          )}
        </select>
      </label>
    </section>
  );
}
