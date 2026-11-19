import { EcgEngine } from "@/sim/ecg";
import type { BeatElectrophysiology, EcgConfig } from "@/sim/cardiac-ep";

export const ecg = (cfg: Partial<EcgConfig> = {}) => { const e = new EcgEngine(cfg); e.ensureUntil(20000); return e; };
export const beatN = (e: EcgEngine, n: number): BeatElectrophysiology => e.beats[n].ep;

/** Spatial QRS-like activity: sum of |lead| over the limb + precordial leads. Used only to verify fiducials against the signal. */
export function activity(e: EcgEngine, t: number): number {
  let s = 0;
  for (let l = 0; l < 12; l++) s += Math.abs(e.leadAt(l, t));
  return s;
}

/** Peak of one lead within [a, b] (signed extreme with the largest |value|). */
export function extreme(e: EcgEngine, lead: number, a: number, b: number): number {
  let best = 0;
  for (let t = a; t <= b; t += 5) { const v = e.leadAt(lead, t); if (Math.abs(v) > Math.abs(best)) best = v; }
  return best;
}
export const maxIn = (e: EcgEngine, lead: number, a: number, b: number) => { let m = -Infinity; for (let t = a; t <= b; t += 5) m = Math.max(m, e.leadAt(lead, t)); return m; };
export const minIn = (e: EcgEngine, lead: number, a: number, b: number) => { let m = Infinity; for (let t = a; t <= b; t += 5) m = Math.min(m, e.leadAt(lead, t)); return m; };
