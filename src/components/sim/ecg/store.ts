"use client";
import { create } from "zustand";
import { SimulationRunner, type SimulationSpeed } from "@/sim/core";
import { EcgEngine, type EcgInput, type EcgSnapshot } from "@/sim/ecg";
import { DEFAULT_ECG_CONFIG, STRUCTURE_EDGES, type EcgConfig } from "@/sim/cardiac-ep";
import { ECG_CONDITIONS, ECG_PRESETS } from "@/sim/content";
import { HEART_RHYTHMS, clampBpm, findRhythm, heartRhythmInput } from "@/sim/ecg";
import type { ChamberOverride } from "@/components/sim3d/heart/HeartScene";

export type WaveKind = "P" | "PR segment" | "QRS" | "T";
export type Runner = SimulationRunner<EcgSnapshot, EcgInput>;

let runner: Runner | null = null;
export function getRunner(): Runner {
  if (!runner) {
    runner = new SimulationRunner<EcgSnapshot, EcgInput>(new EcgEngine({}));
    runner.stepForward(1600); // pre-roll 8 s of simulated time so the strips are populated; the learner can scrub back to 0
    if (typeof window !== "undefined") (window as unknown as { __ecgRunner: Runner }).__ecgRunner = runner;
  }
  return runner;
}
export const getEngine = () => getRunner().engine as EcgEngine;

type State = {
  ready: boolean;
  uiTimeMs: number;
  horizonMs: number;
  isPlaying: boolean;
  speed: SimulationSpeed;
  conditionId: string;
  custom: boolean;
  cfgVersion: number;
  rate: number;
  avDelay: number;
  gain: 5 | 10 | 20;
  selectedStructure: string | null;
  selectedWave: WaveKind | null;
  showLabels: boolean;
  view: "2d" | "3d";
  /** Rhythm applied through the heart controls that is not one of the listed ECG conditions (e.g. 2:1 AV block). */
  rhythmId: string | null;
  /** Manual chamber override (HeartSim.setChamberState). null = chambers follow the simulation. */
  manual: ChamberOverride | null;
  conduction3d: boolean;
  labels3d: boolean;
  notice: string | null;
  selectRhythm: (id: string) => { ok: boolean; message: string };
  setManual: (m: ChamberOverride | null) => void;
  setConduction3d: (b: boolean) => void;
  setLabels3d: (b: boolean) => void;
  init: () => void;
  syncUi: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  stepBy: (steps: number) => void;
  seek: (ms: number) => void;
  setSpeed: (s: SimulationSpeed) => void;
  restart: () => void;
  selectCondition: (id: string) => void;
  setRate: (bpm: number) => void;
  setAvDelay: (ms: number) => void;
  toggleBlock: (structureId: string) => void;
  selectStructure: (id: string | null, wave?: WaveKind | null) => void;
  selectWave: (w: WaveKind | null) => void;
  setGain: (g: 5 | 10 | 20) => void;
  setShowLabels: (b: boolean) => void;
  setView: (v: "2d" | "3d") => void;
};

export { HEART_RHYTHMS };
const dispatchConfig = (patch: Partial<EcgConfig>) => getRunner().dispatch({ type: "setConfig", patch });

export const useEcgStore = create<State>((set, get) => ({
  ready: false, uiTimeMs: 0, horizonMs: 0, isPlaying: false, speed: 1,
  conditionId: "nsr", custom: false, cfgVersion: 0, rate: 72, avDelay: DEFAULT_ECG_CONFIG.avNodalDelayMs, gain: 10,
  selectedStructure: null, selectedWave: null, showLabels: true, view: "3d", rhythmId: null, manual: null, conduction3d: true, labels3d: false, notice: null,
  init: () => {
    const r = getRunner();
    r.play();
    set({ ready: true, isPlaying: true, uiTimeMs: r.timeMs, horizonMs: r.horizon });
  },
  syncUi: () => { const r = getRunner(); set({ uiTimeMs: r.timeMs, horizonMs: r.horizon, isPlaying: r.clock.isPlaying }); },
  toggle: () => { const r = getRunner(); r.toggle(); get().syncUi(); },
  play: () => { getRunner().play(); set({ isPlaying: true }); },
  pause: () => { getRunner().pause(); get().syncUi(); },
  stepBy: (steps) => {
    const r = getRunner(); r.pause();
    if (steps >= 0) r.stepForward(steps); else r.stepBackward(-steps);
    get().syncUi(); set({ isPlaying: false });
  },
  seek: (ms) => { const r = getRunner(); r.seek(ms); get().syncUi(); },
  setSpeed: (s) => { getRunner().setSpeed(s); set({ speed: s }); },
  restart: () => {
    const r = getRunner(); r.reset(); r.stepForward(1600); r.play();
    set({ rhythmId: null, manual: null, notice: null, conditionId: "nsr", custom: false, rate: 72, avDelay: DEFAULT_ECG_CONFIG.avNodalDelayMs, selectedStructure: null, selectedWave: null });
    get().syncUi();
  },
  selectCondition: (id) => {
    const preset = ECG_PRESETS[id] ?? {};
    const cur = get();
    const rate = preset.sinusRateBpm ?? (id === "nsr" ? 72 : cur.rate);
    const config: EcgConfig = { ...DEFAULT_ECG_CONFIG, ...preset, sinusRateBpm: rate };
    getRunner().dispatch({ type: "replaceConfig", config });
    set({ conditionId: id, custom: false, rate, avDelay: config.avNodalDelayMs, cfgVersion: cur.cfgVersion + 1, rhythmId: null, notice: null });
  },
  selectRhythm: (id) => {
    const r = findRhythm(id);
    if (!r) return { ok: false, message: `Unknown rhythm "${id}".` };
    if (!r.supported) { set({ notice: r.note }); return { ok: false, message: r.note }; }
    if (ECG_CONDITIONS.some((c) => c.id === r.preset)) { get().selectCondition(r.preset!); return { ok: true, message: r.label }; }
    const input = heartRhythmInput(r.id, get().rate);
    if (!input) return { ok: false, message: r.note };
    getRunner().dispatch(input);
    set({ rhythmId: r.id, custom: false, notice: null, cfgVersion: get().cfgVersion + 1, avDelay: DEFAULT_ECG_CONFIG.avNodalDelayMs });
    return { ok: true, message: r.label };
  },
  setManual: (manual) => set({ manual }),
  setConduction3d: (conduction3d) => set({ conduction3d }),
  setLabels3d: (labels3d) => set({ labels3d }),
  setRate: (bpm) => { const b = clampBpm(bpm); dispatchConfig({ sinusRateBpm: b }); set({ rate: b }); },
  setAvDelay: (ms) => { dispatchConfig({ avNodalDelayMs: ms }); set({ avDelay: ms, custom: true }); },
  toggleBlock: (structureId) => {
    const edges = STRUCTURE_EDGES[structureId];
    if (!edges) return;
    const eng = getEngine();
    const overrides = { ...eng.config.edgeOverrides };
    const blocked = edges.every((e) => overrides[e]?.enabled === false);
    for (const e of edges) overrides[e] = blocked ? { enabled: true } : { enabled: false };
    dispatchConfig({ edgeOverrides: overrides });
    set({ custom: true, cfgVersion: get().cfgVersion + 1 });
  },
  selectStructure: (id, wave) => set({ selectedStructure: id, selectedWave: wave === undefined ? get().selectedWave : wave }),
  selectWave: (w) => set({ selectedWave: w, selectedStructure: null }),
  setGain: (gain) => set({ gain }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setView: (view) => set({ view }),
}));
