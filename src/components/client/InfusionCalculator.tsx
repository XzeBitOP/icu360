"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { Stepper } from "./Stepper";

const muted = "text-ink-500 dark:text-night-muted";

/** Common Indian ICU syringe preparations (50 mL syringe). Typical ranges are for an out-of-range prompt only. */
const DRUGS = [
  { id: "noradrenaline", name: "Noradrenaline", concs: [[4, 80], [8, 160], [16, 320]], range: [0.01, 1], table: [0.05, 0.1, 0.2, 0.3, 0.5], dose: 0.1, step: 0.01, hint: "Titrate to MAP ≥ 65 mmHg · involve your senior as the dose rises" },
  { id: "adrenaline", name: "Adrenaline", concs: [[2, 40], [4, 80], [8, 160]], range: [0.01, 0.5], table: [0.02, 0.05, 0.1, 0.2, 0.3], dose: 0.05, step: 0.01, hint: "Inotrope/vasopressor infusion, not the arrest bolus" },
  { id: "dobutamine", name: "Dobutamine", concs: [[250, 5000], [500, 10000]], range: [2, 20], table: [2.5, 5, 7.5, 10, 15], dose: 5, step: 0.5, hint: "Start 2.5–5 mcg/kg/min; watch for tachyarrhythmia" },
  { id: "dopamine", name: "Dopamine", concs: [[200, 4000], [400, 8000]], range: [2, 20], table: [5, 7.5, 10, 15, 20], dose: 5, step: 0.5, hint: "Noradrenaline is preferred in septic shock" },
  { id: "milrinone", name: "Milrinone", concs: [[10, 200], [20, 400]], range: [0.125, 0.75], table: [0.125, 0.25, 0.375, 0.5, 0.75], dose: 0.375, step: 0.025, hint: "Reduce the dose in renal impairment; causes vasodilatation" },
] as const;

