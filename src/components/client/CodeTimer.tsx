"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Syringe, Zap, HeartPulse, Check } from "lucide-react";
import { Ring } from "./Ring";
import { useMounted } from "./useMounted";

const muted = "text-ink-500 dark:text-night-muted";
const CYCLE = 120; // s

type Ev = { t: number; what: string };
interface S { running: boolean; startedAt: number | null; elapsedBefore: number; cycleStart: number; cycles: number; adr: number[]; shocks: number; log: Ev[]; hsts: string[] }
const INIT: S = { running: false, startedAt: null, elapsedBefore: 0, cycleStart: 0, cycles: 1, adr: [], shocks: 0, log: [], hsts: [] };
const KEY = "icu360:code-timer";
const HSTS = ["Hypoxia", "Hypovolaemia", "Hypo/hyperkalaemia, metabolic", "Hypothermia", "Thrombosis (coronary or PE)", "Tension pneumothorax", "Tamponade", "Toxins"];

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function load(): S {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...INIT, ...JSON.parse(raw) };
  } catch {}
  return INIT;
}

/** Rendered only after mount: the timer state lives in sessionStorage. */
export function CodeTimer() {
  return useMounted() ? <Timer /> : <div className="glass-hero rounded-[28px] h-[152px]" />;
}

function Timer() {
  const [s, setS] = useState<S>(load);
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef(-1);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s]);

  const elapsed = s.elapsedBefore + (s.running && s.startedAt ? (now - s.startedAt) / 1000 : 0);
  const inCycle = Math.max(0, elapsed - s.cycleStart);
  const cycleLeft = Math.max(0, CYCLE - inCycle);
  const checkDue = s.startedAt !== null && inCycle >= CYCLE;
  const lastAdr = s.adr.length ? elapsed - s.adr[s.adr.length - 1] : null;
  const adrState = lastAdr === null ? "none" : lastAdr >= 300 ? "late" : lastAdr >= 180 ? "due" : "ok";

  useEffect(() => {
    if (checkDue && alerted.current !== s.cycles) {
      alerted.current = s.cycles;
      try { navigator.vibrate?.([300, 150, 300]); } catch {}
    }
  }, [checkDue, s.cycles]);

  const log = (what: string, extra: Partial<S> = {}) => setS((x) => ({ ...x, ...extra, log: [{ t: elapsed, what }, ...x.log] }));
  const start = () => setS((x) => ({ ...x, running: true, startedAt: Date.now(), log: x.startedAt === null && !x.log.length ? [{ t: 0, what: "Arrest recognised · CPR started" }] : x.log }));
  const pause = () => setS((x) => ({ ...x, running: false, elapsedBefore: elapsed, startedAt: Date.now() }));
  const reset = () => { if (confirm("Reset the code timer and clear the log?")) { setS(INIT); alerted.current = -1; } };
  const rhythm = () => log(`Rhythm check ${s.cycles} · next cycle`, { cycleStart: elapsed, cycles: s.cycles + 1 });
  const shock = () => {
    const n = s.shocks + 1;
    const extra = n === 3 ? " · give amiodarone 300 mg IV + adrenaline 1 mg" : n === 5 ? " · amiodarone 150 mg IV" : "";
    log(`Shock ${n}${extra}`, { shocks: n });
  };
  const adr = () => log(`Adrenaline 1 mg IV (dose ${s.adr.length + 1})`, { adr: [...s.adr, elapsed] });
  const started = s.startedAt !== null || s.elapsedBefore > 0;

  return (
    <div className="space-y-5">
      <section className="glass-hero blur-glass rounded-[28px] p-5">
        <div className="flex items-center gap-5">
          <div className="ct-ring"><Ring pct={(inCycle / CYCLE) * 100} size={112} stroke={9} label={mmss(cycleLeft)} sub={`cycle ${s.cycles}`} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] uppercase tracking-[.12em] font-semibold text-white/70">Total time</p>
            <p className="font-mono font-semibold tnum text-[46px] leading-none mt-1">{mmss(elapsed)}</p>
            <div className="flex gap-2 mt-3">
              {s.running ? (
                <button type="button" onClick={pause} className="h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ background: "rgba(255,255,255,.2)" }}><Pause className="w-4 h-4" aria-hidden="true" />Pause</button>
              ) : (
                <button type="button" onClick={start} className="h-10 px-4 rounded-full bg-white text-ink-900 text-[13px] font-semibold inline-flex items-center gap-1.5"><Play className="w-4 h-4" aria-hidden="true" />{started ? "Resume" : "Start"}</button>
              )}
              <button type="button" onClick={reset} aria-label="Reset" className="h-10 w-10 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,.14)" }}><RotateCcw className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <style>{`.ct-ring svg circle:first-of-type{stroke:rgba(255,255,255,.18)}.ct-ring p{color:rgba(255,255,255,.8)!important}.ct-ring p.font-mono{color:#fff!important}`}</style>
      </section>

      <AnimatePresence>
        {checkDue && s.running ? (
          <motion.button type="button" onClick={rhythm} initial={{ opacity: 0, y: -8 }} animate={{ opacity: [1, 0.75, 1], y: 0 }} transition={{ opacity: { repeat: Infinity, duration: 1.2 } }} exit={{ opacity: 0 }}
            className="callout crit w-full rounded-[22px] pl-5 pr-4 py-4 text-left">
            <span className="bar bg-crit" />
            <p className="text-[12px] font-bold uppercase tracking-[.07em] text-crit dark:text-crit-bright">2 minutes · rhythm check now</p>
            <p className="font-semibold text-[16px] mt-1">Pause compressions &lt; 10 s, check rhythm, change compressor. Tap when done.</p>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={adr} disabled={!started}
          className={`rounded-[22px] p-3.5 text-left disabled:opacity-40 ${adrState === "late" ? "callout crit" : adrState === "due" ? "callout warn" : "glass-strong"}`}>
          <Syringe className="w-5 h-5 text-brand-700 dark:text-glow-teal" aria-hidden="true" />
          <p className="font-semibold text-[14px] mt-2">Adrenaline</p>
          <p className={`text-[12px] ${muted} tnum`}>{lastAdr === null ? "1 mg IV/IO" : `${mmss(lastAdr)} ago${adrState === "due" ? " · due" : adrState === "late" ? " · overdue" : ""}`}</p>
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={shock} disabled={!started} className="glass-strong rounded-[22px] p-3.5 text-left disabled:opacity-40">
          <Zap className="w-5 h-5 text-warn dark:text-warn-bright" aria-hidden="true" />
          <p className="font-semibold text-[14px] mt-2">Shock</p>
          <p className={`text-[12px] ${muted} tnum`}>{s.shocks} given</p>
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={rhythm} disabled={!started} className="glass-strong rounded-[22px] p-3.5 text-left disabled:opacity-40">
          <HeartPulse className="w-5 h-5 text-crit dark:text-crit-bright" aria-hidden="true" />
          <p className="font-semibold text-[14px] mt-2">Rhythm check</p>
          <p className={`text-[12px] ${muted} tnum`}>next in {mmss(cycleLeft)}</p>
        </motion.button>
      </div>

      <section className="glass rounded-[24px] p-4">
        <h2 className="display text-[16px] font-semibold mb-2">Reversible causes · 4 Hs and 4 Ts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {HSTS.map((h) => {
            const on = s.hsts.includes(h);
            return (
              <button key={h} type="button" onClick={() => setS((x) => ({ ...x, hsts: on ? x.hsts.filter((y) => y !== h) : [...x.hsts, h] }))} className={`flex items-center gap-2.5 px-3 py-2 rounded-[14px] text-left text-[13.5px] ${on ? "tab-active font-semibold" : ""}`}>
                <span className={`w-5 h-5 rounded-md grid place-items-center border-2 ${on ? "bg-ok border-ok text-white" : "border-ink-300 dark:border-white/25"}`}>{on ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" /> : null}</span>{h}
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-strong rounded-[22px] overflow-hidden">
        <h2 className="display text-[16px] font-semibold px-4 pt-3.5 pb-2">Event log</h2>
        {s.log.length ? (
          <ul>
            {s.log.map((e, i) => (
              <li key={i} className="flex gap-3 px-4 py-2.5 border-t border-ink-200/60 dark:border-white/10 text-[13.5px]"><span className="font-mono text-[13px] font-semibold text-brand-700 dark:text-glow-teal tnum w-12">{mmss(e.t)}</span><span className="flex-1">{e.what}</span></li>
            ))}
          </ul>
        ) : <p className={`px-4 pb-4 text-[13.5px] ${muted}`}>Press Start when you begin CPR. Every drug, shock and rhythm check is time-stamped here for the documentation.</p>}
      </section>
    </div>
  );
}
