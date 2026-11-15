import type { Antimicrobial, AntimicrobialCategory } from "../data/antimicrobial.types";

/* Client-safe helpers (no data import), shared by the list UI, the server pages and the tests. */

export const CATEGORIES: AntimicrobialCategory[] = ["Antibacterial", "Antiviral", "Antifungal", "Antiparasitic"];

/** Investigational / not-approved agents are labelled as such and never show a dose. */
export function isInvestigational(a: Pick<Antimicrobial, "approvalStatus">) {
  return /investigational|not approved/i.test(a.approvalStatus);
}

/** "3rd generation (oral)" or "4th-gen cephalosporin + BLI" → "3rd generation" / "4th generation"; otherwise null. */
export function generationOf(subclass: string) {
  const m = /\b(\d)(st|nd|rd|th)[ -]gen/i.exec(subclass);
  return m ? `${m[1]}${m[2].toLowerCase()} generation` : null;
}

/** Compact row for the client list and search (the full record stays on the server-rendered detail page). */
export interface AmRow {
  id: string;
  name: string;
  category: AntimicrobialCategory;
  drugClass: string;
  subclass: string;
  generation: string | null;
  route: string[];
  brands: string[];
  aliases: string[];
  investigational: boolean;
  /** lower-case haystack: name, aliases, brands, abbreviations, class, subclass, indications */
  s: string;
}

export function toRow(a: Antimicrobial): AmRow {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    drugClass: a.drugClass,
    subclass: a.subclass,
    generation: generationOf(a.subclass),
    route: a.route,
    brands: a.brandsIndia,
    aliases: a.aliases,
    investigational: isInvestigational(a),
    s: norm(a.searchText),
  };
}

export interface ClassGroup { drugClass: string; gens: { generation: string | null; rows: AmRow[] }[]; count: number }

/** category → class → generation, classes in dataset order, drugs A–Z inside each group. */
export function groupRows(rows: AmRow[], category: AntimicrobialCategory): ClassGroup[] {
  const out: ClassGroup[] = [];
  for (const r of rows) {
    if (r.category !== category) continue;
    let g = out.find((x) => x.drugClass === r.drugClass);
    if (!g) out.push((g = { drugClass: r.drugClass, gens: [], count: 0 }));
    g.count++;
    let gen = g.gens.find((x) => x.generation === r.generation);
    if (!gen) g.gens.push((gen = { generation: r.generation, rows: [] }));
    gen.rows.push(r);
  }
  for (const g of out) {
    g.gens.sort((a, b) => (a.generation ?? "9").localeCompare(b.generation ?? "9"));
    for (const x of g.gens) x.rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

/** Lower-case, strip accents; keep + - . / so "pip-tazo" and "l-amb" stay intact. */
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.+\-/ ]/g, " ").replace(/\s+/g, " ").trim();
const squash = (s: string) => s.replace(/[^a-z0-9]/g, "");

function close(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n] <= (a.length > 7 ? 2 : 1);
}

type Prepared = AmRow & { _names: string[]; _sq: string[]; _cls: string; _words: string[] };
const cache = new WeakMap<AmRow[], Prepared[]>();
function prepare(rows: AmRow[]) {
  let p = cache.get(rows);
  if (!p) {
    p = rows.map((r) => {
      const names = [r.name, ...r.aliases, ...r.brands].map(norm);
      return { ...r, _names: names, _sq: names.map(squash), _cls: norm(`${r.drugClass} ${r.subclass}`), _words: [...new Set(r.s.split(" ").filter((w) => w.length >= 4))] };
    });
    cache.set(rows, p);
  }
  return p;
}

/** Instant client-side search: names, aliases, brands and abbreviations rank first, then class and indications; small typos tolerated. */
export function searchAntimicrobials(rows: AmRow[], query: string, limit = 60): AmRow[] {
  const terms = norm(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  const scored: { r: Prepared; s: number }[] = [];
  for (const r of prepare(rows)) {
    let total = 0;
    for (const t of terms) {
      const tq = squash(t);
      let s = 0;
      if (r._names.includes(t) || (tq.length >= 3 && r._sq.includes(tq))) s = 100;
      else if (r._names.some((n) => n.startsWith(t)) || (tq.length >= 3 && r._sq.some((n) => n.startsWith(tq)))) s = 60;
      else if (r._names.some((n) => n.includes(t))) s = 40;
      else if (r._cls.includes(t)) s = 25;
      else if (r.s.includes(t)) s = 15;
      else if (t.length >= 4 && r._names.some((n) => n.split(/[ \-/]/).some((w) => w.length >= 4 && (close(t, w) || close(t, w.slice(0, t.length + 1)))))) s = 30;
      else if (t.length >= 4 && r._words.some((w) => close(t, w.slice(0, t.length + 1)) || close(t, w))) s = 8;
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push({ r, s: total });
  }
  return scored.sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name)).slice(0, limit).map((x) => x.r);
}
