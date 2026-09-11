"use client";

import { useMemo, useState } from "react";
import type { AuthUser, Iku, Org, StrategicObjective } from "../../../types";
import { Card, Field, PageTitle, DataTable } from "../../ui";
import MathField from "../../ui/MathField";

const num = (v: any) =>
  v === "" || v === null || v === undefined ? null : Number(v);
const annual = (mode: string, f: any) => {
  const a = [
    num(f.target_tw1),
    num(f.target_tw2),
    num(f.target_tw3),
    num(f.target_tw4),
  ];
  if (mode === "SUM")
    return a.reduce((x, v) => x + (Number.isFinite(v) ? v : 0), 0);
  if (mode === "AVERAGE")
    return a.reduce((x, v) => x + (Number.isFinite(v) ? v : 0), 0) / 4;
  return a[3];
};
const fmt = (v: any) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toString();
const fmtTargetInput = (v: any) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toString();

const organizationLevelKey = (v: any) =>
  String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

const findUke1 = (organizationId: string, organizations: Org[]) => {
  if (!organizationId) return null;
  const byId = new Map(organizations.map((o) => [o.organization_id, o]));
  let current = byId.get(organizationId);
  const visited = new Set<string>();
  while (current && !visited.has(current.organization_id)) {
    visited.add(current.organization_id);
    if (
      ["UKE1", "UKEI"].includes(
        organizationLevelKey(current.organization_level),
      )
    )
      return current;
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return null;
};

export default function IkuPage({
  user,
  orgs,
  strategicObjectives,
  form,
  setForm,
  data,
  create,
  updateStatus,
  submitSelected,
  update,
  remove,
}: {
  user: AuthUser;
  orgs: Org[];
  strategicObjectives: StrategicObjective[];
  form: any;
  setForm: (x: any) => void;
  data: Iku[];
  create: () => void;
  updateStatus: (id: string, status: string, notes?: string) => void;
  submitSelected: (ids: string[]) => void;
  update: (id: string, body: any) => void;
  remove: (id: string) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [ssOpen, setSsOpen] = useState(false);
  const [ssQuery, setSsQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [detail, setDetail] = useState<Iku | null>(null),
    [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const roles = new Set(
    (user.roles || []).map((r) =>
      String(r.role_code || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_"),
    ),
  );
  const roleNames = new Set(
    (user.roles || []).map((r) =>
      String(r.role_name || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const hasRole = (code: string, name: string) =>
    roles.has(code) || roleNames.has(name.toLowerCase());
  const manager = hasRole("MANAJER_KINERJA", "Manajer Kinerja"),
    bidang =
      hasRole(
        "BIDANG_KINERJA_RISIKO",
        "Bidang Pengelolaan Kinerja dan Risiko",
      ) || hasRole("BIDANG_RENSTRA", "Bidang Perencanaan Strategis"),
    pimpinan = hasRole("PIMPINAN_UNIT", "Pimpinan Unit");
  const bidangRenstra = hasRole(
    "BIDANG_RENSTRA",
    "Bidang Perencanaan Strategis",
  );
  const filtered = data.filter(
    (x) =>
      (!year || String(x.year) === year) &&
      (!unit || x.organization_id === unit) &&
      (!bidangRenstra || x.manual_iku_status !== "DRAFT"),
  );
  const set = (k: string, v: any) =>
    setForm((prev: any) => ({ ...prev, [k]: v }));
  const annualTarget = useMemo(
    () => annual(form.period_consolidation, form),
    [
      form.period_consolidation,
      form.target_tw1,
      form.target_tw2,
      form.target_tw3,
      form.target_tw4,
    ],
  );
  const ss = detail;
  const currentUke1 = findUke1(form.organization_id, orgs);
  return (
    <section>
      <PageTitle
        icon="bi-bar-chart-line"
        title="Manual IKU"
        subtitle="Penyusunan, pengajuan, dan validasi Indikator Kinerja Utama."
      />
      <div className="grid-2">
        <Card title={ss ? "Detail Manual IKU" : "Form Manual IKU"}>
          {ss ? (
            <div>
              <p>
                <b>Status:</b> {ss.manual_iku_status}
              </p>
              <Field label="Renja / Non-Renja">
                <input
                  value={ss.renja_type === "RENJA" ? "Renja" : "Non-Renja"}
                  disabled
                />
              </Field>
              <Field label="Sasaran Strategis">
                <input
                  value={
                    ss.strategic_objective_display ||
                    ss.strategic_objective_name ||
                    "—"
                  }
                  disabled
                />
              </Field>
              <Field label="Deskripsi Sasaran Strategis">
                <textarea
                  value={ss.strategic_objective_description || "—"}
                  disabled
                  rows={3}
                />
              </Field>
              {[
                ["Unit Kerja", ss.organization_name || "—"],
                ["Tahun", String(ss.year)],
                ["Indikator", ss.indicator_name],
                ["Deskripsi", ss.indicator_description || "—"],
                ["Formula", ss.formula || "—"],
                ["Satuan", ss.measurement_unit || "—"],
                [
                  "Unit/Pihak Penyedia Data",
                  ss.data_provider_org_name || ss.data_provider_org_id || "—",
                ],
                [
                  "Validator Data",
                  ss.data_validator_org_name || ss.data_validator_org_id || "—",
                ],
                ["Konsolidasi Periode", ss.period_consolidation],
                ["Konsolidasi Lokasi", ss.location_consolidation],
                ["Polarisasi", ss.polarization],
                ["Periode Pelaporan", ss.reporting_period],
                ["Target TW 1", fmt(ss.target_tw1)],
                ["Target TW 2", fmt(ss.target_tw2)],
                ["Target TW 3", fmt(ss.target_tw3)],
                ["Target TW 4", fmt(ss.target_tw4)],
                ["Target Tahunan", fmt(ss.target_annual)],
              ].map(([l, v]) => (
                <Field key={l} label={l}>
                  <input value={v as string} disabled />
                </Field>
              ))}
              {ss.bidang_rejection_reason && (
                <Field label="Alasan ditolak Bidang">
                  <textarea value={ss.bidang_rejection_reason} disabled />
                </Field>
              )}
              {ss.pimpinan_rejection_reason && (
                <Field label="Alasan ditolak Pimpinan Unit">
                  <textarea value={ss.pimpinan_rejection_reason} disabled />
                </Field>
              )}
              <div className="status-actions">
                {bidang && ss.manual_iku_status === "SUBMITTED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(ss.iku_id, "REVIEWED")}
                    >
                      Setuju
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const n = window.prompt("Alasan ditolak:");
                        if (n) updateStatus(ss.iku_id, "REJECTED", n);
                      }}
                    >
                      Tolak
                    </button>
                  </>
                )}
                {pimpinan && ss.manual_iku_status === "REVIEWED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(ss.iku_id, "APPROVED")}
                    >
                      Setuju
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const n = window.prompt("Alasan ditolak:");
                        if (n) updateStatus(ss.iku_id, "PIMPINAN_REJECTED", n);
                      }}
                    >
                      Tolak
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setDetail(null)}>
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) update(editingId, form);
                else create();
              }}
            >
              <Field label="Tahun">
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => set("year", Number(e.target.value))}
                />
              </Field>
              <Field label="Unit Kerja Tingkat UKE 1">
                <input
                  readOnly
                  value={currentUke1?.organization_name || "—"}
                  title="Unit kerja tingkat UKE 1"
                />
              </Field>
              <Field label="Unit Kerja">
                <input
                  readOnly
                  value={
                    orgs.find((o) => o.organization_id === form.organization_id)
                      ?.organization_name ||
                    form.organization_name ||
                    user.organization_name ||
                    "—"
                  }
                  title="Unit kerja"
                />
              </Field>
              <Field label="Penanda">
                <select
                  required
                  value={form.renja_type || ""}
                  onChange={(e) => set("renja_type", e.target.value)}
                >
                  <option value="">Pilih</option>
                  <option value="RENJA">Renja</option>
                  <option value="NON_RENJA">Non-Renja</option>
                </select>
              </Field>
              <Field label="Sasaran Strategis">
                <div
                  className="combobox"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setSsOpen(false);
                  }}
                >
                  <div className="combobox-control">
                    <input
                      required
                      aria-label="Sasaran Strategis"
                      placeholder="Pilih atau ketik Sasaran Strategis"
                      value={form.strategic_objective_name || ""}
                      onFocus={() => {
                        setSsQuery(form.strategic_objective_name || "");
                        setSsOpen(true);
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSsQuery(value);
                        const exact = strategicObjectives.find(
                          (x) =>
                            x.name.trim().toLowerCase() ===
                            value.trim().toLowerCase(),
                        );
                        setForm((prev: any) => ({
                          ...prev,
                          strategic_objective_id:
                            exact?.strategic_objective_id || "",
                          strategic_objective_name: value,
                        }));
                        setSsOpen(true);
                      }}
                    />
                    <button
                      type="button"
                      className="combobox-toggle"
                      aria-label="Buka pilihan Sasaran Strategis"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSsQuery(form.strategic_objective_name || "");
                        setSsOpen((v) => !v);
                      }}
                    >
                      ▾
                    </button>
                  </div>
                  {ssOpen && (
                    <div className="combobox-menu">
                      {strategicObjectives
                        .filter((x) => {
                          const q = ssQuery.trim().toLowerCase();
                          return (
                            !q ||
                            x.name.toLowerCase().includes(q) ||
                            (x.code || "").toLowerCase().includes(q)
                          );
                        })
                        .map((x) => (
                          <button
                            type="button"
                            className="combobox-option"
                            key={x.strategic_objective_id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForm((prev: any) => ({
                                ...prev,
                                strategic_objective_id:
                                  x.strategic_objective_id,
                                strategic_objective_name: x.name,
                              }));
                              setSsQuery(x.name);
                              setSsOpen(false);
                            }}
                          >
                            <span>{x.name}</span>
                            {x.code && <small>{x.code}</small>}
                          </button>
                        ))}
                      {ssQuery.trim() &&
                        !strategicObjectives.some(
                          (x) =>
                            x.name.trim().toLowerCase() ===
                            ssQuery.trim().toLowerCase(),
                        ) && (
                          <button
                            type="button"
                            className="combobox-option combobox-manual"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForm((prev: any) => ({
                                ...prev,
                                strategic_objective_id: "",
                                strategic_objective_name: ssQuery.trim(),
                              }));
                              setSsOpen(false);
                            }}
                          >
                            <span>
                              Gunakan sasaran manual: <b>{ssQuery.trim()}</b>
                            </span>
                            <small>Input manual</small>
                          </button>
                        )}
                      {!strategicObjectives.length && (
                        <div className="combobox-empty">
                          Belum ada sasaran strategis dari database. Silakan
                          ketik manual.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <small className="field-help">
                  Klik panah untuk melihat sasaran dari database. Jika belum
                  tersedia, ketik sasaran baru lalu pilih “Gunakan sasaran
                  manual”.
                </small>
              </Field>
              <Field label="Deskripsi Sasaran Strategis">
                <textarea
                  value={form.strategic_objective_description || ""}
                  onChange={(e) =>
                    set("strategic_objective_description", e.target.value)
                  }
                  placeholder="Isi deskripsi Sasaran Strategis"
                  rows={3}
                />
              </Field>
              <Field label="Indikator Kinerja Utama">
                <input
                  required
                  value={form.indicator_name}
                  onChange={(e) => set("indicator_name", e.target.value)}
                />
              </Field>
              <Field label="Deskripsi">
                <textarea
                  value={form.indicator_description || ""}
                  onChange={(e) => set("indicator_description", e.target.value)}
                />
              </Field>
              <Field label="Formula">
                <MathField
                  value={form.formula || ""}
                  onChange={(value) => set("formula", value)}
                />
              </Field>
              <Field label="Satuan Pengukuran">
                <input
                  value={form.measurement_unit || ""}
                  onChange={(e) => set("measurement_unit", e.target.value)}
                />
              </Field>
              <div className="form-row">
                <Field label="Unit/Pihak Penyedia Data">
                  <select
                    value={form.data_provider_org_id || ""}
                    onChange={(e) =>
                      set("data_provider_org_id", e.target.value)
                    }
                  >
                    <option value="">Pilih</option>
                    {orgs.map((o) => (
                      <option key={o.organization_id} value={o.organization_id}>
                        {o.organization_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Validator Data">
                  <select
                    value={form.data_validator_org_id || ""}
                    onChange={(e) =>
                      set("data_validator_org_id", e.target.value)
                    }
                  >
                    <option value="">Pilih</option>
                    {orgs.map((o) => (
                      <option key={o.organization_id} value={o.organization_id}>
                        {o.organization_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Sumber Data">
                <textarea
                  value={form.data_source || ""}
                  onChange={(e) => set("data_source", e.target.value)}
                  placeholder="Masukkan sumber data"
                />
              </Field>
              <Field label="Tindakan bila data belum tersedia">
                <textarea
                  value={form.missing_data_action || ""}
                  onChange={(e) => set("missing_data_action", e.target.value)}
                  placeholder="Masukkan tindakan bila data belum tersedia"
                />
              </Field>
              <div className="form-row">
                <Field label="Konsolidasi Periode">
                  <select
                    value={form.period_consolidation}
                    onChange={(e) =>
                      set("period_consolidation", e.target.value)
                    }
                  >
                    <option>SUM</option>
                    <option>AVERAGE</option>
                    <option>TAKE_LAST_KNOWN</option>
                  </select>
                </Field>
                <Field label="Jenis Cascading">
                  <select
                    value={form.cascading_type}
                    onChange={(e) => set("cascading_type", e.target.value)}
                  >
                    <option>FULLY</option>
                    <option>PARTIALLY</option>
                    <option>NON_DIRECT</option>
                  </select>
                </Field>
              </div>
              <div className="form-row">
                <Field label="Konsolidasi Lokasi">
                  <select
                    value={form.location_consolidation}
                    onChange={(e) =>
                      set("location_consolidation", e.target.value)
                    }
                  >
                    <option>SUM</option>
                    <option>AVERAGE</option>
                    <option>RAW_DATA</option>
                  </select>
                </Field>
                <Field label="Polarisasi">
                  <select
                    value={form.polarization}
                    onChange={(e) => set("polarization", e.target.value)}
                  >
                    <option>MAXIMIZE</option>
                    <option>STABILIZE</option>
                    <option>MINIMIZE</option>
                  </select>
                </Field>
              </div>
              <Field label="Periode Pelaporan">
                <select
                  value={form.reporting_period}
                  onChange={(e) => set("reporting_period", e.target.value)}
                >
                  <option>QUARTERLY</option>
                  <option>YEARLY</option>
                  <option>MONTHLY</option>
                  <option>SEMESTERLY</option>
                </select>
              </Field>
              <div className="form-row">
                {[1, 2, 3, 4].map((n) => (
                  <Field key={n} label={`Target TW ${n}`}>
                    <input
                      type="number"
                      step="any"
                      value={form[`target_tw${n}`] ?? ""}
                      onChange={(e) => set(`target_tw${n}`, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Target Tahunan">
                <input
                  readOnly
                  value={Number.isFinite(annualTarget) ? annualTarget : ""}
                />
              </Field>
              <div className="status-actions">
                <button className="btn-primary" type="submit">
                  {editingId
                    ? form.manual_iku_status === "APPROVED"
                      ? "Perbarui & Ajukan Ulang"
                      : "Perbarui Draft"
                    : "Simpan Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDetail(null);
                  }}
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </Card>
        <Card title="Daftar Manual IKU">
          <div className="form-row">
            <Field label="Filter Unit">
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">Semua Unit</option>
                {orgs.map((o) => (
                  <option key={o.organization_id} value={o.organization_id}>
                    {o.organization_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Filter Tahun">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
          </div>
          {manager && (
            <div
              className="status-actions"
              style={{
                marginBottom: 8,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const ids = filtered
                    .filter(
                      (x) =>
                        x.organization_id === user.organization_id &&
                        (x.manual_iku_status === "DRAFT" || x.manual_iku_status === "REJECTED"),
                    )
                    .map((x) => x.iku_id);
                  setSelectedIds(ids);
                }}
              >
                Pilih Semua Draft
              </button>
              <button type="button" onClick={() => setSelectedIds([])}>
                Batal Pilih
              </button>
              <span style={{ fontSize: 12 }}>{selectedIds.length} dipilih</span>
            </div>
          )}
          <DataTable
            headers={[
              manager ? "Pilih" : "",
              "Unit",
              "IKU",
              "Tahun",
              "Target Tahunan",
              "Status",
              "Action",
            ]}
            rows={filtered.map((x) => [
              manager ? (
                <input
                  type="checkbox"
                  aria-label={`Pilih ${x.indicator_name}`}
                  checked={selectedIds.includes(x.iku_id)}
                  disabled={
                    !(
                      x.organization_id === user.organization_id &&
                      (x.manual_iku_status === "DRAFT" || x.manual_iku_status === "REJECTED")
                    )
                  }
                  onChange={(e) =>
                    setSelectedIds((prev) =>
                      e.target.checked
                        ? prev.includes(x.iku_id)
                          ? prev
                          : [...prev, x.iku_id]
                        : prev.filter((id) => id !== x.iku_id),
                    )
                  }
                />
              ) : null,
              x.organization_name || "—",
              x.indicator_name,
              x.year,
              fmt(x.target_annual),
              x.manual_iku_status,
              <div className="status-actions" key={x.iku_id}>
                <button type="button" onClick={() => setDetail(x)}>
                  Detail
                </button>
                {manager &&
                  x.organization_id === user.organization_id &&
                  (x.manual_iku_status === "DRAFT" ||
                    x.manual_iku_status === "REJECTED" ||
                    x.manual_iku_status === "APPROVED") && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(x.iku_id);
                          setForm({
                            ...x,
                            target_tw1: fmtTargetInput(x.target_tw1),
                            target_tw2: fmtTargetInput(x.target_tw2),
                            target_tw3: fmtTargetInput(x.target_tw3),
                            target_tw4: fmtTargetInput(x.target_tw4),
                            target_annual: fmtTargetInput(x.target_annual),
                          });
                          setDetail(null);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => remove(x.iku_id)}>
                        {x.manual_iku_status === "APPROVED" ? "Ajukan Hapus" : "Hapus"}
                      </button>
                    </>
                  )}
              </div>,
            ])}
          />
          {manager && (
            <div
              className="status-actions"
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid #ddd",
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <strong>{selectedIds.length} Manual IKU dipilih</strong>
              <button
                type="button"
                className="btn-primary"
                disabled={selectedIds.length === 0}
                onClick={async () => {
                  if (selectedIds.length > 0) {
                    await submitSelected(selectedIds);
                    setSelectedIds([]);
                  }
                }}
              >
                Ajukan
                {selectedIds.length > 0
                  ? ` ${selectedIds.length} Manual IKU`
                  : " Manual IKU"}
              </button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