export function InfusionCalculator({ initialDrug = "noradrenaline" }: { initialDrug?: string }) {
  const [drugId, setDrugId] = useState<string>(DRUGS.some((d) => d.id === initialDrug) ? initialDrug : "noradrenaline");
  const drug = DRUGS.find((d) => d.id === drugId)!;
  const [mode, setMode] = useState<"dose" | "rate">("dose");
  const [conc, setConc] = useState<number>(drug.concs[0][1]);
  const [custom, setCustom] = useState(false);
  const [weight, setWeight] = useState(70);
  const [dose, setDose] = useState<number>(drug.dose);
  const [rate, setRate] = useState(5);

  const pick = (id: string) => {
    const d = DRUGS.find((x) => x.id === id)!;
    setDrugId(id);
    window.dispatchEvent(new CustomEvent("icu360:infusion-drug", { detail: d.name }));
    setConc(d.concs[0][1]);
    setCustom(false);
    setDose(d.dose);
  };

  const mlh = (dz: number) => (dz * weight * 60) / conc;
  const doseFromRate = (rate * conc) / (weight * 60);
  const curDose = mode === "dose" ? dose : doseFromRate;
  const curRate = mode === "dose" ? mlh(dose) : rate;
  const lasts = curRate > 0 ? 50 / curRate : Infinity;
  const outOfRange = curDose < drug.range[0] || curDose > drug.range[1];
  const dec = drug.step < 0.05 ? 2 : drug.step < 0.5 ? 3 : 1;
  const table = useMemo(() => drug.table.map((d) => [d, mlh(d)] as const), [drug, weight, conc]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {DRUGS.map((d) => (
          <button key={d.id} type="button" onClick={() => pick(d.id)} className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${d.id === drugId ? "tab-active text-brand-700 dark:text-glow-teal" : "glass-chip text-ink-700 dark:text-night-text"}`}>{d.name}</button>
        ))}
      </div>
      <div className="seg grid grid-cols-2 gap-1 p-1 rounded-full" role="radiogroup" aria-label="Direction">
        {([["dose", "Dose → mL/h"], ["rate", "mL/h → dose"]] as const).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={`py-2.5 rounded-full text-[13px] font-semibold ${mode === v ? "tab-active text-brand-700 dark:text-glow-teal" : muted}`}>{l}</button>
        ))}
      </div>
      <div>
        <p className="text-[13px] font-semibold px-1">Concentration</p>
        <div className={`grid ${drug.concs.length === 3 ? "grid-cols-3" : "grid-cols-3"} gap-2 mt-1.5`}>
          {drug.concs.map(([mg, c]) => {
            const on = !custom && conc === c;
            return (
              <button key={c} type="button" onClick={() => { setConc(c); setCustom(false); }} className={`${on ? "tab-active ring-2 ring-brand-500 dark:ring-glow-teal" : "glass"} rounded-[18px] px-2 py-3 text-center`}>
                <p className="whitespace-nowrap"><span className={`font-mono text-[15px] font-semibold ${on ? "text-brand-700 dark:text-glow-teal" : ""}`}>{mg}</span><span className={`text-[12px] ${muted}`}> mg / 50 mL</span></p>
                <p className={`text-[11.5px] ${muted} mt-0.5`}>{c} mcg/mL</p>
              </button>
            );
          })}
          {drug.concs.length < 3 ? (
            <button type="button" onClick={() => setCustom(true)} className={`${custom ? "tab-active ring-2 ring-brand-500 dark:ring-glow-teal" : "glass"} rounded-[18px] px-2 py-3 text-center`}>
              <p className="text-[14px] font-semibold">Custom</p><p className={`text-[11.5px] ${muted} mt-0.5`}>enter mcg/mL</p>
            </button>
          ) : null}
        </div>
        {drug.concs.length === 3 ? <button type="button" onClick={() => setCustom(true)} className="mt-2 px-1 text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">Use a different concentration</button> : null}
      </div>
      {custom ? <Stepper id="conc" label="Concentration" unit="mcg/mL" value={conc} onChange={(v) => setConc(Math.max(0.1, v))} step={10} min={1} hint="mg in syringe × 1000 ÷ syringe mL" /> : null}
      <Stepper id="weight" label="Weight" unit="kg" value={weight} onChange={setWeight} step={1} min={30} max={250} hint="Actual body weight" />
      {mode === "dose" ? (
        <Stepper id="dose" label="Dose" unit="mcg/kg/min" value={dose} onChange={setDose} step={drug.step} min={0} hint={drug.hint} />
      ) : (
        <Stepper id="rate" label="Pump rate" unit="mL/h" value={rate} onChange={setRate} step={0.1} min={0} hint="Read from the syringe pump" />
      )}

      <motion.section layout className="glass-hero blur-glass rounded-[28px] p-5" aria-live="polite">
        <p className="text-[12px] uppercase tracking-[.12em] font-semibold text-white/70">{mode === "dose" ? "Pump rate" : "Dose"}</p>
        <p className="mt-1">
          <span className="font-mono font-semibold tnum text-[52px] leading-none">{mode === "dose" ? curRate.toFixed(1) : curDose.toFixed(dec)}</span>
          <span className="text-[18px] font-semibold text-white/80 ml-2">{mode === "dose" ? "mL/h" : "mcg/kg/min"}</span>
        </p>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 text-[13px]">
          <div><p className="text-white/65">Total dose</p><p className="mt-0.5"><span className="font-mono font-semibold text-[16px]">{(curDose * weight).toFixed(curDose * weight < 10 ? 1 : 0)}</span><span className="text-white/80"> mcg/min</span></p></div>
          <div><p className="text-white/65">50 mL syringe lasts</p><p className="mt-0.5"><span className="font-mono font-semibold text-[16px]">{Number.isFinite(lasts) ? `≈ ${lasts.toFixed(1)}` : "–"}</span><span className="text-white/80"> h</span></p></div>
        </div>
      </motion.section>

      {outOfRange && curDose > 0 ? (
        <div className="callout warn rounded-[20px] pl-5 pr-4 py-3 flex items-start gap-2"><span className="bar bg-warn-bright" /><TriangleAlert className="w-4 h-4 mt-0.5 text-warn dark:text-warn-bright shrink-0" aria-hidden="true" /><p className="text-[13.5px] font-medium">Outside the usual range for {drug.name} ({drug.range[0]}–{drug.range[1]} mcg/kg/min). Re-check the numbers and discuss with your senior.</p></div>
      ) : null}

      <div className="glass rounded-[20px] px-4 py-3.5 text-[13px] leading-relaxed">
        <p className={muted}>{mode === "dose" ? "mL/h = dose × weight × 60 ÷ concentration" : "dose = mL/h × concentration ÷ (weight × 60)"}</p>
        <p className="font-mono mt-1">{mode === "dose" ? <>{dose} × {weight} × 60 ÷ {conc} = <b>{curRate.toFixed(2)}</b></> : <>{rate} × {conc} ÷ ({weight} × 60) = <b>{curDose.toFixed(3)}</b></>}</p>
      </div>

      <section>
        <h2 className="display text-[18px] font-semibold mb-2.5 px-1">Titration table <span className={`${muted} font-medium text-[14px]`}>· {weight} kg · {conc} mcg/mL</span></h2>
        <div className="glass-strong rounded-[22px] overflow-hidden">
          <div className={`grid grid-cols-2 px-4 py-2.5 text-[12px] font-semibold ${muted} border-b border-ink-200/70 dark:border-white/10`}><span>mcg/kg/min</span><span className="text-right">mL/h</span></div>
          {table.map(([d, r]) => {
            const hi = Math.abs(d - curDose) < 1e-9;
            return (
              <div key={d} className={`grid grid-cols-2 px-4 py-3 border-b last:border-0 border-ink-200/60 dark:border-white/10 font-mono text-[14.5px] tnum ${hi ? "bg-brand-50/80 dark:bg-glow-teal/10 text-brand-700 dark:text-glow-teal font-semibold" : ""}`}>
                <span>{d}</span><span className="text-right">{r.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="callout warn rounded-[20px] pl-5 pr-4 py-3.5">
        <span className="bar bg-warn-bright" />
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.07em] text-warn dark:text-warn-bright"><TriangleAlert className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />Double-check</p>
        <p className="mt-1.5 text-[14.5px] leading-[1.5] font-medium">Confirm the concentration matches the syringe label in your unit before starting the pump.</p>
      </div>
    </div>
  );
}

/** Large page title that follows the selected drug (mockup: "Noradrenaline"). */
export function InfusionTitle() {
  const [name, setName] = useState("Noradrenaline");
  useEffect(() => {
    const on = (e: Event) => setName((e as CustomEvent<string>).detail);
    window.addEventListener("icu360:infusion-drug", on);
    return () => window.removeEventListener("icu360:infusion-drug", on);
  }, []);
  return <>{name}</>;
}
