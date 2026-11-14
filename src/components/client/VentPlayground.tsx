"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { OctagonAlert, TriangleAlert, CircleCheck } from "lucide-react";
import { simulate, type Mode, type VentSettings } from "@/lib/vent";

const muted = "text-ink-500 dark:text-night-muted";

const PRESETS: { name: string; s: Partial<VentSettings> }[] = [
  { name: "Normal lungs", s: { mode: "VC", vt: 450, pinsp: 12, peep: 5, rr: 14, ti: 1.0, compliance: 50, resistance: 10, pause: 0.2 } },
  { name: "ARDS", s: { mode: "VC", vt: 400, pinsp: 18, peep: 12, rr: 24, ti: 0.8, compliance: 22, resistance: 12, pause: 0.2 } },
  { name: "Asthma / COPD", s: { mode: "VC", vt: 500, pinsp: 15, peep: 5, rr: 22, ti: 1.0, compliance: 60, resistance: 30, pause: 0.2 } },
  { name: "Lung-protective ARDS", s: { mode: "VC", vt: 360, pinsp: 15, peep: 12, rr: 26, ti: 0.75, compliance: 25, resistance: 10, pause: 0.2 } },
  { name: "Pressure control", s: { mode: "PC", vt: 450, pinsp: 15, peep: 8, rr: 18, ti: 1.0, compliance: 35, resistance: 12, pause: 0 } },
];

function Slider({ label, value, min, max, step, unit, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between px-1">
        <span className="text-[13px] font-semibold">{label}</span>
        <span><span className="font-mono text-[15px] font-semibold tnum text-brand-700 dark:text-glow-teal">{fmt ? fmt(value) : value}</span><span className={`text-[12px] ${muted} ml-1`}>{unit}</span></span>
      </span>
      <input type="range" className="slider mt-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ["--pct" as string]: `${pct}%` }} aria-label={label} />
    </label>
  );
}

const W = 600;
const H = 96;

