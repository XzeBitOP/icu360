import { clampBpm } from "@/sim/ecg";
import type { ChamberOverride, HeartScene } from "@/components/sim3d/heart/HeartScene";
import { getEngine, getRunner, useEcgStore } from "./store";

export type HeartSimApi = {
  /** Sinus (atrial) rate, 40–180 bpm: drives the ECG engine. */
  setBPM: (bpm: number) => number;
  /** "Normal sinus", "AF", "2:1 AV block", "VT", "LBBB", "RBBB". AF and VT are not simulated yet and return ok:false. */
  setRhythm: (mode: string) => { ok: boolean; message: string };
  /** Manual override of chamber contraction 0..1 (labelled as an override in the UI). Call with no argument to return to the simulation. */
  setChamberState: (state?: ChamberOverride | null) => ChamberOverride | null;
  getState: () => { timeMs: number; rate: number; rhythm: string | null; manual: ChamberOverride | null };
  scene?: HeartScene | null;
};

declare global { interface Window { HeartSim?: HeartSimApi } }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function installHeartSim(getScene: () => HeartScene | null): () => void {
  const st = () => useEcgStore.getState();
  const api: HeartSimApi = {
    setBPM: (bpm) => { const b = clampBpm(Number(bpm)); st().setRate(b); return b; },
    setRhythm: (mode) => st().selectRhythm(mode),
    setChamberState: (state) => {
      if (!state) { st().setManual(null); return null; }
      const next: ChamberOverride = { ...(st().manual ?? {}) };
      for (const k of ["ra", "la", "rv", "lv"] as const) if (state[k] !== undefined && Number.isFinite(state[k])) next[k] = clamp01(Number(state[k]));
      st().setManual(next);
      return next;
    },
    getState: () => ({ timeMs: getRunner().timeMs, rate: st().rate, rhythm: st().rhythmId ?? st().conditionId, manual: st().manual }),
    get scene() { return getScene(); },
  };
  window.HeartSim = api;
  void getEngine;
  return () => { if (window.HeartSim === api) delete window.HeartSim; };
}
