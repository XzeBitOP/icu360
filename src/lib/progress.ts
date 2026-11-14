import catalog from "@/generated/catalog.json";
import type { StoreState } from "./store";

export interface CatalogModule { id: string; n: number; title: string; section: string; phase: number; icon: string; topics: [string, string][]; quizCount: number }
export const MODULES = catalog.modules as CatalogModule[];
export const SECTIONS = catalog.sections as { id: string; title: string }[];
export const TOOLS = catalog.tools as { id: string; name: string; category: string }[];

export function moduleStatus(s: StoreState, m: CatalogModule) {
  const opened = m.topics.filter(([t]) => s.opened[`${m.id}/${t}`]).length;
  const best = s.quiz[m.id] ?? null;
  const quizPassed = best !== null && best >= 70;
  return { opened, total: m.topics.length, best, quizPassed, complete: opened === m.topics.length && quizPassed, started: opened > 0 || best !== null };
}

export interface Badge { id: string; name: string; desc: string; need: number; have: number; earned: boolean; tone: "bronze" | "silver" | "gold" | "aurora" }

export function badges(s: StoreState): { badges: Badge[]; completed: number; total: number } {
  const done = MODULES.filter((m) => moduleStatus(s, m).complete);
  const p1 = MODULES.filter((m) => m.phase === 1);
  const p12 = MODULES.filter((m) => m.phase <= 2);
  const doneIds = new Set(done.map((m) => m.id));
  const count = (list: CatalogModule[]) => list.filter((m) => doneIds.has(m.id)).length;
  const list: Badge[] = [
    { id: "first-shift", name: "First Shift", desc: "Complete your first module", need: 1, have: Math.min(1, done.length), earned: done.length >= 1, tone: "bronze" },
    { id: "bedside-ready", name: "Bedside Ready", desc: `Complete all ${p1.length} Phase 1 modules`, need: p1.length, have: count(p1), earned: count(p1) === p1.length, tone: "silver" },
    { id: "icu-navigator", name: "ICU Navigator", desc: `Complete all ${p12.length} Phase 1 and 2 modules`, need: p12.length, have: count(p12), earned: count(p12) === p12.length, tone: "gold" },
    { id: "icu-360-master", name: "ICU 360 Master", desc: `Complete all ${MODULES.length} modules`, need: MODULES.length, have: done.length, earned: done.length === MODULES.length, tone: "aurora" },
  ];
  return { badges: list, completed: done.length, total: MODULES.length };
}
