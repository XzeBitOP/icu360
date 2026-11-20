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
    expect(news.items.length).toBeGreaterThanOrEqual(7);
    expect(news.items.some((i) => /save-icu/i.test(i.id))).toBe(false);
    for (const item of news.items) {
      expect(item.source.length).toBeGreaterThan(0);
      expect(item.url).toMatch(/^https:\/\//);
    }
  });

  it("labels the 14 Oct catch-up items", () => {
    const catchUps = news.items.filter((i) => i.catchUp);
    expect(catchUps.map((i) => i.id).sort()).toEqual(["2026-11-15-icraki", "2026-11-15-vasspr"]);
    expect(catchUps.every((i) => i.date === "2026-10-14")).toBe(true);
  });
});

describe("daily quiz", () => {
  const daily = JSON.parse(readFileSync("content/quiz/daily.json", "utf8")) as {
    sets: { date: string; title?: string; questions: unknown[] }[];
  };

  it("shows the 15 Nov 2026 set as today's quiz and keeps the starter on 14 Nov", () => {
    const dates = daily.sets.map((s) => s.date);
    expect(new Set(dates).size).toBe(dates.length);
    const today = daily.sets.find((s) => s.date === "2026-11-15");
    const starter = daily.sets.find((s) => s.date === "2026-11-14");
    expect(today?.questions).toHaveLength(5);
    expect(today?.title).toMatch(/15 November 2026/);
    expect(starter?.title).toMatch(/Starter set/);
    expect(starter?.questions).toHaveLength(5);
  });
});
