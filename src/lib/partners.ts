import fs from "node:fs";
import path from "node:path";

/**
 * Partner content (server-only, build time). Armando Hasudungan (armandoh.org) gave permission to embed his
 * videos on ICU 360 with clear credit: his name and a link to his site/topic page on every embed.
 * His material is never sent to the AI tutor (see src/lib/ai/context.ts, which only reads module content).
 */
export type MatchStrength = "strong" | "partial";

export type PartnerVideo = {
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

export type Partner = { id: string; name: string; site: string; youtube: string; permission: string; verifiedAt: string };
export type PartnerFile = { partner: Partner; videos: PartnerVideo[] };

export const ARMANDO_FILE = path.join(process.cwd(), "content", "partners", "armando.json");

let _data: PartnerFile | null = null;
export function getArmando(): PartnerFile {
  if (!_data) _data = JSON.parse(fs.readFileSync(ARMANDO_FILE, "utf8")) as PartnerFile;
  return _data;
}

/** Videos for one topic: strong matches first, at most `max`. */
export function visualsFor(moduleId: string, topicId: string, max = 3): PartnerVideo[] {
  return getArmando()
    .videos.filter((v) => v.icuModuleId === moduleId && v.icuTopicId === topicId)
    .sort((a, b) => Number(a.matchStrength !== "strong") - Number(b.matchStrength !== "strong"))
    .slice(0, max);
}

/** Topic ids in a module that have at least one partner video. */
export function topicsWithVisuals(moduleId: string): Set<string> {
  return new Set(getArmando().videos.filter((v) => v.icuModuleId === moduleId).map((v) => v.icuTopicId));
}

export const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** Privacy-enhanced embed; loaded only after the user taps play. */
export const ytEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
