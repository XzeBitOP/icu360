import type { RespiratoryPatient } from "@/sim/types";

/** Patient respiratory muscle pressure P_mus(t), cmH2O, positive = inspiratory effort (spec §49). Independent of ventilator pressure. */
export type EffortModel = {
  amplitudeCmH2O: number;
  rateBpm: number;
  /** Duration of each effort, s. */
  durationSec: number;
  /** Delay of the first effort onset after t = 0, s. */
  onsetSec: number;
  /** 0..1 sinusoidal irregularity of the effort interval. */
  irregularity: number;
};

export function effortFromPatient(p: RespiratoryPatient): EffortModel {
  return {
    amplitudeCmH2O: p.musclePressureAmplitudeCmH2O,
    rateBpm: p.spontaneousRateBpm,
    durationSec: 0.8,
    onsetSec: 1.0,
    irregularity: 0,
  };
}

/** Onset time (s) of effort number k. */
export function effortOnsetSec(m: EffortModel, k: number): number {
  const period = 60 / Math.max(m.rateBpm, 1);
  return m.onsetSec + k * period + m.irregularity * 0.25 * period * Math.sin(k * 2.399963);
}

/** Muscle pressure at time tSec (half-sine for each effort). */
export function musclePressure(m: EffortModel, tSec: number): number {
  if (m.amplitudeCmH2O <= 0) return 0;
  const period = 60 / Math.max(m.rateBpm, 1);
  const k = Math.floor((tSec - m.onsetSec + period * 0.5) / period);
  for (let j = Math.max(0, k - 1); j <= k + 1; j++) {
    const on = effortOnsetSec(m, j);
    const x = (tSec - on) / m.durationSec;
    if (x >= 0 && x <= 1) return m.amplitudeCmH2O * Math.sin(Math.PI * x);
  }
  return 0;
}
