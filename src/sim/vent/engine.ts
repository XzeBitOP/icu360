import type { LungCompartment, RespiratoryPatient } from "@/sim/types";
import { RingBuffer, type SteppableEngine } from "@/sim/core";
import {
  RespiratorySystem, effortFromPatient, makeCompartments, makePatient, musclePressure, normaliseCompartments, type EffortModel,
} from "@/sim/resp";
import { measureBreath } from "./measure";
import {
  DEFAULT_VENT_SETTINGS, SAMPLE_CAPACITY, type BreathPhase, type BreathRecord, type VentInput, type VentSample, type VentSettings,
} from "./types";

type Sys = ReturnType<RespiratorySystem["clone"]>;

export type VentSnapshot = {
  timeMs: number;
  settings: VentSettings;
  sys: Sys;
  phase: BreathPhase;
  phaseStartMs: number;
  breathStartMs: number;
  breathIndex: number;
  breathTrigger: "patient" | "time";
  nextMandatoryMs: number;
  inspElapsedS: number;
  holdRemainingS: number;
  pendingInspHoldS: number;
  pendingExpHoldS: number;
  volumeL: number;
  vRefL: number;
  effort: EffortModel;
  recordCount: number;
  breathSettings?: VentSettings;
  activeInspHoldS: number;
  pressureLimitedThisBreath: boolean;
  vDeliveredL: number;
  alarm: string | null;
};

/** Sensing resistance converting patient inspiratory flow into the circuit pressure deflection seen by a pressure trigger (cmH2O/(L/s)). */
export const TRIGGER_SENSE_RESISTANCE = 3;
/** Refractory period after expiration starts before a patient trigger can be detected, s. */
const TRIGGER_REFRACTORY_S = 0.25;
const SUBSTEP_S = 0.001;
const STEP_MS_DEFAULT = 5;

export class VentilatorEngine implements SteppableEngine<VentSnapshot, VentInput> {
  timeMs = 0;
  settings: VentSettings;
  sys: RespiratorySystem;
  effort: EffortModel;
  readonly samples = new RingBuffer<VentSample>(SAMPLE_CAPACITY);
  breaths: BreathRecord[] = [];
  alarm: string | null = null;

  private phase: BreathPhase = "expiration";
  private phaseStartMs = 0;
  private breathStartMs = 0;
  private breathIndex = 0;
  private breathTrigger: "patient" | "time" = "time";
  private nextMandatoryMs = 0;
  private inspElapsedS = 0;
  private holdRemainingS = 0;
  private pendingInspHoldS = 0;
  private pendingExpHoldS = 0;
  private volumeL = 0;
  private vRefL = 0;
  private pressureLimitedThisBreath = false;
  private readonly init: { settings: VentSettings; patient: RespiratoryPatient; compartments: LungCompartment[]; peripheralResistance?: number };

  constructor(opts: { settings?: Partial<VentSettings>; patient?: Partial<RespiratoryPatient> | RespiratoryPatient; compartments?: LungCompartment[]; peripheralResistance?: number } = {}) {
    const settings = { ...DEFAULT_VENT_SETTINGS, ...(opts.settings ?? {}) };
    const patient = makePatient(opts.patient as Partial<RespiratoryPatient>);
    const comps = normaliseCompartments(opts.compartments ?? makeCompartments({}, patient.complianceLPerCmH2O));
    this.init = { settings, patient, compartments: comps, peripheralResistance: opts.peripheralResistance };
    this.settings = { ...settings };
    this.sys = new RespiratorySystem({ ...patient }, comps.map((c) => ({ ...c })), opts.peripheralResistance);
    this.effort = effortFromPatient(this.sys.patient);
    this.initialise();
  }

  private initialise(): void {
    this.sys.equilibrate(this.settings.peepCmH2O);
    this.vRefL = this.sys.totalVolume;
    this.volumeL = 0;
    this.phase = "expiration";
    this.phaseStartMs = 0;
    this.breathStartMs = 0;
    // First mandatory breath after a short baseline so the learner sees PEEP first.
    this.nextMandatoryMs = 500;
    this.breathIndex = 0;
  }

  reset(): void {
    this.timeMs = 0;
    this.settings = { ...this.init.settings };
    this.sys = new RespiratorySystem({ ...this.init.patient }, this.init.compartments.map((c) => ({ ...c })), this.init.peripheralResistance);
    this.effort = effortFromPatient(this.sys.patient);
    this.samples.clear();
    this.breaths = [];
    this.alarm = null;
    this.holdRemainingS = 0;
    this.pendingInspHoldS = 0;
    this.pendingExpHoldS = 0;
    this.inspElapsedS = 0;
    this.pressureLimitedThisBreath = false;
    this.vDeliveredL = 0;
    this.initialise();
  }

