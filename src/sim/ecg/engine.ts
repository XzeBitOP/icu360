import type { SteppableEngine } from "@/sim/core";
import {
  DEFAULT_ECG_CONFIG, initialRhythmState, nextBeat, nodeVm,
  type BeatElectrophysiology, type EcgConfig, type RhythmState, type TissueNodeId,
} from "@/sim/cardiac-ep";
import { ECG_LEADS } from "@/sim/types";
import { ECG_STEP_MS, synthesiseBeat, type BeatSignal } from "./beatSignal";

export type EcgInput =
  | { type: "setConfig"; patch: Partial<EcgConfig> }
  | { type: "replaceConfig"; config: EcgConfig };

type BeatRecord = { ep: BeatElectrophysiology; signal: BeatSignal; stateBefore: RhythmState; notBeforeBefore: number };

export type EcgSnapshot = { timeMs: number; config: EcgConfig; beatCount: number; rhythm: RhythmState; notBeforeMs: number };

const LOOKAHEAD_MS = 2000;

/**
 * ECG simulation engine. Beats are scheduled as events (SA firing → conduction → activation) and the 12-lead signal is
 * synthesised from node activation. Output is a pure function of (config history, seed, time): deterministic.
 */
export class EcgEngine implements SteppableEngine<EcgSnapshot, EcgInput> {
  timeMs = 0;
  config: EcgConfig;
  private readonly initial: EcgConfig;
  beats: BeatRecord[] = [];
  private rhythm: RhythmState = initialRhythmState();
  private notBeforeMs = 0;

  constructor(config: Partial<EcgConfig> = {}) {
    this.initial = { ...DEFAULT_ECG_CONFIG, ...config };
    this.config = { ...this.initial };
    this.ensure(LOOKAHEAD_MS);
  }

  reset(): void {
    this.timeMs = 0;
    this.config = { ...this.initial };
    this.beats = [];
    this.rhythm = initialRhythmState();
    this.notBeforeMs = 0;
    this.ensure(LOOKAHEAD_MS);
  }

  step(stepMs: number): void {
    this.timeMs += stepMs;
    this.ensure(this.timeMs + LOOKAHEAD_MS);
  }

  apply(input: EcgInput): void {
    const next = input.type === "setConfig" ? { ...this.config, ...input.patch } : { ...input.config };
    this.config = next;
    // beats that have not fired yet are re-scheduled under the new configuration; in-flight beats are unaffected
    const t = this.timeMs;
    const keep = this.beats.findIndex((b) => b.ep.saMs > t);
    if (keep >= 0) {
      this.rhythm = this.beats[keep].stateBefore;
      this.beats.length = keep;
    }
    this.notBeforeMs = t + ECG_STEP_MS;
    this.ensure(t + LOOKAHEAD_MS);
  }

  snapshot(): EcgSnapshot {
    return { timeMs: this.timeMs, config: { ...this.config }, beatCount: this.beats.length, rhythm: { ...this.rhythm }, notBeforeMs: this.notBeforeMs };
  }

  restore(s: EcgSnapshot): void {
    this.timeMs = s.timeMs;
    this.config = { ...s.config };
    if (this.beats.length > s.beatCount) this.beats.length = s.beatCount;
    this.rhythm = { ...s.rhythm };
    this.notBeforeMs = s.notBeforeMs;
    this.ensure(this.timeMs + LOOKAHEAD_MS);
  }

  /** Pre-schedule beats up to the given time (used by tests, exports and the full-strip views). */
  ensureUntil(untilMs: number): void {
    this.ensure(untilMs);
  }

  private ensure(untilMs: number): void {
    for (;;) {
      const last = this.beats[this.beats.length - 1];
      if (last && last.ep.saMs >= untilMs) return;
      const before = this.rhythm;
      const { beat, state } = nextBeat(this.config, this.rhythm, this.notBeforeMs);
      this.beats.push({ ep: beat, signal: synthesiseBeat(beat), stateBefore: before, notBeforeBefore: this.notBeforeMs });
      this.rhythm = state;
      if (this.beats.length > 5000) throw new Error("beat schedule runaway");
    }
  }

  /** All beats whose electrical activity can overlap time t. */
  beatsAt(t: number): BeatElectrophysiology[] {
    const out: BeatElectrophysiology[] = [];
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i];
      if (b.signal.startMs > t) continue;
      if (t <= b.signal.startMs + (b.signal.length - 1) * b.signal.stepMs) out.push(b.ep);
      else if (out.length === 0 && t - (b.signal.startMs + b.signal.length * b.signal.stepMs) > 3000) break;
      if (i < this.beats.length - 6 && out.length === 0) break;
    }
    return out;
  }

  /** Lead voltage (mV) at time t, linear interpolation between 5 ms samples. */
  leadAt(leadIndex: number, t: number): number {
    let v = 0;
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const s = this.beats[i].signal;
      if (s.startMs > t) continue;
      const pos = (t - s.startMs) / s.stepMs;
      if (pos > s.length - 1) {
        if (i < this.beats.length - 8) break;
        continue;
      }
      const i0 = Math.floor(pos);
      const f = pos - i0;
      const a = s.leads[leadIndex][i0];
      const b = s.leads[leadIndex][Math.min(i0 + 1, s.length - 1)];
      v += a + (b - a) * f;
    }
    return v;
  }

  /** All 12 leads at t. */
  sampleAll(t: number): Float32Array {
    const out = new Float32Array(ECG_LEADS.length);
    for (let l = 0; l < out.length; l++) out[l] = this.leadAt(l, t);
    return out;
  }

  /** `count` samples of one lead starting at startMs (derived from the engine, no stored waveform). */
  leadWindow(leadIndex: number, startMs: number, count: number, stepMs = ECG_STEP_MS): Float32Array {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = this.leadAt(leadIndex, startMs + i * stepMs);
    return out;
  }

  /** Transmembrane activation (0..1) of a tissue node at t, summed over beats (clamped). */
  vmAt(id: TissueNodeId, t: number): number {
    let v = 0;
    for (const b of this.beatsAt(t)) v += nodeVm(b, id, t);
    return Math.min(1, v);
  }

  /** Beats that fired within `backMs` before t (and up to 2 s ahead), for mechanics / structure state. */
  beatsNear(t: number, backMs = 1800): BeatElectrophysiology[] {
    return this.beats.filter((b) => b.ep.saMs <= t + 100 && b.ep.saMs >= t - backMs).map((b) => b.ep);
  }

  /** Beats ordered by time, up to and including those that fire before `t`. */
  beatsBefore(t: number): BeatElectrophysiology[] {
    return this.beats.filter((b) => b.ep.saMs <= t).map((b) => b.ep);
  }
}
