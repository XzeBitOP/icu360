import { ECG_LEADS } from "@/sim/types";
import { beatEndMs, nodeVm, type BeatElectrophysiology } from "@/sim/cardiac-ep";
import { DIPOLE_PAIRS } from "./dipoles";
import { leadVoltageFromDipole, vscale } from "./leads";

export const ECG_STEP_MS = 5;

/** Per-lead, per-dipole response coefficients (mV per unit ΔVm). Pure function of geometry; computed once. */
const COEFF: Float64Array[] = ECG_LEADS.map((lead) =>
  Float64Array.from(DIPOLE_PAIRS.map((d) => leadVoltageFromDipole(lead, vscale(d.dir, d.mass), d.source))),
);
export const DIPOLE_COEFFICIENTS = COEFF;

export type BeatSignal = {
  /** Time of sample 0 (multiple of ECG_STEP_MS). */
  startMs: number;
  stepMs: number;
  length: number;
  /** [lead][sample] mV */
  leads: Float32Array[];
};

export const signalWindow = (beat: BeatElectrophysiology) => {
  const start = Math.floor((beat.fiducials.pOnsetMs - 40) / ECG_STEP_MS) * ECG_STEP_MS;
  const end = Math.ceil((beatEndMs(beat) + 30) / ECG_STEP_MS) * ECG_STEP_MS;
  return { start, end };
};

/** Heart dipole vector at time t (Σ over dipole pairs), for the vector display. */
export function heartVectorAt(beat: BeatElectrophysiology, t: number): { x: number; y: number; z: number } {
  let x = 0, y = 0, z = 0;
  for (const d of DIPOLE_PAIRS) {
    const dv = nodeVm(beat, d.a, t) - nodeVm(beat, d.b, t);
    if (dv === 0) continue;
    x += d.dir.x * d.mass * dv;
    y += d.dir.y * d.mass * dv;
    z += d.dir.z * d.mass * dv;
  }
  return { x, y, z };
}

/** Synthesises the 12-lead signal of one beat from node activation (never from a stored waveform). */
export function synthesiseBeat(beat: BeatElectrophysiology): BeatSignal {
  const { start, end } = signalWindow(beat);
  const n = (end - start) / ECG_STEP_MS + 1;
  const leads = ECG_LEADS.map(() => new Float32Array(n));
  const dv = new Float64Array(DIPOLE_PAIRS.length);
  for (let i = 0; i < n; i++) {
    const t = start + i * ECG_STEP_MS;
    for (let k = 0; k < DIPOLE_PAIRS.length; k++) {
      const d = DIPOLE_PAIRS[k];
      dv[k] = nodeVm(beat, d.a, t) - nodeVm(beat, d.b, t);
    }
    for (let l = 0; l < ECG_LEADS.length; l++) {
      const c = COEFF[l];
      let v = 0;
      for (let k = 0; k < dv.length; k++) v += c[k] * dv[k];
      leads[l][i] = v;
    }
  }
  return { startMs: start, stepMs: ECG_STEP_MS, length: n, leads };
}