  /** Reference volume (L above relaxed volume) that the displayed volume signal is measured from. */
  volumeLastRef(): number {
    return this.vRefL;
  }

  get phaseNow(): BreathPhase {
    return this.phase;
  }
  get lastSample(): VentSample | undefined {
    return this.samples.last();
  }
  get lastBreath(): BreathRecord | undefined {
    return this.breaths[this.breaths.length - 1];
  }

  /** Reference end-expiratory volume at the set PEEP for the current mechanics (open units, passive). */
  private recomputeReference(): void {
    const copy = new RespiratorySystem(this.sys.patient, this.sys.compartments, this.sys.peripheralResistance);
    copy.state = this.sys.state.map((s) => ({ ...s }));
    copy.equilibrate(this.settings.peepCmH2O);
    this.vRefL = copy.totalVolume;
    this.volumeL = this.sys.totalVolume - this.vRefL;
  }

  apply(input: VentInput): void {
    switch (input.type) {
      case "setSettings": {
        const prevMode = this.settings.mode;
        this.settings = { ...this.settings, ...input.patch };
        if (input.patch.peepCmH2O !== undefined || input.patch.mode !== undefined) this.recomputeReference();
        void prevMode;
        break;
      }
      case "setPatient": {
        const p = { ...this.sys.patient, ...input.patch };
        if (input.patch.heightCm !== undefined || input.patch.sex !== undefined) p.predictedBodyWeightKg = makePatient({ heightCm: p.heightCm, sex: p.sex }).predictedBodyWeightKg;
        this.sys.patient = p;
        this.effort = { ...this.effort, amplitudeCmH2O: p.musclePressureAmplitudeCmH2O, rateBpm: p.spontaneousRateBpm };
        this.recomputeReference();
        break;
      }
      case "setCompartments":
        this.sys.compartments = normaliseCompartments(input.compartments);
        this.recomputeReference();
        break;
      case "setLobes":
        this.sys.setLobeState({ aeration: input.aeration, excluded: input.excluded });
        this.recomputeReference();
        break;
      case "loadCase": {
        if (input.settings) this.settings = { ...this.settings, ...input.settings };
        this.sys = new RespiratorySystem({ ...input.patient }, normaliseCompartments(input.compartments).map((c) => ({ ...c })), input.peripheralResistance);
        this.effort = effortFromPatient(this.sys.patient);
        // equilibrate at the set PEEP: passive end-expiration of the new patient
        this.sys.equilibrate(this.settings.peepCmH2O);
        this.vRefL = this.sys.totalVolume;
        this.volumeL = 0;
        this.phase = "expiration";
        this.phaseStartMs = this.timeMs;
        this.nextMandatoryMs = this.timeMs + 400;
        break;
      }
      case "holdInspiratory":
        this.pendingInspHoldS = Math.max(0.3, Math.min(input.seconds, 3));
        break;
      case "holdExpiratory":
        this.pendingExpHoldS = Math.max(1, Math.min(input.seconds, 5));
        break;
      case "manualBreath":
        if (this.phase === "expiration") this.startInspiration("time");
        break;
    }
  }

  snapshot(): VentSnapshot {
    return {
      timeMs: this.timeMs, settings: { ...this.settings }, sys: this.sys.clone(), phase: this.phase, phaseStartMs: this.phaseStartMs,
      breathStartMs: this.breathStartMs, breathIndex: this.breathIndex, breathTrigger: this.breathTrigger, nextMandatoryMs: this.nextMandatoryMs,
      inspElapsedS: this.inspElapsedS, holdRemainingS: this.holdRemainingS, pendingInspHoldS: this.pendingInspHoldS, pendingExpHoldS: this.pendingExpHoldS,
      volumeL: this.volumeL, vRefL: this.vRefL, effort: { ...this.effort }, recordCount: this.breaths.length, activeInspHoldS: this.activeInspHoldS, breathSettings: this.breathSettings ? { ...this.breathSettings } : undefined,
      pressureLimitedThisBreath: this.pressureLimitedThisBreath, vDeliveredL: this.vDeliveredL, alarm: this.alarm,
    };
  }

