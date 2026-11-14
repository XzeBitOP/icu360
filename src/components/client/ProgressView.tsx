"use client";
import Link from "next/link";
import { Award, Check, CloudDownload, Medal, RotateCcw, Sparkles, Trophy, WifiOff } from "lucide-react";
import { useState } from "react";
import { useMounted } from "./useMounted";
import { PASS_MARK, resetProgress, useStore } from "@/lib/store";
import { MODULES, SECTIONS, badges, moduleStatus, type Badge } from "@/lib/progress";
import { Ring } from "./Ring";
import { ThemeSegment } from "./ThemeToggle";

const muted = "text-ink-500 dark:text-night-muted";
const TONE: Record<Badge["tone"], { bg: string; Icon: typeof Award }> = {
  bronze: { bg: "linear-gradient(150deg,#F3B07A,#B8652B)", Icon: Medal },
  silver: { bg: "linear-gradient(150deg,#E5EAF0,#8C9AAB)", Icon: Award },
  gold: { bg: "linear-gradient(150deg,#FCD34D,#D97706)", Icon: Trophy },
  aurora: { bg: "linear-gradient(150deg,#14B8A6,#2563EB 55%,#7C3AED)", Icon: Sparkles },
};

export function ProgressView() {
  const s = useStore();
  const b = badges(s);
  const phases = [1, 2, 3].map((p) => {
    const list = MODULES.filter((m) => m.phase === p);
    return { p, total: list.length, done: list.filter((m) => moduleStatus(s, m).complete).length };
  });
  const topicsTotal = MODULES.reduce((a, m) => a + m.topics.length, 0);
  const topicsOpened = Object.keys(s.opened).length;

  return (
    <>
      <section className="glass-strong rounded-[28px] p-5 flex items-center gap-5">
        <Ring pct={(b.completed / b.total) * 100} size={118} stroke={10} label={`${b.completed}/${b.total}`} sub="modules" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="display font-semibold text-[19px] leading-tight">{b.completed === 0 ? "Your first shift starts here" : b.completed === b.total ? "ICU 360 Master" : "Keep going"}</p>
          <p className={`text-[13px] ${muted}`}>{topicsOpened} of {topicsTotal} topics opened</p>
          <p className={`text-[12.5px] ${muted}`}>A module is complete when every topic is opened and its quiz score is {PASS_MARK}% or more.</p>
        </div>
      </section>

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Badges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {b.badges.map((x) => {
            const t = TONE[x.tone];
            return (
              <div key={x.id} className={`glass rounded-[22px] p-4 text-center ${x.earned ? "" : "opacity-80"}`}>
                <span className={`mx-auto w-14 h-14 rounded-full grid place-items-center text-white ${x.earned ? "" : "grayscale opacity-50"}`} style={{ background: t.bg, boxShadow: "inset 0 1px 0 rgba(255,255,255,.55),0 8px 18px -8px rgba(0,0,0,.45)" }}>
                  <t.Icon className="w-7 h-7" strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="font-semibold text-[14px] mt-2.5">{x.name}</p>
                <p className={`text-[11.5px] ${muted} leading-snug mt-0.5`}>{x.desc}</p>
                <p className={`text-[11.5px] font-mono tnum mt-1.5 ${x.earned ? "text-ok dark:text-ok-bright font-semibold" : muted}`}>{x.earned ? "Earned" : `${x.have}/${x.need}`}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-[24px] p-4 space-y-3.5">
        {phases.map((ph) => (
          <div key={ph.p}>
            <div className="flex justify-between text-[13.5px]"><span className="font-semibold">Phase {ph.p}</span><span className={`font-mono tnum ${muted}`}>{ph.done}/{ph.total}</span></div>
            <div className="h-2 rounded-full bg-ink-200/70 dark:bg-white/10 mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(ph.done / ph.total) * 100}%`, background: "linear-gradient(90deg,#14B8A6,#2563EB)" }} /></div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Modules</h2>
        <div className="space-y-4">
          {SECTIONS.map((sec) => {
            const list = MODULES.filter((m) => m.section === sec.id);
            if (!list.length) return null;
            return (
              <div key={sec.id} className="glass-strong rounded-[22px] overflow-hidden">
                <p className={`px-4 pt-3 pb-1 text-[11.5px] uppercase tracking-[.1em] font-semibold ${muted}`}>{sec.id} · {sec.title}</p>
                {list.map((m) => {
                  const st = moduleStatus(s, m);
                  return (
                    <Link key={m.id} href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 border-t border-ink-200/60 dark:border-white/10 first-of-type:border-t-0">
                      <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${st.complete ? "bg-ok text-white" : "border-2 border-ink-300 dark:border-white/20"}`}>{st.complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /> : null}</span>
                      <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{m.title}</span>
                      <span className={`text-[12px] font-mono tnum ${muted} shrink-0`}>{st.opened}/{st.total}{st.best !== null ? ` · ${st.best}%` : ""}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <OfflineDownload />

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Appearance</h2>
        <ThemeSegment />
      </section>

      <button type="button" onClick={() => { if (confirm("Reset all progress, quiz scores and streak on this device? Saved items are kept.")) resetProgress(); }}
        className={`glass-chip rounded-full px-4 py-2.5 text-[13px] font-semibold inline-flex items-center gap-2 ${muted}`}>
        <RotateCcw className="w-4 h-4" aria-hidden="true" />Reset progress
      </button>
    </>
  );
}

function OfflineDownload() {
  type St = "idle" | "busy" | "done" | "error" | "unsupported";
  const [picked, setSt] = useState<St | null>(null);
  const [pct, setPct] = useState(0);
  const mounted = useMounted();
  const st: St = picked ?? (!mounted ? "idle" : !("serviceWorker" in navigator) ? "unsupported" : localStorage.getItem("icu360:offline") ? "done" : "idle");
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error("no sw");
      setSt("busy"); setPct(0);
      const ch = new MessageChannel();
      ch.port1.onmessage = (e: MessageEvent<{ type: string; done?: number; total?: number }>) => {
        if (e.data.type === "progress" && e.data.total) setPct(Math.round(((e.data.done ?? 0) / e.data.total) * 100));
        if (e.data.type === "done") { setSt("done"); localStorage.setItem("icu360:offline", new Date().toISOString()); }
        if (e.data.type === "error") setSt("error");
      };
      reg.active.postMessage({ type: "precache-all" }, [ch.port2]);
    } catch {
      setSt("error");
    }
  };
  return (
    <section className="glass rounded-[24px] p-4 flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-[14px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)" }}>{st === "done" ? <WifiOff className="w-5 h-5" aria-hidden="true" /> : <CloudDownload className="w-5 h-5" aria-hidden="true" />}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14.5px]">{st === "done" ? "Available offline" : "Download for offline use"}</p>
        <p className={`text-[12.5px] ${muted}`}>
          {st === "busy" ? `Saving all modules and tools… ${pct}%` : st === "done" ? "All modules and tools are saved on this device. Tap to refresh." : st === "error" ? "Could not finish. Install the app or reload, then try again." : st === "unsupported" ? "This browser does not support offline mode." : "Every module, algorithm and calculator, for the ward with no signal (about 12 MB to download)."}
        </p>
        {st === "busy" ? <div className="h-1.5 rounded-full bg-ink-200/70 dark:bg-white/10 mt-2 overflow-hidden"><div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} /></div> : null}
      </div>
      {st !== "unsupported" && st !== "busy" ? <button type="button" onClick={go} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)" }}>{st === "done" ? "Update" : "Download"}</button> : null}
    </section>
  );
}
