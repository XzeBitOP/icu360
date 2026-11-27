import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Module } from "../src/lib/content-types";
import {
  getArmando, getFreeVideos, freeVideosFor, freeVideoGroups, freeVideoChannels, freeVideoRights, topicVideoCreators, visualsFor,
  YT_ID, VIDEO_LIBRARY_LABEL, VIDEO_LIBRARY_PATH,
} from "../src/lib/embedded-videos";
import { bedsideText, notesText, moduleText } from "../src/lib/ai/context";

const MOD_DIR = path.join(process.cwd(), "content", "modules");
const modules: Module[] = readdirSync(MOD_DIR)
  .filter((d) => existsSync(path.join(MOD_DIR, d, "module.json")))
  .map((d) => JSON.parse(readFileSync(path.join(MOD_DIR, d, "module.json"), "utf8")) as Module)
  .sort((a, b) => a.number - b.number);
const topicIds = new Map(modules.map((m) => [m.id, new Map(m.topics.map((t) => [t.id, t.title]))]));
const RAW = readFileSync(path.join(process.cwd(), "content", "embedded-videos", "youtube-free.json"), "utf8");

describe("free YouTube videos (content/embedded-videos/youtube-free.json)", () => {
  const { channels, videos, rights } = getFreeVideos();

  it("states we do not own the videos; never says partner, permission, endorsement or thank-you", () => {
    expect(rights).toMatch(/does not own these videos; all rights belong to the creators/);
    expect(RAW).not.toMatch(/partner|permission|thank you|endorse/i);
    expect(videos.length).toBeGreaterThan(100);
  });

  it("every channel has a name and a YouTube URL, and is used", () => {
    const ids = new Set(channels.map((c) => c.id));
    expect(ids.size).toBe(channels.length);
    for (const c of channels) {
      expect(c.name.trim()).toBe(c.name);
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.youtube).toMatch(/^https:\/\/www\.youtube\.com\/(@|channel\/|c\/|user\/)/);
      expect(c.youtubeChannelId).toMatch(/^UC[\w-]{22}$/);
      expect(videos.some((v) => v.channelId === c.id), c.id).toBe(true);
    }
    for (const v of videos) expect(ids.has(v.channelId), v.youtubeId).toBe(true);
  });

  it("every video has a valid id, official title, real topic, strength and a short blurb", () => {
    for (const v of videos) {
      expect(v.youtubeId).toMatch(YT_ID);
      expect(v.videoTitle.trim().length).toBeGreaterThan(3);
      const topics = topicIds.get(v.icuModuleId);
      expect(topics, v.icuModuleId).toBeDefined();
      expect(topics!.get(v.icuTopicId), `${v.icuModuleId}/${v.icuTopicId}`).toBe(v.icuTopicTitle);
      expect(["strong", "partial"]).toContain(v.matchStrength);
      expect(v.blurb.length).toBeGreaterThan(10);
      expect(v.blurb.length).toBeLessThanOrEqual(140);
      expect(v.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("does not duplicate Armando's videos or topics, and has no duplicate video", () => {
    const armandoIds = new Set(getArmando().videos.map((v) => v.youtubeId));
    const armandoTopics = new Set(getArmando().videos.map((v) => `${v.icuModuleId}/${v.icuTopicId}`));
    for (const v of videos) {
      expect(armandoIds.has(v.youtubeId), v.youtubeId).toBe(false);
      expect(armandoTopics.has(`${v.icuModuleId}/${v.icuTopicId}`), v.icuTopicId).toBe(false);
    }
    expect(new Set(videos.map((v) => v.youtubeId)).size).toBe(videos.length);
  });

  it("every module has at least one embedded video (Armando or free)", () => {
    for (const m of modules) expect(topicVideoCreators(m.id).size, m.id).toBeGreaterThan(0);
  });

  it("freeVideosFor joins the channel and leaves Armando's lookups unchanged", () => {
    const [v] = freeVideosFor("handover-transport-icu-safety", "isbar-handover");
    expect(v.channel.name).toBe("Geeky Medics");
    expect(visualsFor("handover-transport-icu-safety", "isbar-handover")).toEqual([]);
    expect(freeVideosFor("sepsis-septic-shock", "recognition-sepsis-3")).toEqual([]);
    expect(topicVideoCreators("handover-transport-icu-safety").get("isbar-handover")).toEqual(["Geeky Medics"]);
    expect(topicVideoCreators("sepsis-septic-shock").get("recognition-sepsis-3")).toEqual(["Armando Hasudungan"]);
  });

  it("credit wording names the channel, says we do not own it and that it loads on tap", () => {
    expect(freeVideoRights("Strong Medicine")).toBe(
      "Embedded video by Strong Medicine (YouTube). ICU 360 does not own this video; all rights belong to the creator. The video loads from YouTube only when you tap play.",
    );
  });

  it("library groups follow module order and include every video; channels are counted", () => {
    const order = modules.map((m) => m.id);
    const groups = freeVideoGroups(order);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(videos.length);
    const idx = groups.map((g) => order.indexOf(g.moduleId));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(freeVideoChannels().reduce((n, c) => n + c.count, 0)).toBe(videos.length);
    expect(VIDEO_LIBRARY_PATH).toBe("/videos/library");
    expect(VIDEO_LIBRARY_LABEL).toBe("Video library");
  });

  it("search index has the library page and one 'Video · <Channel>' entry per video; precache has the page", () => {
    const idx = JSON.parse(readFileSync(path.join(process.cwd(), "public", "search-index.json"), "utf8")) as { type: string; title: string; sub: string; href: string }[];
    expect(idx.find((e) => e.href === "/videos/library")?.title).toBe("Video library");
    for (const v of videos) {
      const e = idx.find((x) => x.href === `/videos/library#v-${v.youtubeId}`);
      expect(e, v.youtubeId).toBeDefined();
      expect(e!.type).toBe("video");
      expect(e!.title).toBe(v.videoTitle);
      const ch = channels.find((c) => c.id === v.channelId)!;
      expect(e!.sub.startsWith(`Video · ${ch.name} · `)).toBe(true);
    }
    const precache = JSON.parse(readFileSync(path.join(process.cwd(), "public", "precache.json"), "utf8")) as { routes: string[] };
    expect(precache.routes).toContain("/videos/library");
  });

  it("is never sent to the AI tutor", () => {
    const names = channels.map((c) => c.name.toLowerCase());
    for (const m of modules) {
      const texts = [moduleText(m), ...m.topics.flatMap((t) => [bedsideText(t), notesText(t)])].map((s) => s.toLowerCase());
      for (const s of texts) {
        expect(s).not.toMatch(/youtube/);
        for (const v of videos) expect(s.includes(v.youtubeId.toLowerCase())).toBe(false);
      }
    }
    expect(names.length).toBeGreaterThan(20);
  });

  it("user-facing files never say partner, permission or thank-you", () => {
    for (const f of ["src/app/videos/library/page.tsx", "src/components/VideoLibraryLink.tsx", "src/components/VisualExplanation.tsx", "src/app/credits/page.tsx"]) {
      expect(readFileSync(path.join(process.cwd(), f), "utf8"), f).not.toMatch(/partner|permission|thank you/i);
    }
  });
});
