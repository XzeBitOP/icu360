"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { interpretAbg, validateAbg, type AbgInput, type Tone } from "@/lib/abg";
import { AiButton } from "./ai/AiTutor";
import { abgText, ctx } from "@/lib/ai/context";

const muted = "text-ink-500 dark:text-night-muted";
const EXAMPLES: { name: string; v: Record<string, string> }[] = [
  { name: "DKA", v: { ph: "7.18", pco2: "22", hco3: "8", na: "134", cl: "98", albumin: "" } },
  { name: "Diarrhoea", v: { ph: "7.28", pco2: "30", hco3: "14", na: "138", cl: "114", albumin: "" } },
  { name: "COPD", v: { ph: "7.34", pco2: "60", hco3: "31", na: "140", cl: "97", albumin: "" } },
  { name: "Vomiting", v: { ph: "7.52", pco2: "47", hco3: "38", na: "138", cl: "88", albumin: "" } },
  { name: "Septic, low albumin", v: { ph: "7.31", pco2: "34", hco3: "17", na: "136", cl: "107", albumin: "2.1" } },
];
const FIELDS: { id: keyof AbgInput; label: string; unit: string; ph?: string; optional?: boolean; step: string }[] = [
  { id: "ph", label: "pH", unit: "", ph: "7.40", step: "0.01" },
  { id: "pco2", label: "pCO₂", unit: "mmHg", ph: "40", step: "1" },
  { id: "hco3", label: "HCO₃⁻", unit: "mmol/L", ph: "24", step: "1" },
  { id: "na", label: "Na⁺", unit: "mmol/L", ph: "140", step: "1" },
  { id: "cl", label: "Cl⁻", unit: "mmol/L", ph: "104", step: "1" },
  { id: "albumin", label: "Albumin", unit: "g/dL", ph: "optional", optional: true, step: "0.1" },
];
const TONE: Record<Tone, { cls: string; bar: string; text: string }> = {
  ok: { cls: "callout ok", bar: "bg-ok", text: "text-ok dark:text-ok-bright" },
  info: { cls: "callout info", bar: "bg-info", text: "text-info dark:text-info-bright" },
  warn: { cls: "callout warn", bar: "bg-warn-bright", text: "text-warn dark:text-warn-bright" },
  crit: { cls: "callout crit", bar: "bg-crit", text: "text-crit dark:text-crit-bright" },
};

export function AbgInterpreter() {
  const [v, setV] = useState<Record<string, string>>(EXAMPLES[0].v);
  const input = useMemo(() => {
    const n = (k: string) => (v[k] !== undefined && v[k] !== "" ? Number(v[k]) : undefined);
    return { ph: n("ph"), pco2: n("pco2"), hco3: n("hco3"), na: n("na"), cl: n("cl"), albumin: n("albumin") };
  }, [v]);
  const ready = input.ph !== undefined && input.pco2 !== undefined && input.hco3 !== undefined;
  const clean: AbgInput | null = ready ? { ph: input.ph!, pco2: input.pco2!, hco3: input.hco3!, na: input.na, cl: input.na !== undefined ? input.cl : undefined, albumin: input.albumin } : null;
  if (clean && (clean.na === undefined || clean.cl === undefined)) { clean.na = undefined; clean.cl = undefined; }
  const errors = clean ? validateAbg(clean) : [];
  const res = clean && !errors.length ? interpretAbg(clean) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className={`text-[12px] ${muted} px-1 mb-1.5`}>Try an example</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
          {EXAMPLES.map((e) => (
            <button key={e.name} type="button" onClick={() => setV(e.v)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${JSON.stringify(e.v) === JSON.stringify(v) ? "tab-active text-brand-700 dark:text-glow-teal" : "glass-chip text-ink-700 dark:text-night-text"}`}>{e.name}</button>
          ))}
          <button type="button" onClick={() => setV({ ph: "", pco2: "", hco3: "", na: "", cl: "", albumin: "" })} className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold glass-chip text-ink-500 dark:text-night-muted">Clear</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <label key={f.id} className="glass-strong rounded-[20px] px-4 py-3 block">
            <span className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">{f.label}</span>
              <span className={`text-[11.5px] ${muted}`}>{f.unit}</span>
            </span>
            <input inputMode="decimal" type="number" step={f.step} placeholder={f.ph} value={v[f.id] ?? ""} onChange={(e) => setV((x) => ({ ...x, [f.id]: e.target.value }))}
              className="mt-1 w-full bg-transparent font-mono text-[22px] font-semibold tnum outline-none placeholder:text-ink-300 dark:placeholder:text-night-faint" aria-label={`${f.label} ${f.unit}`} />
          </label>
        ))}
      </div>
      {errors.length ? (
        <div className="callout warn rounded-[20px] pl-5 pr-4 py-3"><span className="bar bg-warn-bright" />{errors.map((e) => <p key={e} className="text-[13.5px] font-medium">{e}</p>)}</div>
      ) : null}
      {!ready ? <p className={`glass rounded-[20px] p-4 text-[14px] ${muted}`}>Enter pH, pCO₂ and HCO₃⁻ to start. Add Na⁺ and Cl⁻ for the anion gap, and albumin to correct it.</p> : null}
      {res ? (
        <>
          <motion.section layout className="glass-hero blur-glass rounded-[28px] p-5" aria-live="polite">
            <p className="text-[12px] uppercase tracking-[.12em] font-semibold text-white/70">Interpretation</p>
            <ul className="mt-2 space-y-1.5">
              {res.diagnoses.map((d, i) => <li key={d} className={`display font-semibold ${i === 0 ? "text-[22px] leading-tight" : "text-[16px] text-white/90"}`}>{i ? "+ " : ""}{d}</li>)}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 text-[13px] gap-2">
              <div><p className="text-white/65">Anion gap</p><p className="font-mono font-semibold text-[16px] mt-0.5">{res.ag !== undefined ? res.ag.toFixed(1) : "–"}</p></div>
              <div><p className="text-white/65">Corrected AG</p><p className="font-mono font-semibold text-[16px] mt-0.5">{res.correctedAg !== undefined ? res.correctedAg.toFixed(1) : "–"}</p></div>
              <div><p className="text-white/65">Delta ratio</p><p className="font-mono font-semibold text-[16px] mt-0.5">{res.deltaRatio !== undefined ? res.deltaRatio.toFixed(2) : "–"}</p></div>
            </div>
          </motion.section>
          <div className="flex justify-end -mt-2"><AiButton getContext={() => ctx("abg", `ABG: ${res.diagnoses[0] ?? "interpretation"}`, abgText(clean!, res))} label="Explain this ABG" testId="ai-abg" /></div>
          <ol className="space-y-3">
            <AnimatePresence initial={false}>
              {res.steps.map((s, i) => {
                const t = TONE[s.tone];
                return (
                  <motion.li key={`${s.id}-${s.result}`} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }} exit={{ opacity: 0 }} className={`${t.cls} rounded-[20px] pl-5 pr-4 py-3.5`}>
                    <span className={`bar ${t.bar}`} />
                    <p className={`text-[12px] font-bold uppercase tracking-[.06em] ${t.text}`}>{s.title}</p>
                    <p className="mt-1 font-semibold text-[15px] leading-snug">{s.result}</p>
                    {s.detail ? <p className={`mt-1 text-[13px] ${muted} leading-[1.5]`}>{s.detail}</p> : null}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </>
      ) : null}
    </div>
  );
}
