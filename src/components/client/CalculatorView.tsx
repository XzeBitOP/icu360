"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Calculator } from "@/lib/content-types";
import { evaluate } from "@/lib/formula";
import { Stepper, stepFor } from "./Stepper";

const muted = "text-ink-500 dark:text-night-muted";
export const BAND: Record<string, { bg: string; fg: string }> = {
  normal: { bg: "#47CD89", fg: "#0B1726" },
  mild: { bg: "#A6F4C5", fg: "#0B1726" },
  moderate: { bg: "#FDE272", fg: "#0B1726" },
  severe: { bg: "#FDB022", fg: "#0B1726" },
  critical: { bg: "#FF6B5E", fg: "#FFFFFF" },
};

function fmt(n: number, d: number) {
  if (!Number.isFinite(n)) return "–";
  return n.toFixed(d);
}

export function CalculatorView({ calc }: { calc: Calculator }) {
  const init = useMemo(() => {
    const v: Record<string, number> = {};
    for (const i of calc.inputs) {
      if (i.type === "number") v[i.id] = i.default ?? calc.example.inputs[i.id] ?? 0;
      else if (i.type === "select") v[i.id] = i.default ?? calc.example.inputs[i.id] ?? i.options?.[0]?.value ?? 0;
      else v[i.id] = 0;
    }
    return v;
  }, [calc]);
  const [vals, setVals] = useState(init);
  const set = (id: string, v: number) => setVals((x) => ({ ...x, [id]: v }));

  const vars = useMemo(() => {
    const o: Record<string, number> = {};
    for (const i of calc.inputs) o[i.id] = i.type === "boolean" ? (vals[i.id] ? i.points ?? 1 : 0) : vals[i.id];
    return o;
  }, [calc, vals]);
  let result = NaN;
  try { result = evaluate(calc.formula, vars); } catch { result = NaN; }
  const rounded = Number(fmt(result, calc.output.decimals));
  const band = calc.interpretation.find((b) => (b.min === undefined || rounded >= b.min) && (b.max === undefined || rounded < b.max));
  const allSelect = calc.inputs.every((i) => i.type === "select");
  const components = calc.id === "gcs" ? calc.inputs.map((i) => `${i.label[0]}${vals[i.id]}`).join(" ") : null;

  const hero = (
    <motion.div layout className="glass-hero blur-glass rounded-[26px] p-4 flex items-center gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[.12em] text-white/70 font-semibold">{calc.output.label}</p>
        <p className="leading-none mt-1"><span className="font-mono font-semibold text-[40px] tnum">{fmt(result, calc.output.decimals)}</span>{calc.output.unit ? <span className="text-white/70 text-[16px] font-semibold"> {calc.output.unit}</span> : null}</p>
      </div>
      {band || components ? (
        <div className="flex-1 border-l border-white/20 pl-4 min-w-0">
          {components ? <p className="font-mono text-[15px] font-semibold">{components}</p> : null}
          {band ? <p className="mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold leading-snug" style={{ background: BAND[band.severity]?.bg, color: BAND[band.severity]?.fg }}>{band.label}</p> : null}
        </div>
      ) : null}
    </motion.div>
  );

  return (
    <div className="space-y-5">
      <p className={`text-[14px] ${muted} px-1 leading-relaxed`}>{calc.description}</p>
      {calc.inputs.map((i) => {
        if (i.type === "number")
          return <Stepper key={i.id} id={`in-${i.id}`} label={i.label} unit={i.unit} value={vals[i.id]} onChange={(v) => set(i.id, v)} step={stepFor(i.default, i.min, i.max)} min={i.min} max={i.max} />;
        if (i.type === "select")
          return (
            <section key={i.id}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="display text-[17px] font-semibold">{i.label}</h2>
                {allSelect ? <span className="font-mono text-[14px] font-semibold text-brand-700 dark:text-glow-teal">{calc.id === "gcs" ? i.label[0] : ""}{vals[i.id]}</span> : null}
              </div>
              <div className="glass rounded-[22px] p-1.5 space-y-0.5" role="radiogroup" aria-label={i.label}>
                {i.options!.map((o) => {
                  const on = vals[i.id] === o.value;
                  return (
                    <button key={o.label} type="button" role="radio" aria-checked={on} onClick={() => set(i.id, o.value)} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[16px] ${on ? "tab-active" : ""}`}>
                      <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${on ? "border-brand-600 dark:border-glow-teal" : "border-ink-300 dark:border-white/25"}`}>{on ? <span className="w-2.5 h-2.5 rounded-full bg-brand-600 dark:bg-glow-teal" /> : null}</span>
                      <span className={`flex-1 text-[15px] ${on ? "font-semibold text-brand-800 dark:text-night-text" : ""}`}>{o.label}</span>
                      <span className={`font-mono text-[14px] font-semibold ${on ? "text-brand-700 dark:text-glow-teal" : "text-ink-400 dark:text-night-faint"}`}>{o.value}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        const on = !!vals[i.id];
        return (
          <button key={i.id} type="button" role="switch" aria-checked={on} onClick={() => set(i.id, on ? 0 : 1)} className={`w-full text-left glass rounded-[20px] px-4 py-3.5 flex items-center gap-3 ${on ? "ring-2 ring-brand-500/60 dark:ring-glow-teal/50" : ""}`}>
            <span className="flex-1 text-[14.5px] font-medium leading-snug">{i.label}</span>
            <span className={`font-mono text-[13px] font-semibold ${on ? "text-brand-700 dark:text-glow-teal" : "text-ink-400 dark:text-night-faint"}`}>+{i.points ?? 1}</span>
            <span className={`w-11 h-7 rounded-full p-0.5 transition-colors ${on ? "bg-brand-600 dark:bg-glow-teal" : "bg-ink-300/70 dark:bg-white/15"}`}><span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} /></span>
          </button>
        );
      })}
      {allSelect ? <div className="h-[110px]" aria-hidden="true" /> : hero}
      {allSelect ? <div className="fixed inset-x-3 bottom-[104px] lg:bottom-6 lg:left-auto lg:right-8 lg:w-[420px] z-20 max-w-[560px] mx-auto lg:mx-0">{hero}</div> : null}
      {calc.interpretation.length ? (
        <section className="glass-strong rounded-[22px] overflow-hidden">
          {calc.interpretation.map((b, k) => (
            <div key={k} className={`px-4 py-3 flex items-center gap-3 text-[13.5px] ${k ? "border-t border-ink-200/70 dark:border-white/10" : ""} ${band === b ? "bg-brand-50/80 dark:bg-glow-teal/10 font-semibold" : ""}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BAND[b.severity]?.bg }} />
              <span className="flex-1">{b.label}</span>
            </div>
          ))}
        </section>
      ) : null}
      <div className="glass rounded-[20px] px-4 py-3.5 text-[13px] leading-relaxed">
        <p className={muted}>Formula</p>
        <p className="font-mono mt-1 break-words">{calc.formula.replace(/Math\./g, "")}</p>
      </div>
    </div>
  );
}
