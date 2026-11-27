/** Pure helpers for the home-page Daily Quiz spotlight (countdown + streak label). */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds from `now` until the next India-time midnight, when the next daily set unlocks. */
export function msUntilIstMidnight(now: number): number {
  const ist = now + IST_OFFSET_MS;
  const left = DAY_MS - (((ist % DAY_MS) + DAY_MS) % DAY_MS);
  return left === 0 ? DAY_MS : left;
}

/** 3_723_000 -> "01:02:03" */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function streakLabel(n: number): string {
  return n > 0 ? `${n}-day streak` : "Start your streak";
}