function Trace({ data, total, min, max, color, label, unit, cursorRef, zero }: { data: [number, number][]; total: number; min: number; max: number; color: string; label: string; unit: string; cursorRef: (el: SVGGElement | null) => void; zero?: boolean }) {
  const y = (v: number) => H - 6 - ((v - min) / (max - min)) * (H - 12);
  const d = data.map(([t, v], i) => `${i ? "L" : "M"}${((t / total) * W).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${d}L${W},${y(zero ? 0 : min)}L0,${y(zero ? 0 : min)}Z`;
  return (
    <div className="relative">
      <div className="absolute left-3 top-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color }}>{label} <span className="text-white/45 normal-case tracking-normal">{unit}</span></div>
      <div className="absolute right-3 top-1.5 text-[10px] font-mono text-white/40">{Math.round(max)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[92px] block" aria-hidden="true">
        {zero ? <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.12)" strokeDasharray="4 4" /> : null}
        <path d={area} fill={color} opacity=".12" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <g ref={cursorRef}>
          <rect x="0" y="0" width="22" height={H} fill="#070C16" />
          <line x1="0" x2="0" y1="0" y2={H} stroke="rgba(255,255,255,.5)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}

export function VentPlayground() {
  const [s, setS] = useState<VentSettings>({ mode: "VC", vt: 450, pinsp: 12, peep: 5, rr: 14, ti: 1.0, compliance: 50, resistance: 10, pause: 0.2, heightCm: 170, sex: "male" });
  const set = <K extends keyof VentSettings>(k: K, v: VentSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const r = useMemo(() => simulate(s, 2, 0.01), [s]);
  const total = r.cycle * 2;
  const pMax = Math.max(30, Math.ceil((r.peak + 5) / 5) * 5);
  const fMax = Math.max(40, Math.ceil(Math.max(r.peakInspFlow, ...r.samples.map((x) => -x.flow)) / 10) * 10 + 10);
  const vMax = Math.max(300, Math.ceil((r.vtDelivered * 1.15) / 100) * 100);
  const cursors = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const t = (((now - t0) / 1000) % total) / total;
      const x = t * W;
      cursors.current.forEach((g) => g?.setAttribute("transform", `translate(${x.toFixed(1)},0)`));
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    else cursors.current.forEach((g) => g?.setAttribute("transform", `translate(${W + 30},0)`));
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const P = r.samples.map((x) => [x.t, x.p] as [number, number]);
  const F = r.samples.map((x) => [x.t, x.flow] as [number, number]);
  const V = r.samples.map((x) => [x.t, x.vol] as [number, number]);
  const stats: [string, string, string, boolean?][] = [
    ["Peak", r.peak.toFixed(0), "cmH₂O"],
    ["Plateau", r.plateau.toFixed(0), "cmH₂O", r.plateau > 30],
    ["Driving P", r.drivingPressure.toFixed(0), "cmH₂O", r.drivingPressure > 15],
    ["Total PEEP", r.totalPeep.toFixed(1), "cmH₂O", r.autoPeep >= 1],
    ["Tidal vol", r.vtDelivered.toFixed(0), "mL"],
    ["mL/kg PBW", r.vtPerKg ? r.vtPerKg.toFixed(1) : "–", "", (r.vtPerKg ?? 0) > 8],
    ["Minute vent", r.minuteVentilation.toFixed(1), "L/min"],
    ["I:E", r.ie, ""],
    ["τ (RC)", r.tau.toFixed(2), "s"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => setS((x) => ({ ...x, ...p.s }))} className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold glass-chip text-ink-700 dark:text-night-text">{p.name}</button>
        ))}
      </div>

      <div className="rounded-[26px] overflow-hidden ring-1 ring-white/10" style={{ background: "linear-gradient(180deg,#0B1322,#070C16)", boxShadow: "0 22px 46px -18px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)" }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/60">{s.mode === "VC" ? "Volume control" : "Pressure control"} · {s.rr}/min</p>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</span>
        </div>
        <div className="divide-y divide-white/5">
          <Trace data={P} total={total} min={0} max={pMax} color="#FDE047" label="Paw" unit="cmH₂O" cursorRef={(el) => { cursors.current[0] = el; }} />
          <Trace data={F} total={total} min={-fMax} max={fMax} color="#4ADE80" label="Flow" unit="L/min" zero cursorRef={(el) => { cursors.current[1] = el; }} />
          <Trace data={V} total={total} min={0} max={vMax} color="#7DD3FC" label="Volume" unit="mL" cursorRef={(el) => { cursors.current[2] = el; }} />
        </div>
        <div className="grid grid-cols-3 border-t border-white/10">
          {stats.map(([l, v, u, bad], i) => (
            <div key={l} className={`px-3 py-2.5 ${i % 3 ? "border-l border-white/10" : ""} ${i >= 3 ? "border-t border-white/10" : ""}`}>
              <p className="text-[10.5px] uppercase tracking-[.08em] text-white/50 font-semibold">{l}</p>
              <p className={`font-mono font-semibold text-[18px] tnum ${bad ? "text-amber-300" : "text-white"}`}>{v}<span className="text-[11px] text-white/50 ml-1 font-sans">{u}</span></p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {r.warnings.length ? r.warnings.map((w) => (
          <motion.div key={w.text.slice(0, 20)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`callout ${w.level} rounded-[18px] pl-5 pr-4 py-3 flex items-start gap-2`}>
            <span className={`bar ${w.level === "crit" ? "bg-crit" : "bg-warn-bright"}`} />
            {w.level === "crit" ? <OctagonAlert className="w-4 h-4 mt-0.5 text-crit dark:text-crit-bright shrink-0" aria-hidden="true" /> : <TriangleAlert className="w-4 h-4 mt-0.5 text-warn dark:text-warn-bright shrink-0" aria-hidden="true" />}
            <p className="text-[13.5px] font-medium leading-snug">{w.text}</p>
          </motion.div>
        )) : (
          <div className="callout ok rounded-[18px] pl-5 pr-4 py-3 flex items-start gap-2"><span className="bar bg-ok" /><CircleCheck className="w-4 h-4 mt-0.5 text-ok dark:text-ok-bright shrink-0" aria-hidden="true" /><p className="text-[13.5px] font-medium">No alarms: pressures, volumes and expiration look safe for this lung.</p></div>
        )}
      </div>

      <section className="glass rounded-[24px] p-4 space-y-4">
        <div className="seg grid grid-cols-2 gap-1 p-1 rounded-full" role="radiogroup" aria-label="Mode">
          {(["VC", "PC"] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={s.mode === m} onClick={() => set("mode", m)} className={`py-2.5 rounded-full text-[13px] font-semibold ${s.mode === m ? "tab-active text-brand-700 dark:text-glow-teal" : muted}`}>{m === "VC" ? "Volume control" : "Pressure control"}</button>
          ))}
        </div>
        <h2 className="display text-[16px] font-semibold px-1">Ventilator</h2>
        {s.mode === "VC" ? <Slider label="Tidal volume" value={s.vt} min={200} max={800} step={10} unit="mL" onChange={(v) => set("vt", v)} /> : <Slider label="Inspiratory pressure (above PEEP)" value={s.pinsp} min={5} max={35} step={1} unit="cmH₂O" onChange={(v) => set("pinsp", v)} />}
        <Slider label="PEEP" value={s.peep} min={0} max={20} step={1} unit="cmH₂O" onChange={(v) => set("peep", v)} />
        <Slider label="Rate" value={s.rr} min={6} max={40} step={1} unit="/min" onChange={(v) => set("rr", v)} />
        <Slider label="Inspiratory time" value={s.ti} min={0.4} max={2.5} step={0.05} unit={`s · I:E ${r.ie}`} onChange={(v) => set("ti", v)} fmt={(v) => v.toFixed(2)} />
        {s.mode === "VC" ? <Slider label="Inspiratory pause" value={s.pause ?? 0} min={0} max={0.5} step={0.05} unit="s" onChange={(v) => set("pause", v)} fmt={(v) => v.toFixed(2)} /> : null}
        <h2 className="display text-[16px] font-semibold px-1 pt-2">Patient</h2>
        <Slider label="Compliance" value={s.compliance} min={10} max={100} step={1} unit="mL/cmH₂O" onChange={(v) => set("compliance", v)} />
        <Slider label="Airway resistance" value={s.resistance} min={5} max={40} step={1} unit="cmH₂O/L/s" onChange={(v) => set("resistance", v)} />
        <Slider label="Height" value={s.heightCm ?? 170} min={140} max={200} step={1} unit="cm" onChange={(v) => set("heightCm", v)} />
        <div className="seg grid grid-cols-2 gap-1 p-1 rounded-full" role="radiogroup" aria-label="Sex for predicted body weight">
          {(["male", "female"] as const).map((x) => (
            <button key={x} role="radio" aria-checked={s.sex === x} onClick={() => set("sex", x)} className={`py-2 rounded-full text-[13px] font-semibold ${s.sex === x ? "tab-active text-brand-700 dark:text-glow-teal" : muted}`}>{x === "male" ? "Male" : "Female"}{r.pbw && s.sex === x ? ` · PBW ${r.pbw.toFixed(0)} kg` : ""}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
