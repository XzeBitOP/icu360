"use client";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { AntimicrobialCategory } from "../../data/antimicrobial.types";
import { CATEGORIES, groupRows, searchAntimicrobials, type AmRow } from "../../lib/antimicrobial-search";
import { useMounted } from "./useMounted";

const muted = "text-ink-500 dark:text-night-muted";
const LABEL: Record<AntimicrobialCategory, string> = { Antibacterial: "Antibacterials", Antiviral: "Antivirals", Antifungal: "Antifungals", Antiparasitic: "Antiparasitics" };

function Row({ r, first, sub }: { r: AmRow; first: boolean; sub: string }) {
  return (
    <li>
      <Link href={`/antimicrobials/${r.id}`} className={`flex items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-ink-200/60 dark:border-white/10"}`}>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-[14.5px] leading-snug truncate">{r.name}</span>
            {r.investigational ? <span className="glass-chip shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-warn dark:text-warn-bright">Investigational</span> : null}
          </span>
          <span className={`block text-[12.5px] ${muted} truncate`}>{sub}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

const brandLine = (r: AmRow) => (r.brands.length ? r.brands.slice(0, 3).join(", ") : r.route.join(" · "));

export function AntimicrobialList({ rows }: { rows: AmRow[] }) {
  const mounted = useMounted();
  const [typed, setQ] = useState<string | null>(null);
  const q = typed ?? (mounted ? new URLSearchParams(window.location.search).get("q") ?? "" : "");
  const [cat, setCat] = useState<AntimicrobialCategory | "all">("all");
  const inp = useRef<HTMLInputElement>(null);

  const scoped = useMemo(() => (cat === "all" ? rows : rows.filter((r) => r.category === cat)), [rows, cat]);
  const results = useMemo(() => (q.trim() ? searchAntimicrobials(scoped, q) : null), [scoped, q]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, rows.filter((r) => r.category === c).length])), [rows]);

  return (
    <div className="space-y-5">
      <div className="glass-strong blur-glass flex items-center gap-3 h-[54px] pl-4 pr-2 rounded-full focus-within:ring-2 focus-within:ring-brand-500/50">
        <Search className="w-5 h-5 text-ink-400 shrink-0" strokeWidth={2} aria-hidden="true" />
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} aria-label="Search antimicrobials"
          placeholder="Drug, brand, abbreviation, class…" className="flex-1 min-w-0 bg-transparent !outline-none !shadow-none text-[16px] placeholder:text-ink-400 dark:placeholder:text-night-muted" />
        {q ? <button type="button" aria-label="Clear" onClick={() => { setQ(""); inp.current?.focus(); }} className="w-9 h-9 grid place-items-center rounded-full text-ink-400"><X className="w-4 h-4" aria-hidden="true" /></button> : null}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Filter by group">
        {(["all", ...CATEGORIES] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={cat === v} onClick={() => setCat(v)}
            className={`${cat === v ? "tab-active text-ink-900 dark:text-night-text" : `glass-chip ${muted}`} shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold`}>
            {v === "all" ? "All" : v}{v !== "all" ? <span className="ml-1.5 tnum opacity-70">{counts[v]}</span> : null}
          </button>
        ))}
      </div>

      {results ? (
        results.length ? (
          <section>
            <p className={`text-[12px] uppercase tracking-[.1em] font-semibold ${muted} mb-2 px-1`}>{results.length} {results.length === 1 ? "match" : "matches"}</p>
            <ul className="glass-strong rounded-[22px] overflow-hidden" aria-label="Results">
              {results.map((r, i) => <Row key={r.id} r={r} first={i === 0} sub={`${r.drugClass} · ${brandLine(r)}`} />)}
            </ul>
          </section>
        ) : (
          <p className={`glass rounded-[20px] p-4 text-[14px] ${muted}`}>Nothing found for “{q}”. Try a generic name, Indian brand (Tazact, Meronem), abbreviation (CMS, L-AmB) or class.</p>
        )
      ) : (
        (cat === "all" ? CATEGORIES : [cat]).map((c) => (
          <section key={c} className="space-y-4">
            {cat === "all" ? <h2 className="display text-[22px] font-semibold px-1">{LABEL[c]} <span className={`text-[15px] font-medium ${muted} tnum`}>{counts[c]}</span></h2> : null}
            {groupRows(rows, c).map((g) => (
              <div key={g.drugClass}>
                <h3 className="text-[15px] font-semibold mb-2 px-1 flex items-baseline justify-between gap-2"><span>{g.drugClass}</span><span className={`text-[12px] font-medium ${muted} tnum`}>{g.count}</span></h3>
                <ul className="glass rounded-[24px] overflow-hidden">
                  {g.gens.map((gen, gi) => (
                    <li key={gen.generation ?? "-"}>
                      {g.gens.length > 1 ? <p className={`px-4 pt-3 pb-1 text-[11px] uppercase tracking-[.09em] font-semibold text-brand-600 dark:text-glow-teal ${gi ? "border-t border-ink-200/60 dark:border-white/10" : ""}`}>{gen.generation ?? "Other"}</p> : null}
                      <ul>{gen.rows.map((r, i) => <Row key={r.id} r={r} first={i === 0} sub={`${r.subclass} · ${brandLine(r)}`} />)}</ul>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
