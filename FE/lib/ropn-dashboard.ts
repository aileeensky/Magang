export const TW = ["TW I", "TW II", "TW III", "TW IV"] as const;
export const KINERJA = "Progres Kinerja";
export const ANGGARAN = "Realisasi Anggaran";
export const COLORS = ["#2563eb", "#ef4461", "#17c055", "#f59e0b", "#9333ea"];

export type Row = {
  Tahun: number;
  Unit: string;
  ROPN: string;
  Jenis: string;
  [key: string]: any;
};

export type Kpi = {
  y: number;
  tw: string | null;
  ropn: number;
  kinerja: number;
  anggaran: number;
};

export function shortName(v: string, max = 25) {
  return v.length <= max ? v : v.slice(0, max - 3).trim() + "...";
}

export function lightenColor(hex: string, amount = 0.55) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgb(${Math.round(r + (255 - r) * amount)}, ${Math.round(
    g + (255 - g) * amount,
  )}, ${Math.round(b + (255 - b) * amount)})`;
}

export function cleanRows(rows: any[]): Row[] {
  return rows
    .map((r) => {
      const x: any = { ...r };
      x.Tahun = Number(x.Tahun);
      x.Unit = String(x.Unit ?? "").trim() || "#NA";
      x.ROPN = String(x.ROPN ?? "").trim();
      x.Jenis = String(x.Jenis ?? "").trim();
      TW.forEach((t) => {
        const n = Number(x[t]);
        x[t] = Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : null;
      });
      return x;
    })
    .filter((x) => Number.isFinite(x.Tahun) && x.ROPN && x.Jenis);
}

export function measurementTW(year: number) {
  const now = new Date();
  const current = now.getFullYear();

  if (year < current) return "TW IV";
  if (year > current) return null;

  const month = now.getMonth() + 1;
  if (month <= 6) return "TW I";
  if (month <= 9) return "TW II";
  return "TW III";
}

export function avg(rows: Row[], jenis: string, tw: string | null) {
  if (!tw) return 0;

  const vals = rows
    .filter((r) => r.Jenis.toLowerCase() === jenis.toLowerCase())
    .map((r) => Number(r[tw]))
    .filter(Number.isFinite);

  return vals.length
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : 0;
}

export function latestPeriod(years: number[]) {
  return years.length ? measurementTW(Math.max(...years)) : null;
}
