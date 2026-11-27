import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fmtCountdown, msUntilIstMidnight, streakLabel } from "../src/lib/quiz-spotlight";
import { currentStreak, type StoreState } from "../src/lib/store";

const st = (streak: number, last: string | null): StoreState => ({ v: 1, opened: {}, quiz: {}, saved: [], daily: { history: {}, streak, best: streak, last } });

describe("home quiz spotlight", () => {
  it("counts down to the next India-time midnight", () => {
    // 27 Nov 2026 18:30 UTC = 28 Nov 00:00 IST
    const midnight = Date.UTC(2026, 10, 27, 18, 30, 0);
    expect(msUntilIstMidnight(midnight - 1000)).toBe(1000);
    expect(msUntilIstMidnight(midnight)).toBe(24 * 3600 * 1000);
    // 13:00 UTC = 18:30 IST -> 5h30m left
    expect(fmtCountdown(msUntilIstMidnight(Date.UTC(2026, 10, 27, 13, 0, 0)))).toBe("05:30:00");
  });

  it("formats HH:MM:SS", () => {
    expect(fmtCountdown(3_723_000)).toBe("01:02:03");
    expect(fmtCountdown(-5)).toBe("00:00:00");
  });

  it("labels the fire streak", () => {
    expect(streakLabel(0)).toBe("Start your streak");
    expect(streakLabel(1)).toBe("1-day streak");
    expect(streakLabel(7)).toBe("7-day streak");
  });

  it("streak survives until the end of the next IST day, then resets", () => {
    expect(currentStreak(st(3, "2026-11-27"), "2026-11-27")).toBe(3);
    expect(currentStreak(st(3, "2026-11-26"), "2026-11-27")).toBe(3);
    expect(currentStreak(st(3, "2026-11-25"), "2026-11-27")).toBe(0);
    expect(currentStreak(st(0, null), "2026-11-27")).toBe(0);
  });

  it("puts the Daily Quiz spotlight first on Home, with topic of the week inside it", () => {
    const src = readFileSync("src/app/page.tsx", "utf8");
    const mobileMain = src.indexOf('<main className="px-4 pt-5 pb-4 space-y-7">');
    const desktopMain = src.indexOf('<main className="hidden lg:grid');
    const firstAfter = (from: number) => src.slice(from).split("\n")[1].trim() + src.slice(from).split("\n")[2].trim();
    expect(firstAfter(mobileMain)).toContain("QuizSpotlight");
    expect(firstAfter(desktopMain)).toContain("QuizSpotlight");
    expect(src.match(/<TopTopicCard \/>/g)?.length).toBe(2);
    expect(src).toMatch(/topic=\{<TopTopicCard \/>\}/);
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(/prefers-reduced-motion: reduce\) \{ \.streak-flame \{ animation: none/);
  });
});
