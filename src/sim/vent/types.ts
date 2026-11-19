import type { LungCompartment, RespiratoryPatient } from "@/sim/types";
import type { VentMode } from "./modes";

export type FlowPattern = "square" | "decelerating";

export type VentSettings = {
  mode: VentMode;
  fio2: number; // fraction 0.21–1
  vtMl: number;
  rr: number; // set rate, /min
  peepCmH2O: number;
  inspFlowLpm: number;
  flowPattern: FlowPattern;
  /** PC: inspiratory pressure ABOVE PEEP. */
  pInspCmH2O: number;
  tiSec: number;
  riseTimeSec: number;
  triggerType: "pressure" | "flow";
  /** Pressure trigger sensitivity: required airway-pressure deflection below PEEP (cmH2O, positive number). */
  pressureTriggerCmH2O: number;
  flowTriggerLpm: number;
  pressureLimitCmH2O: number;
  /** Routine end-inspiratory pause every VC breath, s (0 = none). */
  inspPauseSec: number;
};

export const DEFAULT_VENT_SETTINGS: VentSettings = {
  mode: "VC-A/C",
  fio2: 0.4,
  vtMl: 450,
  rr: 14,
  peepCmH2O: 5,
  inspFlowLpm: 60,
  flowPattern: "square",
  pInspCmH2O: 6,
  tiSec: 1.0,
  riseTimeSec: 0.1,
  triggerType: "flow",
  pressureTriggerCmH2O: 2,
  flowTriggerLpm: 3,
  pressureLimitCmH2O: 40,
  inspPauseSec: 0,
};

export type BreathPhase =
  | "baseline" | "trigger_detected" | "inspiration" | "inspiratory_hold" | "expiration" | "expiratory_pause" | "apnea_backup";

export const PHASE_CODES: BreathPhase[] = ["baseline", "trigger_detected", "inspiration", "inspiratory_hold", "expiration", "expiratory_pause", "apnea_backup"];

export type VentSample = {
  timeMs: number;
  /** Airway pressure, cmH2O */
  paw: number;
  /** Flow, L/s, + = inspiration */
  flow: number;
  /** Volume above the end-expiratory reference at set PEEP, L */
  volume: number;
  /** Patient muscle pressure, cmH2O (+ = inspiratory effort) */
  pmus: number;
  phase: BreathPhase;
  breathIndex: number;
  /** Event markers that occurred during this step */
  trigger?: "patient" | "time";
  cycle?: boolean;
  /** Compartment volumes above relaxed volume (L) and open flags */
  compVolumes: number[];
  compOpen: boolean[];
  pressureLimited?: boolean;
};

export type MeasurementValidity = { value: number | null; valid: boolean; reason?: string };

export type BreathRecord = {
  index: number;
  startMs: number;
  endMs: number;
  triggeredBy: "patient" | "time";
  mode: VentMode;
  settings: VentSettings;
  ppeak: number;
  pplat: MeasurementValidity;
  peepSet: number;
  peepTotal: MeasurementValidity;
  vtiL: number;
  vteL: number;
  rrMeasured: number;
  mvLPerMin: number;
  tiSec: number;
  teSec: number;
  ieRatio: number;
  meanPaw: number;
  peakInspFlowLps: number;
  peakExpFlowLps: number;
  endExpFlowLps: number;
  incompleteExpiration: boolean;
  /** Volume above reference at end of expiration (L): positive = trapped gas (dynamic hyperinflation). */
  endExpVolumeL: number;
  drivingPressure: MeasurementValidity & { basis?: string };
  staticCompliance: MeasurementValidity;
  dynamicCompliance: MeasurementValidity;
  resistance: MeasurementValidity;
  expiratoryTimeConstantSec: MeasurementValidity;
  vtPerPbwMlPerKg: number;
  pressureLimited: boolean;
  effortDetected: boolean;
};

export type VentInput =
  | { type: "setSettings"; patch: Partial<VentSettings> }
  | { type: "setPatient"; patch: Partial<RespiratoryPatient> }
  | { type: "setCompartments"; compartments: LungCompartment[] }
  | { type: "loadCase"; patient: RespiratoryPatient; compartments: LungCompartment[]; settings?: Partial<VentSettings>; peripheralResistance?: number }
  | { type: "setLobes"; aeration?: Record<string, number | undefined>; excluded?: Record<string, boolean | undefined> }
  | { type: "holdInspiratory"; seconds: number }
  | { type: "holdExpiratory"; seconds: number }
  | { type: "manualBreath" };

export const SAMPLE_CAPACITY = 12000; // 60 s at 5 ms
