import type { Kpi } from "../../../lib/ropn-dashboard";

type ExecutiveSummaryProps = {
  kpis: Kpi[];
};

export default function ExecutiveSummary({ kpis }: ExecutiveSummaryProps) {
  const cards = [
    { title: "TAHUN", values: kpis.map((item) => `${item.y}`) },
    { title: "ROPN", values: kpis.map((item) => `${item.ropn}`) },
    {
      title: "KINERJA",
      values: kpis.map((item) => `${item.kinerja.toFixed(1)}%`),
    },
    {
      title: "ANGGARAN",
      values: kpis.map((item) => `${item.anggaran.toFixed(1)}%`),
    },
  ];

  return (
    <section className="kpi-grid">
      {cards.map(({ title, values }) => (
        <div className="kpi" key={title}>
          <div className="kpi-title">{title}</div>
          <div className="kpi-year-list">
            {values.map((value, index) => (
              <div className="kpi-value" key={`${title}-${index}`}>
                {value}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
