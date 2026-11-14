"use client";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const muted = "text-ink-500 dark:text-night-muted";

export function decimalsOf(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/** Glass pill number field with −/+ buttons (mockup: infusion calculator). */
export function Stepper({ label, value, onChange, unit, step = 1, min, max, hint, id }: { label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; min?: number; max?: number; hint?: string; id: string }) {
  const dec = decimalsOf(step);
  const [text, setText] = useState(value.toFixed(dec));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // value changed from outside (preset, unit switch): adjust during render instead of in an effect
    setSeen(value);
    if (Number(text) !== value) setText(value.toFixed(dec));
  }
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const bump = (d: number) => {
    const v = clamp(Math.round((value + d * step) * 1e6) / 1e6);
    onChange(v);
    setText(v.toFixed(dec));
  };
  const out = (min !== undefined && value < min) || (max !== undefined && value > max);
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold px-1">{label}</label>
      <div className={`glass-strong mt-1.5 flex items-center h-[56px] rounded-full px-2 ${out ? "ring-2 ring-warn-bright" : ""}`}>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-1)} className="glass-btn w-10 h-10 rounded-full grid place-items-center shrink-0"><Minus className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" /></button>
        <span className="flex-1 flex items-baseline justify-center min-w-0">
          <input id={id} inputMode="decimal" type="number" step={step} value={text}
            onChange={(e) => { setText(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
            className="w-[7ch] bg-transparent text-center font-mono text-[20px] font-semibold tnum outline-none" />
          {unit ? <span className={`text-[13px] ${muted} ml-1 truncate`}>{unit}</span> : null}
        </span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(1)} className="glass-btn w-10 h-10 rounded-full grid place-items-center shrink-0"><Plus className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" /></button>
      </div>
      {hint || out ? <p className={`text-[12px] ${out ? "text-warn dark:text-warn-bright font-semibold" : muted} mt-1.5 px-1`}>{out ? `Outside the expected range (${min ?? "–"} to ${max ?? "–"})` : hint}</p> : null}
    </div>
  );
}

export function stepFor(def: number | undefined, min?: number, max?: number) {
  const ref = def ?? max ?? min ?? 1;
  const a = Math.abs(ref);
  if (a === 0) return 1;
  if (a < 0.2) return 0.01;
  if (a < 2) return 0.1;
  if (a < 20 && !Number.isInteger(ref)) return 0.1;
  if (a < 20) return 1;
  return 1;
}