  restore(s: VentSnapshot): void {
    this.timeMs = s.timeMs;
    this.settings = { ...s.settings };
    this.sys.restore(s.sys);
    this.phase = s.phase; this.phaseStartMs = s.phaseStartMs; this.breathStartMs = s.breathStartMs; this.breathIndex = s.breathIndex;
    this.breathTrigger = s.breathTrigger; this.nextMandatoryMs = s.nextMandatoryMs; this.inspElapsedS = s.inspElapsedS;
    this.holdRemainingS = s.holdRemainingS; this.pendingInspHoldS = s.pendingInspHoldS; this.pendingExpHoldS = s.pendingExpHoldS;
    this.volumeL = s.volumeL; this.vRefL = s.vRefL; this.effort = { ...s.effort };
    this.pressureLimitedThisBreath = s.pressureLimitedThisBreath; this.vDeliveredL = s.vDeliveredL; this.alarm = s.alarm;
    this.breathSettings = s.breathSettings ? { ...s.breathSettings } : undefined;
    this.activeInspHoldS = s.activeInspHoldS;
    this.samples.popWhile((x) => x.timeMs > s.timeMs);
    this.breaths.length = Math.min(this.breaths.length, s.recordCount);
  }

  // ───────── breath control ─────────
  private get tiVcSec(): number {
    const s = this.settings;
    const vt = s.vtMl / 1000;
    const q = s.inspFlowLpm / 60;
    return s.flowPattern === "square" ? vt / q : (2 * vt) / q;
  }

  private inspiratoryTimeSec(): number {
    return this.settings.mode === "VC-A/C" ? this.tiVcSec : this.settings.tiSec;
  }

  private startInspiration(by: "patient" | "time"): void {
    // finalise the previous breath record
    if (this.breathIndex > 0 || this.samples.length > 0) this.finaliseBreath(this.timeMs);
    this.breathIndex += 1;
    this.breathStartMs = this.timeMs;
    this.breathTrigger = by;
    this.breathSettings = { ...this.settings };
    this.phase = "inspiration";
    this.phaseStartMs = this.timeMs;
    this.inspElapsedS = 0;
    this.vDeliveredL = 0;
    this.pressureLimitedThisBreath = false;
    this.nextMandatoryMs = this.timeMs + 60000 / this.settings.rr;
    this.holdRemainingS = 0;
    this.markTrigger = by;
    if (this.settings.mode === "VC-A/C" && this.pendingInspHoldS > 0) {
      this.activeInspHoldS = this.pendingInspHoldS;
      this.pendingInspHoldS = 0;
    } else this.activeInspHoldS = this.settings.mode === "VC-A/C" ? this.settings.inspPauseSec : 0;
  }
  private markTrigger: "patient" | "time" | undefined;
  private markCycle = false;
  private activeInspHoldS = 0;

  private finaliseBreath(endMs: number): void {
    const startMs = this.breathStartMs;
    if (this.breathIndex < 1) return;
    const arr: VentSample[] = [];
    for (let i = 0; i < this.samples.length; i++) {
      const sm = this.samples.at(i);
      if (sm.timeMs > startMs && sm.timeMs <= endMs) arr.push(sm);
    }
    if (arr.length < 10) return;
    const s0 = this.breathSettings ?? this.settings;
    const rec = measureBreath(arr, this.breathIndex, s0, this.sys.patient.predictedBodyWeightKg, STEP_MS_DEFAULT / 1000, this.breathTrigger, startMs, endMs);
    this.breaths.push(rec);
    if (this.breaths.length > 400) this.breaths.shift();
  }
  private breathSettings: VentSettings | undefined;

  /**
   * One control step (default 5 ms). Phase transitions (trigger, cycle, hold end) are evaluated at the start of the step from
   * the state at that time; the mechanics are then integrated in 1 ms sub-steps with the phase held fixed.
   * Recorded flow is the mean over the step so that cumulative Σ flow·dt equals the volume signal exactly.
   */
  step(stepMs: number): void {
    const n = Math.max(1, Math.round(stepMs / (SUBSTEP_S * 1000)));
    this.markTrigger = undefined;
    this.markCycle = false;
    this.controlUpdate(musclePressure(this.effort, this.timeMs / 1000));
    const phase = this.phase;
    let paw = 0, qSum = 0, pmus = 0;
    let limited = false;
    for (let k = 0; k < n; k++) {
      this.timeMs += SUBSTEP_S * 1000;
      pmus = musclePressure(this.effort, this.timeMs / 1000);
      const r = this.substep(pmus);
      paw = r.paw; qSum += r.q; limited = limited || r.limited;
      this.sys.integrate(r.q, SUBSTEP_S, pmus);
      this.volumeL += r.q * SUBSTEP_S;
    }
    this.timeMs = Math.round(this.timeMs * 1000) / 1000;
    this.samples.push({
      timeMs: Math.round(this.timeMs),
      paw, flow: qSum / n, volume: this.volumeL, pmus, phase, breathIndex: this.breathIndex,
      trigger: this.markTrigger, cycle: this.markCycle || undefined,
      compVolumes: this.sys.state.map((s) => s.v),
      compOpen: this.sys.state.map((s) => s.open),
      pressureLimited: limited || undefined,
    });
  }

