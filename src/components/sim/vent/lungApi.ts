import type { LungApiSettings } from "@/sim/vent";
import { lungVisual, type LungVisual } from "@/sim/vent";
import type { LungScene } from "@/components/sim3d/lung/LungScene";
import { getEngine, getRunner, useVentStore } from "./store";

export type LungSimApi = {
  /** vt (mL), peep (cmH₂O), rr (/min), fio2 (21–100 % or a fraction), ieRatio (0.5 or "1:2"), mode ("VC-CMV" | "PC-CMV" | "ARDS" | "COPD" | "pneumothorax"). */
  setVentilator: (s: LungApiSettings) => { ok: boolean; message: string };
  /** Per-lobe aeration 0..1 (1 = normal). e.g. { rul: 0.35, rml: 0.35, rll: 0.35 } collapses the right lung. */
  setLobeExpansion: (s: Partial<Record<"rul" | "rml" | "rll" | "lul" | "lll", number>>) => void;
  /** Telemetry read straight from the engine (Pplat/driving pressure only appear after a valid inspiratory hold). */
  getTelemetry: () => LungTelemetry;
  getState: () => LungVisual;
  scene?: LungScene | null;
};
export type LungTelemetry = { timeMs: number; phase: string; paw: number; flowLps: number; volumeL: number; ppeak: number | null; pplat: number | null; peepSet: number; peepTotal: number | null; drivingPressure: number | null; vtMl: number | null; rr: number; fio2: number };

declare global { interface Window { LungSim?: LungSimApi } }

export function readTelemetry(): LungTelemetry {
  const e = getEngine();
  const v = lungVisual(e);
  const b = e.breaths[e.breaths.length - 1];
  const held = [...e.breaths].reverse().slice(0, 40).find((x) => x.pplat.valid);
  return {
    timeMs: v.timeMs, phase: v.phase, paw: v.paw, flowLps: v.flowLps, volumeL: v.volumeL,
    ppeak: b?.ppeak ?? null, pplat: held?.pplat.value ?? null, peepSet: e.settings.peepCmH2O, peepTotal: e.breaths.slice(-40).reverse().find((x) => x.peepTotal.valid)?.peepTotal.value ?? null,
    drivingPressure: held?.drivingPressure.value ?? null, vtMl: b ? b.vteL * 1000 : null, rr: e.settings.rr, fio2: e.settings.fio2,
  };
}

export function installLungSim(getScene: () => LungScene | null): () => void {
  const st = () => useVentStore.getState();
  const api: LungSimApi = {
    setVentilator: (s) => st().apiSetVentilator(s),
    setLobeExpansion: (s) => st().setLobeAeration(s),
    getTelemetry: readTelemetry,
    getState: () => lungVisual(getEngine()),
    get scene() { return getScene(); },
  };
  window.LungSim = api;
  void getRunner;
  return () => { if (window.LungSim === api) delete window.LungSim; };
}
