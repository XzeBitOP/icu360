/** View counts are public only in whole thousands, rounded down. Under 1,000 shows "New". */
export function fmtViews(n: number | undefined | null): string {
  const v = Math.max(0, Math.floor(n ?? 0));
  if (v < 1000) return "New";
  if (v < 1_000_000) return `${Math.floor(v / 1000)}K`;
  return `${(Math.floor(v / 100_000) / 10).toFixed(1).replace(/\.0$/, "")}M`;
}

export function roundDownThousand(n: number): number {
  return Math.floor(Math.max(0, n) / 1000) * 1000;
}

export function round(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "–";
  const f = Math.pow(10, decimals);
  return (Math.round(n * f) / f).toFixed(decimals);
}

/** YYYY-MM-DD in India time. */
export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d || 1));
  return dt.toLocaleDateString("en-GB", { day: d ? "numeric" : undefined, month: "short", year: "numeric", timeZone: "UTC" });
}

/** ISO-8601 week id in India time (weeks run Monday 00:00 to Sunday 23:59 IST), e.g. "2026-W46". */
export function isoWeek(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 330 * 60000);
  const t = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
