import type { EcgConfig } from "./types";
import { computeBeat, applyOverrides, type BeatElectrophysiology } from "./activation";

export type RhythmState = {
  beatIndex: number;
  /** SA firing time of the previous beat (ms), null before the first beat. */
  lastSaMs: number | null;
  /** RR of previous conducted beat pair (QRS-to-QRS), used for rate adaptation of APD. */
  lastQrsMs: number | null;
  lastRrMs: number | null;
};

export const initialRhythmState = (): RhythmState => ({ beatIndex: 0, lastSaMs: null, lastQrsMs: null, lastRrMs: null });

/** Sinus interval (ms) for the beat following a beat fired at `prevSaMs`. */
export function sinusIntervalMs(config: EcgConfig, prevSaMs: number): number {
  const base = 60000 / config.sinusRateBpm;
  // Sinus arrhythmia: cyclic modulation tied to a 4 s respiratory period; deterministic in time.
  const mod = (config.sinusVariabilityPct / 100) * Math.sin((2 * Math.PI * prevSaMs) / 4000);
  return base * (1 + mod);
}

/** AV conduction model: returns AV nodal delay for this atrial beat, or null when the AV node fails to conduct it. */
export function avConduction(config: EcgConfig, atrialIndex: number): number | null {
  const base = config.avNodalDelayMs;
  const b = config.avBlock;
  switch (b.type) {
    case "none":
      return base;
    case "mobitzI": {
      const L = Math.max(2, Math.round(b.groupLength));
      const c = atrialIndex % L;
      if (c === L - 1) return null;
      let d = base;
      for (let j = 0; j < c; j++) d += b.incrementMs * Math.max(0.25, 1 - 0.2 * j);
      return d;
    }
    case "mobitzII": {
      const n = Math.max(2, Math.round(b.dropEvery));
      return (atrialIndex + 1) % n === 0 ? null : base;
    }
    case "fixed": {
      const r = Math.max(1, Math.round(b.ratio));
      return atrialIndex % r === 0 ? base : null;
    }
  }
}

export function nextBeat(config: EcgConfig, state: RhythmState, notBeforeMs = 0): { beat: BeatElectrophysiology; state: RhythmState } {
  const saRaw = state.lastSaMs === null ? config.firstSinusMs : state.lastSaMs + sinusIntervalMs(config, state.lastSaMs);
  const saMs = Math.max(saRaw, notBeforeMs);
  const av = avConduction(config, state.beatIndex);
  const beat = computeBeat(config, state.beatIndex, saMs, av, state.lastRrMs, applyOverrides(config));
  const qrs = beat.fiducials.qrsOnsetMs ?? null;
  let lastRr = state.lastRrMs;
  let lastQrs = state.lastQrsMs;
  if (qrs !== null) {
    if (lastQrs !== null) lastRr = qrs - lastQrs;
    lastQrs = qrs;
  }
  return { beat, state: { beatIndex: state.beatIndex + 1, lastSaMs: saMs, lastQrsMs: lastQrs, lastRrMs: lastRr } };
}
