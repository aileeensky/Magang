"use client";
import type { Ref, Context, Assessment } from "../../../types";
import { Card, Field, PageTitle, DataTable, RiskStatusActions } from "../../ui";
export default function AssessmentPage({
  cats,
  contexts,
  form,
  setForm,
  data,
  create,
  selectedContext,
  onSelect,
}: {
  cats: Ref[];
  contexts: Context[];
  form: any;
  setForm: (x: any) => void;
  data: Assessment[];
  create: () => void;
  selectedContext: string;
  onSelect: (id: string) => void;
  updateStatus: (id: string, status: string) => void;
  canAuthor: boolean;
  canReview: boolean;
  canApprove: boolean;
}) {
  return (
    <section>
      <PageTitle
        icon="bi-shield-check"
        title="Formulir Asesmen Risiko (FAR)"
        subtitle="Penilaian risiko, existing control, IPI, current risk dan tingkat risiko."
      />
      <div className="grid-2">
        <Card title="Tambah Penilaian">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <Field label="Lingkup / LKK">
              <select
                required
                value={form.risk_context_id || selectedContext}
                onChange={(e) =>
                  setForm({ ...form, risk_context_id: e.target.value })
                }
              >
                <option value="">Pilih LKK</option>
                {contexts.map((c) => (
                  <option key={c.risk_context_id} value={c.risk_context_id}>
                    {c.organization_name || "—"} —{" "}
                    {c.performance_iku_name || "LKK"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kode Risiko">
              <input
                value={form.risk_code || ""}
                onChange={(e) =>
                  setForm({ ...form, risk_code: e.target.value })
                }
              />
            </Field>
            <Field label="Risiko">
              <textarea
                required
                value={form.risk_description || ""}
                onChange={(e) =>
                  setForm({ ...form, risk_description: e.target.value })
                }
              />
            </Field>
            <Field label="Penyebab">
              <textarea
                value={form.cause || ""}
                onChange={(e) => setForm({ ...form, cause: e.target.value })}
              />
            </Field>
            <Field label="Dampak">
              <textarea
                value={form.impact || ""}
                onChange={(e) => setForm({ ...form, impact: e.target.value })}
              />
            </Field>
            <div className="form-row">
              <Field label="Kategori">
                <select
                  required
                  value={form.risk_category_id || ""}
                  onChange={(e) =>
                    setForm({ ...form, risk_category_id: e.target.value })
                  }
                >
                  <option value="">Pilih</option>
                  {cats.map((c) => (
                    <option key={c.risk_category_id} value={c.risk_category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Inherent Risk">
                <select
                  value={form.inherent_risk || "08"}
                  onChange={(e) =>
                    setForm({ ...form, inherent_risk: e.target.value })
                  }
                >
                  {[
                    "01",
                    "02",
                    "03",
                    "04",
                    "05",
                    "06",
                    "08",
                    "09",
                    "10",
                    "12",
                    "15",
                    "16",
                    "20",
                    "25",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Existing Control">
              <textarea
                value={form.existing_control || ""}
                onChange={(e) =>
                  setForm({ ...form, existing_control: e.target.value })
                }
              />
            </Field>
            <Field label="IPI (0–1)">
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.internal_control_index}
                onChange={(e) =>
                  setForm({ ...form, internal_control_index: e.target.value })
                }
              />
            </Field>
            <button className="btn-primary">Simpan Asesmen</button>
          </form>
        </Card>
        <Card title="Daftar Risiko">
          <DataTable
            headers={[
              "Kode",
              "Risiko",
              "Inherent",
              "Current",
              "Level",
              "Status",
            ]}
            rows={data.map((a) => [
              a.risk_code || "—",
              a.risk_description,
              a.inherent_risk || "—",
              a.current_risk || "—",
              a.risk_level || "—",
              <RiskStatusActions
                status={a.status}
                onChange={(st) => updateStatus(a.risk_assessment_id, st)}
                canAuthor={canAuthor}
                canReview={canReview}
                canApprove={canApprove}
              />,
            ])}
            onRow={(i) => onSelect(data[i].risk_assessment_id)}
          />
        </Card>
      </div>
    </section>
  );
}
