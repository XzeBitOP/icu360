#!/usr/bin/env node
/**
 * Runs before `next dev` / `next build`. Reads content/ and writes:
 *   src/generated/catalog.json   compact module/topic/tool list for client components (progress, stats, badges)
 *   src/generated/view-keys.json every valid view-counter key (the API rejects anything else)
 *   public/search-index.json     client-side search index (no review flags)
 *   public/precache.json         every static route, for "download for offline"
 *   public/sw.js                 service worker with a fresh cache version
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const C = (p) => path.join(ROOT, "content", p);
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const modDir = C("modules");
const modules = fs
  .readdirSync(modDir)
  .filter((d) => fs.existsSync(path.join(modDir, d, "module.json")))
  .map((d) => read(path.join(modDir, d, "module.json")))
  .sort((a, b) => a.number - b.number);
const index = read(C("shared/modules-index.json"));
const calcs = read(C("shared/calculators.json")).calculators;

const TOOLS = [
  { id: "abg", name: "ABG interpreter", category: "interactive" },
  { id: "ventilator", name: "Ventilator playground", category: "interactive" },
  { id: "code-timer", name: "Code timer", category: "interactive" },
];

const catalog = {
  sections: index.sections,
  modules: modules.map((m) => ({
    id: m.id,
    n: m.number,
    title: m.title,
    section: m.section.id,
    phase: m.phase,
    icon: m.uiHints.icon,
    topics: m.topics.map((t) => [t.id, t.title]),
    quizCount: m.topics.reduce((n, t) => n + t.quiz.length, 0),
  })),
  tools: [...TOOLS, ...calcs.map((c) => ({ id: c.id, name: c.name, category: c.category }))],
};

const viewKeys = [
  ...modules.map((m) => m.viewKey),
  ...modules.flatMap((m) => m.topics.map((t) => t.viewKey)),
  ...catalog.tools.map((t) => `tool:${t.id}`),
];

const strip = (s = "") => String(s).replace(/\*\*|__|`|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
const search = [];
for (const m of modules) {
  search.push({ type: "module", title: m.title, sub: `Module ${m.number} · ${m.section.title}`, href: `/m/${m.id}`, k: strip([m.summary, ...(m.tags || [])].join(" ")) });
  for (const t of m.topics) {
    const b = t.bedside;
    const words = [t.summary, ...(b.steps || []).map((s) => s.title), ...(b.tables || []).flatMap((tb) => [tb.title, ...tb.rows.flat()]), ...(b.doseCards || []).map((d) => d.role)];
    search.push({ type: "topic", title: t.title, sub: m.title, href: `/m/${m.id}/${t.id}`, k: strip(words.join(" ")).slice(0, 1200) });
  }
  for (const d of m.drugs) {
    search.push({ type: "drug", title: d.name, sub: `${d.class} · ${m.title}`, href: `/m/${m.id}#drug-${d.id}`, k: strip(`${d.id} ${d.indications}`).slice(0, 300) });
  }
}
for (const c of calcs) search.push({ type: "calculator", title: c.name, sub: `Calculator · ${c.category}`, href: `/tools/${c.id}`, k: strip(c.description) });
search.push({ type: "tool", title: "ABG interpreter", sub: "Interactive tool", href: "/tools/abg", k: "blood gas acid base anion gap delta ratio winters compensation" });
search.push({ type: "tool", title: "Ventilator playground", sub: "Interactive tool", href: "/tools/ventilator", k: "ventilator waveforms peep tidal volume plateau driving pressure auto-peep compliance resistance" });
search.push({ type: "tool", title: "Code timer", sub: "Interactive tool", href: "/tools/code-timer", k: "cardiac arrest cpr acls adrenaline rhythm check timer" });

const routes = [
  "/", "/browse", "/tools", "/tools/abg", "/tools/ventilator", "/tools/code-timer", "/news", "/quiz", "/saved", "/progress", "/search", "/offline", "/search-index.json",
  ...index.sections.map((s) => `/section/${s.id.toLowerCase()}`),
  ...modules.flatMap((m) => [`/m/${m.id}`, `/m/${m.id}/quiz`, ...m.topics.map((t) => `/m/${m.id}/${t.id}`)]),
  ...calcs.map((c) => `/tools/${c.id}`),
];

fs.mkdirSync(path.join(ROOT, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src/generated/catalog.json"), JSON.stringify(catalog));
fs.writeFileSync(path.join(ROOT, "src/generated/view-keys.json"), JSON.stringify(viewKeys));
fs.writeFileSync(path.join(ROOT, "public/search-index.json"), JSON.stringify(search));

const contentHash = crypto.createHash("sha1");
for (const f of ["views.json", "news/news.json", "quiz/daily.json", "shared/calculators.json"]) if (fs.existsSync(C(f))) contentHash.update(fs.readFileSync(C(f)));
for (const m of modules) contentHash.update(JSON.stringify(m));
const version = `${new Date().toISOString().slice(0, 10)}-${contentHash.digest("hex").slice(0, 8)}-${(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)}`;
fs.writeFileSync(path.join(ROOT, "public/precache.json"), JSON.stringify({ version, routes }));

const tpl = fs.readFileSync(path.join(ROOT, "scripts/sw-template.js"), "utf8");
fs.writeFileSync(path.join(ROOT, "public/sw.js"), tpl.replace("__SW_VERSION__", version));
console.log(`prebuild: ${modules.length} modules, ${search.length} search entries, ${routes.length} routes, ${viewKeys.length} view keys, sw ${version}`);