  private vDeliveredL = 0;

  /** Phase logic at the start of a control step. */
  private controlUpdate(pmus: number): void {
    const s = this.settings;
    const tMs = this.timeMs;
    switch (this.phase) {
      case "inspiration": {
        const done = this.settings.mode === "VC-A/C"
          ? this.vDeliveredL >= s.vtMl / 1000 - 1e-9 || this.inspElapsedS >= this.inspiratoryTimeSec() + 0.25
          : this.inspElapsedS >= s.tiSec - 1e-9;
        if (done) {
          this.markCycle = true;
          this.phaseStartMs = tMs;
          if (this.activeInspHoldS > 0) { this.phase = "inspiratory_hold"; this.holdRemainingS = this.activeInspHoldS; }
          else this.phase = "expiration";
        }
        return;
      }
      case "inspiratory_hold":
        if (this.holdRemainingS <= 1e-9) { this.phase = "expiration"; this.phaseStartMs = tMs; this.markCycle = true; this.activeInspHoldS = 0; }
        return;
      case "expiratory_pause":
        if (this.holdRemainingS <= 1e-9) this.startInspiration("time");
        return;
      default: {
        const sinceS = (tMs - this.phaseStartMs) / 1000;
        const q = this.sys.flowForPressure(s.peepCmH2O, pmus);
        if (sinceS >= TRIGGER_REFRACTORY_S && q > 0) {
          const byFlow = s.triggerType === "flow" && q * 60 >= s.flowTriggerLpm;
          const byPressure = s.triggerType === "pressure" && TRIGGER_SENSE_RESISTANCE * q >= s.pressureTriggerCmH2O;
          if (byFlow || byPressure) { this.startInspiration("patient"); return; }
        }
        if (tMs >= this.nextMandatoryMs) {
          if (this.pendingExpHoldS > 0) {
            this.phase = "expiratory_pause";
            this.holdRemainingS = this.pendingExpHoldS;
            this.pendingExpHoldS = 0;
            this.phaseStartMs = tMs;
          } else this.startInspiration("time");
        }
      }
    }
  }

  private substep(pmus: number): { paw: number; q: number; limited: boolean } {
    const s = this.settings;
    const sys = this.sys;
    switch (this.phase) {
      case "inspiration": {
        this.inspElapsedS += SUBSTEP_S;
        const ti = this.inspiratoryTimeSec();
        let paw: number, q: number, limited = false;
        if (s.mode === "VC-A/C") {
          const qSet = s.inspFlowLpm / 60;
          q = s.flowPattern === "square" ? qSet : Math.max(0, qSet * (1 - this.inspElapsedS / ti));
          const remaining = s.vtMl / 1000 - this.vDeliveredL;
          if (q * SUBSTEP_S > remaining) q = Math.max(0, remaining / SUBSTEP_S); // volume-cycled: stop exactly at VT
          paw = sys.pressureForFlow(q, pmus);
          if (paw > s.pressureLimitCmH2O) {
            paw = s.pressureLimitCmH2O;
            q = sys.flowForPressure(paw, pmus);
            limited = true;
            this.pressureLimitedThisBreath = true;
            this.alarm = "High pressure limit reached: breath is pressure-limited and the set volume may not be delivered.";
          }
          this.vDeliveredL += Math.max(q, 0) * SUBSTEP_S;
        } else {
          const ramp = Math.min(1, this.inspElapsedS / Math.max(s.riseTimeSec, 0.01));
          paw = s.peepCmH2O + s.pInspCmH2O * ramp;
          q = sys.flowForPressure(paw, pmus);
          this.vDeliveredL += Math.max(q, 0) * SUBSTEP_S;
        }
        return { paw, q, limited };
      }
      case "inspiratory_hold": {
        this.holdRemainingS -= SUBSTEP_S;
        return { paw: sys.pressureForFlow(0, pmus), q: 0, limited: false };
      }
      case "expiratory_pause": {
        this.holdRemainingS -= SUBSTEP_S;
        return { paw: sys.pressureForFlow(0, pmus), q: 0, limited: false };
      }
      default:
        // expiration: exhalation valve holds PEEP
        return { paw: s.peepCmH2O, q: sys.flowForPressure(s.peepCmH2O, pmus), limited: false };
    }
  }

  /** Samples within [fromMs, toMs]. */
  window(fromMs: number, toMs: number): VentSample[] {
    const out: VentSample[] = [];
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples.at(i);
      if (s.timeMs >= fromMs && s.timeMs <= toMs) out.push(s);
    }
    return out;
  }

  get patient(): RespiratoryPatient {
    return this.sys.patient;
  }
  get compartments(): LungCompartment[] {
    return this.sys.compartments;
  }
}
