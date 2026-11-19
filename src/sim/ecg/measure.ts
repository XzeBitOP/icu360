import type { BeatElectrophysiology } from "@/sim/cardiac-ep";
import type { EcgEngine } from "./engine";

export type QtcFormula = "bazett" | "fridericia";

export type IntervalMeasurements = {
  /** Beat index the measurement refers to. */
  beatIndex: number;
  conducted: boolean;
  prMs: number | null;
  pDurationMs: number;
  qrsMs: number | null;
  qtMs: number | null;
  /** RR (QRS onset to previous QRS onset), ms. null for the first conducted beat. */
  rrMs: number | null;
  /** PP (P onset to previous P onset), ms. */
  ppMs: number | null;
  heartRateBpm: number | null;
  atrialRateBpm: number | null;
  qtcMs: number | null;
  qtcBazettMs: number | null;
  qtcFridericiaMs: number | null;
  formula: QtcFormula;
};

export const bazett = (qtMs: number, rrMs: number) => qtMs / Math.sqrt(rrMs / 1000);
export const fridericia = (qtMs: number, rrMs: number) => qtMs / Math.cbrt(rrMs / 1000);

/** Intervals read from event timings of one beat (spec §14.7), relative to the previous beat for RR/PP. */
export function measureBeat(beat: BeatElectrophysiology, prev: BeatElectrophysiology | null, prevConducted: BeatElectrophysiology | null, formula: QtcFormula): IntervalMeasurements {
  const f = beat.fiducials;
  const prMs = f.qrsOnsetMs !== undefined ? f.qrsOnsetMs - f.pOnsetMs : null;
  const qrsMs = f.qrsOnsetMs !== undefined && f.qrsEndMs !== undefined ? f.qrsEndMs - f.qrsOnsetMs : null;
  const qtMs = f.qrsOnsetMs !== undefined && f.tEndMs !== undefined ? f.tEndMs - f.qrsOnsetMs : null;
  const rrMs = f.qrsOnsetMs !== undefined && prevConducted?.fiducials.qrsOnsetMs !== undefined ? f.qrsOnsetMs - prevConducted.fiducials.qrsOnsetMs : null;
  const ppMs = prev ? f.pOnsetMs - prev.fiducials.pOnsetMs : null;
  const qtcB = qtMs !== null && rrMs !== null ? bazett(qtMs, rrMs) : null;
  const qtcF = qtMs !== null && rrMs !== null ? fridericia(qtMs, rrMs) : null;
  return {
    beatIndex: beat.index,
    conducted: beat.conductedToVentricles,
    prMs, pDurationMs: f.pEndMs - f.pOnsetMs, qrsMs, qtMs, rrMs, ppMs,
    heartRateBpm: rrMs ? 60000 / rrMs : null,
    atrialRateBpm: ppMs ? 60000 / ppMs : null,
    qtcMs: formula === "bazett" ? qtcB : qtcF,
    qtcBazettMs: qtcB, qtcFridericiaMs: qtcF, formula,
  };
}

/** Latest fully completed conducted beat at time t. */
export function measurementsAt(engine: EcgEngine, t: number, formula?: QtcFormula): IntervalMeasurements | null {
  const f = formula ?? engine.config.qtcFormula;
  const beats = engine.beats.map((b) => b.ep);
  let idx = -1;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const end = b.fiducials.tEndMs ?? b.fiducials.pEndMs;
    if (end <= t) idx = i;
  }
  if (idx < 0) return null;
  let prevConducted: BeatElectrophysiology | null = null;
  for (let i = idx - 1; i >= 0; i--) if (beats[i].conductedToVentricles) { prevConducted = beats[i]; break; }
  return measureBeat(beats[idx], idx > 0 ? beats[idx - 1] : null, prevConducted, f);
}

/** QRS frontal-plane axis (degrees, hexaxial convention) from the net QRS area in leads I and aVF, from the engine's own samples. */
export function frontalQrsAxisDeg(engine: EcgEngine, beat: BeatElectrophysiology): number | null {
  const on = beat.fiducials.qrsOnsetMs;
  const end = beat.fiducials.qrsEndMs;
  if (on === undefined || end === undefined) return null;
  let aI = 0, aF = 0;
  for (let t = on; t <= end; t += 5) {
    aI += engine.leadAt(0, t);
    aF += engine.leadAt(5, t);
  }
  return (Math.atan2(aF, aI) * 180) / Math.PI;
}

/** Paper calibration (spec §13). */
export type PaperCalibration = { speedMmPerS: 25 | 50; gainMmPerMv: 5 | 10 | 20 };
export const paperMmPerMs = (cal: PaperCalibration) => cal.speedMmPerS / 1000;
export const smallSquareMs = (cal: PaperCalibration) => 1 / paperMmPerMs(cal);
export const largeSquareMs = (cal: PaperCalibration) => 5 / paperMmPerMs(cal);
export const smallSquareMv = (cal: PaperCalibration) => 1 / cal.gainMmPerMv;
export const largeSquareMv = (cal: PaperCalibration) => 5 / cal.gainMmPerMv;
