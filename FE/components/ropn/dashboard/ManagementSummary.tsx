import type { Kpi } from "../../../lib/ropn-dashboard";
import SectionTitle from "./SectionTitle";

type ManagementSummaryProps = {
  kpis: Kpi[];
};

export default function ManagementSummary({ kpis }: ManagementSummaryProps) {
  return (
    <div id="management-summary">
      <SectionTitle>💡 Ringkasan Manajemen</SectionTitle>

      <section className="management-summary">
        {kpis.map((item) => (
          <div className="management-item" key={item.y}>
            <div className="management-year">
              Tahun {item.y} - {item.tw || "-"}
            </div>

            <div className="management-narrative">
              <span className="management-icon">📈</span>
              <span>
                Capaian kinerja tercatat sebesar{" "}
                <strong>{item.kinerja.toFixed(1)}%</strong> dengan realisasi
                anggaran sebesar <strong>{item.anggaran.toFixed(1)}%</strong>.
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
