import fs from "node:fs";
import path from "node:path";
import type { Calculator, CalculatorsFile, Module, ModulesIndex, Reference, Topic } from "./content-types";

/** Server-only content loader. Everything here runs at build time (static generation). */
const ROOT = path.join(process.cwd(), "content");

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

let _modules: Module[] | null = null;
export function getModules(): Module[] {
  if (_modules) return _modules;
  const dir = path.join(ROOT, "modules");
  _modules = fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "module.json")))
    .map((d) => readJson<Module>(`modules/${d}/module.json`))
    .sort((a, b) => a.number - b.number);
  return _modules;
}

export function getModule(id: string): Module | undefined {
  return getModules().find((m) => m.id === id);
}

export function getTopic(moduleId: string, topicId: string): { module: Module; topic: Topic } | undefined {
  const mod = getModule(moduleId);
  const topic = mod?.topics.find((t) => t.id === topicId);
  return mod && topic ? { module: mod, topic } : undefined;
}

export function getIndex(): ModulesIndex {
  return readJson<ModulesIndex>("shared/modules-index.json");
}

let _calcs: Calculator[] | null = null;
export function getCalculators(): Calculator[] {
  if (!_calcs) _calcs = readJson<CalculatorsFile>("shared/calculators.json").calculators;
  return _calcs;
}
export function getCalculator(id: string) {
  return getCalculators().find((c) => c.id === id);
}

export function refsById(module: Module, ids: string[] | undefined): Reference[] {
  if (!ids) return [];
  return ids.map((id) => module.references.find((r) => r.id === id)).filter((r): r is Reference => !!r);
}

/* ---------- sections ---------- */
export interface SectionInfo {
  id: string;
  letter: string;
  slug: string;
  title: string;
  icon: string;
  tagline: string;
  modules: Module[];
  topicCount: number;
}

const SECTION_META: Record<string, { icon: string; tagline: string; short: string }> = {
  A: { icon: "heart-pulse", tagline: "The first hour of the sickest patients", short: "Resuscitation & emergencies" },
  B: { icon: "wind", tagline: "Oxygen, airways and ventilators", short: "Airway & respiratory" },
  C: { icon: "activity", tagline: "Shock, rhythm and the failing heart", short: "Cardiovascular & haemodynamics" },
  D: { icon: "droplets", tagline: "Acid-base, electrolytes and the kidney", short: "Renal, fluids & metabolic" },
  E: { icon: "brain", tagline: "Seizures, strokes and raised pressure", short: "Neuro-critical care" },
  F: { icon: "droplet", tagline: "Bleeding, liver failure and clotting", short: "GI, liver & haematology" },
  G: { icon: "bug", tagline: "Fevers, resistant bugs and stewardship", short: "Infections" },
  H: { icon: "flask-conical", tagline: "Poisons, overdoses and envenomation", short: "Toxicology & envenomation" },
  I: { icon: "baby", tagline: "Pregnancy, children and the post-op patient", short: "Special populations" },
  J: { icon: "pill", tagline: "Drugs, sedation, nutrition and bundles", short: "ICU care & pharmacology" },
  K: { icon: "clipboard-check", tagline: "Procedures, interpretation and safety", short: "Skills & practice" },
};

export function getSections(): SectionInfo[] {
  const idx = getIndex();
  const mods = getModules();
  return idx.sections.map((s) => {
    const modules = mods.filter((m) => m.section.id === s.id);
    const meta = SECTION_META[s.id];
    return {
      id: s.id,
      letter: s.id,
      slug: s.id.toLowerCase(),
      title: meta?.short ?? s.title,
      icon: meta?.icon ?? "layers",
      tagline: meta?.tagline ?? "",
      modules,
      topicCount: modules.reduce((n, m) => n + m.topics.length, 0),
    };
  });
}

/* ---------- views, news, quiz ---------- */
export interface ViewsFile {
  updatedAt: string | null;
  week: string | null;
  note?: string;
  modules: Record<string, number>;
  topics: Record<string, number>;
  tools: Record<string, number>;
  topTopic: { moduleId: string; topicId: string; week: string } | null;
}
export function getViews(): ViewsFile {
  try {
    return readJson<ViewsFile>("views.json");
  } catch {
    return { updatedAt: null, week: null, modules: {}, topics: {}, tools: {}, topTopic: null };
  }
}

export interface NewsItem {
  id: string;
  date: string; // YYYY-MM-DD
  tag: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  moduleId?: string;
}
export function getNews(): NewsItem[] {
  try {
    const f = readJson<{ items: NewsItem[] }>("news/news.json");
    return [...f.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch {
    return [];
  }
}

export interface DailyQuestion {
  id: string;
  stem: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  reference?: { label: string; url: string };
  moduleId?: string;
  topicId?: string;
}
export interface DailySet {
  date: string;
  title?: string;
  questions: DailyQuestion[];
}
export function getDailyQuiz(): DailySet[] {
  try {
    const f = readJson<{ sets: DailySet[] }>("quiz/daily.json");
    return [...f.sets].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

/** href → public (rounded) view count, for client widgets. */
export function viewsByHref(): Record<string, number> {
  const v = getViews();
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.modules)) out[`/m/${id}`] = n;
  for (const [k, n] of Object.entries(v.topics)) out[`/m/${k}`] = n;
  for (const [id, n] of Object.entries(v.tools)) out[`/tools/${id}`] = n;
  return out;
}

export function sectionViews(s: { modules: Module[] }): number {
  const v = getViews();
  return s.modules.reduce((n, m) => n + (v.modules[m.id] ?? 0), 0);
}
