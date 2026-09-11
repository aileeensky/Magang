export default function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div className="chart-tooltip-list">
        {payload.map((item: any) => (
          <div className="chart-tooltip-row" key={item.dataKey}>
            <span
              className="chart-tooltip-dot"
              style={{ backgroundColor: item.color }}
            />
            <span className="chart-tooltip-name">{item.name}</span>
            <strong>{Number(item.value).toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
