import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKS } from "../src/data/books";

describe("books", () => {
  it("lists three titles with https store links and no bare clutter", () => {
    expect(BOOKS).toHaveLength(3);
    expect(BOOKS.map((b) => b.title)).toEqual([
      "ICU Essentials: 50 Common Case Presentations",
      "The Ultimate Interpretation Handbook",
      "Say It Simple",
    ]);
    for (const book of BOOKS) {
      expect(book.links.length).toBeGreaterThan(0);
      const hrefs = new Set<string>();
      for (const link of book.links) {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href).toMatch(/^https:\/\//);
        expect(hrefs.has(link.href)).toBe(false);
        hrefs.add(link.href);
      }
    }
  });

  it("omits the duplicated Handbook Pothi link from Say It Simple", () => {
    const book = BOOKS.find((b) => b.id === "say-it-simple");
    expect(book).toBeDefined();
    expect(book!.links.some((l) => /pothi/i.test(l.href) || /pothi/i.test(l.label))).toBe(false);
  });
});

describe("news", () => {
  const news = JSON.parse(readFileSync("content/news/news.json", "utf8")) as {
    items: { id: string; url: string; source: string; catchUp?: boolean; date: string }[];
  };

  it("publishes approved items with original source urls and drops SAVE-ICU", () => {
    expect(news.items.length).toBeGreaterThanOrEqual(13);
    expect(news.items.some((i) => /save-icu/i.test(i.id))).toBe(false);
    const ids = news.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      "2026-11-22-kerala-lepto-dengue",
      "2026-11-22-fda-heraeus-guidewires",
      "2026-11-22-icu-noise-delirium",
      "2026-11-22-center-tbi-icp",
      "2026-11-22-discharge-creatinine-gfr",
      "2026-11-22-icmr-amrsn-2025",
      "2026-11-22-oliceridine-coroam",
      "2026-11-22-cefepime-neurotoxicity",
      "2026-11-22-ulinastatin-adjust",
    ]));
    const dates = news.items.map((i) => i.date);
    expect(dates).toEqual([...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)));
    for (const item of news.items) {
      expect(item.source.length).toBeGreaterThan(0);
      expect(item.url).toMatch(/^https:\/\//);
    }
  });

  it("labels the 14 Oct catch-up items", () => {
    const catchUps = news.items.filter((i) => i.catchUp);
    expect(catchUps.map((i) => i.id).sort()).toEqual([
      "2026-11-15-icraki",
      "2026-11-15-vasspr",
      "2026-11-24-dobutamine-aki",
      "2026-11-24-icmr-fungal-ifi",
    ]);
    expect(catchUps.find((i) => i.id === "2026-11-24-dobutamine-aki")?.date).toBe("2026-10-14");
    expect(catchUps.find((i) => i.id === "2026-11-24-icmr-fungal-ifi")?.date).toBe("2026-10-08");
    expect(catchUps.filter((i) => i.id.startsWith("2026-11-15")).every((i) => i.date === "2026-10-14")).toBe(true);
  });
});

describe("daily quiz", () => {
  const daily = JSON.parse(readFileSync("content/quiz/daily.json", "utf8")) as {
    sets: { date: string; title?: string; questions: unknown[] }[];
  };

  it("keeps unique dated sets of 5 questions, including 22–26 Nov 2026", () => {
    const dates = daily.sets.map((s) => s.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.length).toBeGreaterThanOrEqual(8);
    for (const set of daily.sets) {
      expect(set.questions).toHaveLength(5);
    }
    const d22 = daily.sets.find((s) => s.date === "2026-11-22");
    const d23 = daily.sets.find((s) => s.date === "2026-11-23");
    const d24 = daily.sets.find((s) => s.date === "2026-11-24");
    const d25 = daily.sets.find((s) => s.date === "2026-11-25");
    const d26 = daily.sets.find((s) => s.date === "2026-11-26");
    const starter = daily.sets.find((s) => s.date === "2026-11-14");
    expect(d22?.title).toMatch(/22 November 2026/);
    expect(d23?.title).toMatch(/23 November 2026/);
    expect(d24?.title).toMatch(/24 November 2026/);
    expect(d25?.title).toMatch(/25 November 2026/);
    expect(d26?.title).toMatch(/26 November 2026/);
    expect(starter?.title).toMatch(/Starter set/);
  });

  it("would hide a future-dated set until that IST day (same rule as DailyQuiz)", () => {
    const available = (today: string) => daily.sets.filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
    expect(available("2026-11-22").map((s) => s.date)[0]).toBe("2026-11-22");
    expect(available("2026-11-22").some((s) => s.date === "2026-11-23")).toBe(false);
    expect(available("2026-11-23").map((s) => s.date)[0]).toBe("2026-11-23");
    expect(available("2026-11-24").map((s) => s.date)[0]).toBe("2026-11-24");
    expect(available("2026-11-24").some((s) => s.date === "2026-11-25")).toBe(false);
    expect(available("2026-11-25").map((s) => s.date)[0]).toBe("2026-11-25");
    expect(available("2026-11-26").map((s) => s.date)[0]).toBe("2026-11-26");
  });
});
