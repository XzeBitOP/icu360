"use client";
import { Lock } from "lucide-react";
import { useState } from "react";

const muted = "text-ink-500 dark:text-night-muted";
interface Data { generatedAt: string; thisWeek: string; lastWeek: string; all: Record<string, number>; week: Record<string, number>; prevWeek: Record<string, number> }

export function StatsView({ names }: { names: Record<string, string> }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<"week" | "prevWeek" | "all">("week");
  const [kind, setKind] = useState("topic");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Failed"); else setData(j);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  if (!data) {
    return (
      <form onSubmit={submit} className="glass-strong rounded-[24px] p-5 space-y-3 max-w-[420px]">
        <div className="flex items-center gap-2 font-semibold"><Lock className="w-4 h-4" aria-hidden="true" />Owner access</div>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" placeholder="Stats password"
          className="w-full h-12 px-4 rounded-[14px] bg-white/70 dark:bg-white/5 border border-ink-200 dark:border-white/10 outline-none text-[16px]" />
        {err ? <p className="text-[13px] text-crit dark:text-crit-bright">{err}</p> : null}
        <button disabled={busy || !pw} className="w-full h-11 rounded-full text-white font-semibold disabled:opacity-50" style={{ background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)" }}>{busy ? "Checking…" : "Show stats"}</button>
      </form>
    );
  }
  const rec = data[view];
  const rows = Object.entries(rec).filter(([k]) => k.startsWith(`${kind}:`)).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([["week", `This week (${data.thisWeek})`], ["prevWeek", `Last week (${data.lastWeek})`], ["all", "All time"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${view === v ? "tab-active" : "glass-chip"}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["topic", "module", "tool"].map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold capitalize ${kind === k ? "tab-active" : "glass-chip"}`}>{k}s</button>
        ))}
      </div>
      <p className={`text-[12.5px] ${muted}`}>{rows.length} items · {total.toLocaleString("en-IN")} views · exact counts (the public site shows them rounded down)</p>
      <div className="glass-strong rounded-[22px] overflow-hidden">
        {rows.length ? rows.map(([k, v], i) => (
          <div key={k} className={`flex items-center gap-3 px-4 py-2.5 text-[13.5px] ${i ? "border-t border-ink-200/60 dark:border-white/10" : ""}`}>
            <span className={`w-7 font-mono text-[12px] ${muted}`}>{i + 1}</span>
            <span className="flex-1 min-w-0 truncate">{names[k] ?? k}</span>
            <span className="font-mono tnum font-semibold">{v.toLocaleString("en-IN")}</span>
          </div>
        )) : <p className={`p-4 text-[14px] ${muted}`}>No views recorded yet.</p>}
      </div>
    </div>
  );
}
