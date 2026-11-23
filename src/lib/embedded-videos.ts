import fs from "node:fs";
import path from "node:path";

/**
 * Embedded YouTube videos by Armando Hasudungan (server-only, build time). ICU 360 embeds his videos; it does not
 * own them and all rights belong to him. Every embed credits his name and links to his page on armandoh.org,
 * which has complete free-to-use videos, diagrams and PDFs. Never describe him as a partner.
 * His material is never sent to the AI tutor (see src/lib/ai/context.ts, which only reads module content).
 */
export type MatchStrength = "strong" | "partial";

export type EmbeddedVideo = {
  armandoTopic: string;
  /** His exact topic page on armandoh.org (credit link). */
  armandoUrl: string;
  /** His matching disease notes page on armandoh.org, when there is one. */
  notesUrl?: string;
  youtubeId: string;
  /** Official title from YouTube oEmbed. */
  videoTitle: string;
  /** Official channel name from YouTube oEmbed (always "Armando Hasudungan"). */
  author: string;
  icuModuleId: string;
  icuTopicId: string;
  icuTopicTitle: string;
  matchStrength: MatchStrength;
  /** One line in our own words (never his notes text). */
  blurb: string;
};

export type VideoCreator = { id: string; name: string; site: string; youtube: string; verifiedAt: string; rights: string; freeResources: string; creditRules: string };
export type EmbeddedVideosFile = { creator: VideoCreator; videos: EmbeddedVideo[] };

export const ARMANDO_FILE = path.join(process.cwd(), "content", "embedded-videos", "armando.json");

let _data: EmbeddedVideosFile | null = null;
export function getArmando(): EmbeddedVideosFile {
  if (!_data) _data = JSON.parse(fs.readFileSync(ARMANDO_FILE, "utf8")) as EmbeddedVideosFile;
  return _data;
}

/** Videos for one topic: strong matches first, at most `max`. */
export function visualsFor(moduleId: string, topicId: string, max = 3): EmbeddedVideo[] {
  return getArmando()
    .videos.filter((v) => v.icuModuleId === moduleId && v.icuTopicId === topicId)
    .sort((a, b) => Number(a.matchStrength !== "strong") - Number(b.matchStrength !== "strong"))
    .slice(0, max);
}

/** Topic ids in a module that have at least one embedded video. */
export function topicsWithVisuals(moduleId: string): Set<string> {
  return new Set(getArmando().videos.filter((v) => v.icuModuleId === moduleId).map((v) => v.icuTopicId));
}

export const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** Privacy-enhanced embed; loaded only after the user taps play. */
export const ytEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

/** Route of the "Video resource by Armandoh" page (all embedded videos, grouped by ICU 360 module). */
export const ARMANDO_RESOURCE_PATH = "/videos/armando";
export const ARMANDO_RESOURCE_LABEL = "Video resource by Armandoh";
export const videoAnchor = (youtubeId: string) => `v-${youtubeId}`;

export type ArmandoResourceItem = {
  youtubeId: string;
  videoTitle: string;
  armandoUrl: string;
  notesUrl?: string;
  blurb: string;
  /** Every ICU 360 topic this video is embedded on (strong matches first). */
  topics: { moduleId: string; topicId: string; title: string; strong: boolean }[];
  /** First entry (strong first) used as the credit source and for grouping. */
  primary: EmbeddedVideo;
};

/** One item per unique video, strong matches first so the primary module is the best fit. */
export function armandoResourceItems(): ArmandoResourceItem[] {
  const sorted = [...getArmando().videos].sort((a, b) => Number(a.matchStrength !== "strong") - Number(b.matchStrength !== "strong"));
  const byId = new Map<string, ArmandoResourceItem>();
  for (const v of sorted) {
    let it = byId.get(v.youtubeId);
    if (!it) {
      it = { youtubeId: v.youtubeId, videoTitle: v.videoTitle, armandoUrl: v.armandoUrl, notesUrl: v.notesUrl, blurb: v.blurb, topics: [], primary: v };
      byId.set(v.youtubeId, it);
    }
    if (!it.notesUrl && v.notesUrl) it.notesUrl = v.notesUrl;
    if (!it.topics.some((t) => t.moduleId === v.icuModuleId && t.topicId === v.icuTopicId))
      it.topics.push({ moduleId: v.icuModuleId, topicId: v.icuTopicId, title: v.icuTopicTitle, strong: v.matchStrength === "strong" });
  }
  return [...byId.values()];
}

/** Items grouped by their primary ICU 360 module, in the order of `moduleOrder` (module ids). */
export function armandoResourceGroups(moduleOrder: string[]): { moduleId: string; items: ArmandoResourceItem[] }[] {
  const items = armandoResourceItems();
  return moduleOrder
    .map((moduleId) => ({ moduleId, items: items.filter((i) => i.primary.icuModuleId === moduleId) }))
    .filter((g) => g.items.length);
}
