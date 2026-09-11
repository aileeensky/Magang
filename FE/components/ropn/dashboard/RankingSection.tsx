import RankChart from "./charts/RankChart";

type RankingSectionProps = {
  period: string | null;
  lowK: any[];
  lowA: any[];
};

export default function RankingSection({
  period,
  lowK,
  lowA,
}: RankingSectionProps) {
  return (
    <div className="two-col">
      <RankChart
        title={`5 ROPN Kinerja Terendah — ${period || "-"}`}
        data={lowK}
      />
      <RankChart
        title={`5 ROPN Anggaran Terendah — ${period || "-"}`}
        data={lowA}
      />
    </div>
  );
}
