"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Calculator, FileText, Mic, Pill, Search, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMounted } from "./useMounted";

interface Entry { type: "module" | "topic" | "drug" | "calculator" | "tool"; title: string; sub: string; href: string; k: string }
const muted = "text-ink-500 dark:text-night-muted";
const TYPE_ICON = { module: BookOpen, topic: FileText, drug: Pill, calculator: Calculator, tool: Wrench };
const TYPE_W = { tool: 1.3, calculator: 1.2, module: 1.15, topic: 1.1, drug: 1 };
const FILTERS: [string, string][] = [["all", "All"], ["topic", "Topics"], ["drug", "Drugs"], ["calculator", "Calculators"], ["module", "Modules"]];

/** Lower-case, strip accents, and fold British spellings (haem/hem, oedema/edema) so both spellings match. */
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.+\- ]/g, " ").replace(/ae/g, "e").replace(/oe/g, "e");

/** Small edit-distance check so "hyperkalemia" finds "hyperkalaemia" and typos still work. */
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

function score(e: Entry & { _t: string; _k: string; _w: string[] }, terms: string[]) {
  let total = 0;
  for (const t of terms) {
    let s = 0;
    if (e._t === t) s = 100;
    else if (e._t.startsWith(t)) s = 60;
    else if (e._t.includes(t)) s = 40;
    else if (e._k.includes(t)) s = 15;
    else if (t.length >= 4 && e._w.some((w) => w.length >= 4 && close(t, w.slice(0, t.length + 1)))) s = 8;
    if (!s) return 0;
    total += s;
  }
  return total * TYPE_W[e.type];
}

type SR = { start(): void; stop(): void; lang: string; interimResults: boolean; onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function SearchView({ quick }: { quick: { label: string; href: string; urgent?: boolean }[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [typed, setQ] = useState<string | null>(null);
  const q = typed ?? (mounted ? new URLSearchParams(window.location.search).get("q") ?? "" : "");
  const [f, setF] = useState("all");
  const [data, setData] = useState<(Entry & { _t: string; _k: string; _w: string[] })[] | null>(null);
  const [err, setErr] = useState(false);
  const [listening, setListening] = useState(false);
  const [sel, setSel] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const rec = useRef<SR | null>(null);

  useEffect(() => {
    inp.current?.focus();
    fetch("/search-index.json")
      .then((r) => r.json())
      .then((d: Entry[]) => setData(d.map((e) => ({ ...e, _t: norm(e.title), _k: norm(`${e.title} ${e.sub} ${e.k}`), _w: norm(`${e.title} ${e.k}`).split(/\s+/) }))))
      .catch(() => setErr(true));
  }, []);

  const canMic = mounted && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!data || !terms.length) return [];
    return data
      .filter((e) => f === "all" || e.type === f)
      .map((e) => ({ e, s: score(e, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.e);
  }, [q, f, data]);

  const mic = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new C();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => { setQ(e.results[0][0].transcript); setSel(0); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="space-y-4">
      <div className="glass-strong blur-glass flex items-center gap-3 h-[54px] pl-4 pr-2 rounded-full focus-within:ring-2 focus-within:ring-brand-500/50">
        <Search className="w-5 h-5 text-ink-400 shrink-0" strokeWidth={2} aria-hidden="true" />
        <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} aria-label="Search ICU 360"
          placeholder="Drug, condition, calculator…" className="flex-1 min-w-0 bg-transparent !outline-none !shadow-none text-[16px] placeholder:text-ink-400 dark:placeholder:text-night-muted"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && results[sel]) router.push(results[sel].href);
          }} />
        {q ? <button type="button" aria-label="Clear" onClick={() => { setQ(""); inp.current?.focus(); }} className="w-9 h-9 grid place-items-center rounded-full text-ink-400"><X className="w-4 h-4" aria-hidden="true" /></button> : null}
        {canMic ? (
          <button type="button" aria-label={listening ? "Stop listening" : "Search by voice"} onClick={mic} className={`w-10 h-10 grid place-items-center rounded-full ${listening ? "bg-crit text-white animate-pulse" : "glass-chip text-brand-700 dark:text-glow-teal"}`}><Mic className="w-[18px] h-[18px]" aria-hidden="true" /></button>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {FILTERS.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setF(v)} className={`${f === v ? "tab-active text-ink-900 dark:text-night-text" : `glass-chip ${muted}`} shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold`}>{l}</button>
        ))}
      </div>

      {err ? <p className={`glass rounded-[20px] p-4 text-[14px] ${muted}`}>Search is not available offline yet. Open it once while online.</p> : null}

      {!q.trim() ? (
        <section>
          <p className={`text-[12px] uppercase tracking-[.1em] font-semibold ${muted} mb-2 px-1`}>Quick access</p>
          <div className="flex flex-wrap gap-2">
            {quick.map((c) => (
              <Link key={c.href} href={c.href} className={`glass-chip rounded-full px-3.5 py-2 text-[13px] font-semibold ${c.urgent ? "text-crit dark:text-crit-bright" : ""}`}>{c.label}</Link>
            ))}
          </div>
          <p className={`text-[12.5px] ${muted} mt-4 px-1`}>Tip: press Ctrl K anywhere to jump here. Both spellings work, so hyperkalemia finds hyperkalaemia.</p>
        </section>
      ) : data && !results.length ? (
        <p className={`glass rounded-[20px] p-4 text-[14px] ${muted}`}>Nothing found for “{q}”. Try a drug name, a condition or a score.</p>
      ) : (
        <ul className="glass-strong rounded-[22px] overflow-hidden" role="listbox" aria-label="Results">
          {results.map((r, i) => {
            const I = TYPE_ICON[r.type];
            return (
              <li key={`${r.href}-${i}`} role="option" aria-selected={i === sel}>
                <Link href={r.href} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-ink-200/60 dark:border-white/10" : ""} ${i === sel ? "bg-white/40 dark:bg-white/5" : ""}`}>
                  <span className="glass-chip w-9 h-9 rounded-[12px] grid place-items-center text-brand-700 dark:text-glow-teal shrink-0"><I className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" /></span>
                  <span className="flex-1 min-w-0"><span className="block font-semibold text-[14.5px] truncate">{r.title}</span><span className={`block text-[12.5px] ${muted} truncate`}>{r.sub}</span></span>
                  <span className={`text-[11px] uppercase tracking-[.08em] font-semibold ${muted} shrink-0`}>{r.type}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
