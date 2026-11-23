import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Module } from "../src/lib/content-types";
import { getArmando, visualsFor, topicsWithVisuals, YT_ID, ytEmbed, ytThumb } from "../src/lib/partners";
import { bedsideText, notesText, moduleText } from "../src/lib/ai/context";

const MOD_DIR = path.join(process.cwd(), "content", "modules");
const modules: Module[] = readdirSync(MOD_DIR)
  .filter((d) => existsSync(path.join(MOD_DIR, d, "module.json")))
  .map((d) => JSON.parse(readFileSync(path.join(MOD_DIR, d, "module.json"), "utf8")) as Module);
const topicIds = new Map(modules.map((m) => [m.id, new Map(m.topics.map((t) => [t.id, t.title]))]));

describe("Armando Hasudungan partner map (content/partners/armando.json)", () => {
  const { partner, videos } = getArmando();

  it("names the partner and his site", () => {
    expect(partner.name).toBe("Armando Hasudungan");
    expect(partner.site).toBe("https://armandoh.org");
    expect(partner.youtube).toMatch(/^https:\/\/www\.youtube\.com\//);
    expect(videos.length).toBeGreaterThan(20);
  });

  it("every entry has a valid YouTube id, official title and his channel as author", () => {
    for (const v of videos) {
      expect(v.youtubeId, v.armandoTopic).toMatch(YT_ID);
      expect(v.videoTitle.trim().length).toBeGreaterThan(3);
      expect(v.author).toBe("Armando Hasudungan");
    }
  });

  it("every entry carries a credit URL to his exact page on armandoh.org", () => {
    for (const v of videos) {
      expect(v.armandoUrl).toMatch(/^https:\/\/armandoh\.org\/(video|disease)\/[a-z0-9-]+\/$/);
      if (v.notesUrl) expect(v.notesUrl).toMatch(/^https:\/\/armandoh\.org\/disease\/[a-z0-9-]+\/$/);
    }
  });

  it("every module and topic id exists and the stored title matches", () => {
    for (const v of videos) {
      const topics = topicIds.get(v.icuModuleId);
      expect(topics, v.icuModuleId).toBeDefined();
      expect(topics!.has(v.icuTopicId), `${v.icuModuleId}/${v.icuTopicId}`).toBe(true);
      expect(v.icuTopicTitle).toBe(topics!.get(v.icuTopicId));
    }
  });

  it("match strength is strong or partial, blurbs are one short line in our words", () => {
    for (const v of videos) {
      expect(["strong", "partial"]).toContain(v.matchStrength);
      expect(v.blurb.length).toBeGreaterThan(10);
      expect(v.blurb.length).toBeLessThanOrEqual(140);
      expect(v.blurb).not.toContain("\n");
    }
  });

  it("has no duplicate video on the same topic", () => {
    const keys = videos.map((v) => `${v.icuModuleId}/${v.icuTopicId}/${v.youtubeId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("visualsFor puts strong matches first and caps the count", () => {
    const ich = visualsFor("neuro-emergencies", "ich-sah");
    expect(ich.length).toBeGreaterThanOrEqual(2);
    expect(ich[0].matchStrength).toBe("strong");
    expect(visualsFor("neuro-emergencies", "ich-sah", 1)).toHaveLength(1);
    expect(visualsFor("handover-transport-icu-safety", "isbar-handover")).toEqual([]);
    expect(topicsWithVisuals("sepsis-septic-shock").has("recognition-sepsis-3")).toBe(true);
  });

  it("embeds use youtube-nocookie and i.ytimg thumbnails", () => {
    expect(ytEmbed("OgQ6avlpBRY")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/OgQ6avlpBRY\?/);
    expect(ytThumb("OgQ6avlpBRY")).toBe("https://i.ytimg.com/vi/OgQ6avlpBRY/hqdefault.jpg");
  });

  it("never sends his material to the AI tutor (topic, notes and module context stay ICU 360-only)", () => {
    for (const m of modules) {
      expect(moduleText(m)).not.toMatch(/armando|armandoh\.org|youtube/i);
      for (const t of m.topics) {
        expect(bedsideText(t)).not.toMatch(/armando|armandoh\.org|youtube/i);
        expect(notesText(t)).not.toMatch(/armando|armandoh\.org|youtube/i);
      }
    }
  });
});
