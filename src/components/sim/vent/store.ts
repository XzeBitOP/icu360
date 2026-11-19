"use client";
import { create } from "zustand";
import { SimulationRunner, type SimulationSpeed } from "@/sim/core";
import { DEFAULT_VENT_SETTINGS, VentilatorEngine, type VentInput, type VentSettings, type VentSnapshot } from "@/sim/vent";
import type { RespiratoryPatient } from "@/sim/types";
import { VENTILATOR_PRESETS } from "@/sim/content";
import { apiSettingsPatch, lobeExpansionInput, lungModeInputs, LUNG_MODES, resolveLungMode, type LungApiSettings, type LungModeId } from "@/sim/vent";
import { LOBE_KEYS } from "@/sim/resp";

export type Runner = SimulationRunner<VentSnapshot, VentInput>;
let runner: Runner | null = null;
export function getRunner(): Runner {
  if (!runner) {
    runner = new SimulationRunner<VentSnapshot, VentInput>(new VentilatorEngine({}));
    // pre-roll 12 s; one inspiratory hold at ~8 s so a valid plateau exists from the start
    runner.stepForward(1500);
    runner.dispatch({ type: "holdInspiratory", seconds: 0.5 });
    runner.stepForward(900);
    if (typeof window !== "undefined") (window as unknown as { __ventRunner: Runner }).__ventRunner = runner;
  }
  return runner;
}
export { LOBE_KEYS };
export const getEngine = () => getRunner().engine as VentilatorEngine;

/**
 * Breath count at the last change that alters the mechanics being measured (case, patient, mode, PEEP, VT/flow/pressure target, Ti).
 * Hold-based values (Pplat, total PEEP) from breaths before this are stale and are not shown.
 */
let epoch = 0;
export const mechanicsEpoch = () => Math.min(epoch, getEngine().breaths.length);
const markEpoch = () => { epoch = getEngine().breaths.length + 1; };
const MECH_KEYS: (keyof VentSettings)[] = ["mode", "vtMl", "peepCmH2O", "inspFlowLpm", "flowPattern", "pInspCmH2O", "tiSec", "riseTimeSec"];

type State = {
  ready: boolean;
  uiTimeMs: number;
  horizonMs: number;
  isPlaying: boolean;
  speed: SimulationSpeed;
  caseId: string;
  settings: VentSettings;
  patient: RespiratoryPatient;
  selectedLobe: number;
  lung3d: boolean;
  lungMode: LungModeId | null;
  labels3d: boolean;
  lobes: { id: string; aeration: number; excluded: boolean }[];
  applyLungMode: (id: LungModeId) => void;
  setLobeAeration: (api: Partial<Record<"rul" | "rml" | "rll" | "lul" | "lll", number>>) => void;
  setLabels3d: (b: boolean) => void;
  apiSetVentilator: (api: LungApiSettings) => { ok: boolean; message: string };
  init: () => void;
  syncUi: () => void;
  toggle: () => void;
  stepBy: (steps: number) => void;
  seek: (ms: number) => void;
  setSpeed: (s: SimulationSpeed) => void;
  restart: () => void;
  setSettings: (patch: Partial<VentSettings>) => void;
  setMode: (mode: VentSettings["mode"]) => void;
  setPatient: (patch: Partial<RespiratoryPatient>) => void;
  loadCase: (id: string) => void;
  hold: (kind: "insp" | "exp") => void;
  manualBreath: () => void;
  selectLobe: (i: number) => void;
  setLung3d: (b: boolean) => void;
};

const readLobeState = () => { const e = getEngine(); return e.sys.compartments.map((c, i) => ({ id: c.id, aeration: e.sys.aeration(i), excluded: !!c.excluded })); };
const snap = () => { const e = getEngine(); return { settings: { ...e.settings }, patient: { ...e.patient }, lobes: readLobeState() }; };

export const useVentStore = create<State>((set, get) => ({
  ready: false, uiTimeMs: 0, horizonMs: 0, isPlaying: false, speed: 1, caseId: "healthy-adult",
  settings: new VentilatorEngine({}).settings, patient: new VentilatorEngine({}).patient, selectedLobe: 2, lung3d: true, lungMode: "vc", labels3d: false, lobes: [],
  init: () => { const r = getRunner(); r.play(); set({ ready: true, isPlaying: true, uiTimeMs: r.timeMs, horizonMs: r.horizon, ...snap() }); },
  syncUi: () => {
    const r = getRunner();
    const s = snap();
    const cur = get();
    const same = JSON.stringify(s.settings) === JSON.stringify(cur.settings) && JSON.stringify(s.patient) === JSON.stringify(cur.patient) && JSON.stringify(s.lobes) === JSON.stringify(cur.lobes);
    set({ uiTimeMs: r.timeMs, horizonMs: r.horizon, isPlaying: r.clock.isPlaying, ...(same ? {} : s) });
  },
  toggle: () => { const r = getRunner(); r.toggle(); get().syncUi(); },
  stepBy: (steps) => { const r = getRunner(); r.pause(); if (steps >= 0) r.stepForward(steps); else r.stepBackward(-steps); get().syncUi(); set({ isPlaying: false }); },
  seek: (ms) => { getRunner().seek(ms); get().syncUi(); },
  setSpeed: (speed) => { getRunner().setSpeed(speed); set({ speed }); },
  restart: () => {
    const r = getRunner(); r.reset(); epoch = 0;
    r.dispatch({ type: "loadCase", ...caseInput("healthy-adult") });
    r.stepForward(1500); r.dispatch({ type: "holdInspiratory", seconds: 0.5 }); r.stepForward(900); r.play();
    set({ caseId: "healthy-adult", lungMode: "vc" }); get().syncUi();
  },
  setSettings: (patch) => {
    if (MECH_KEYS.some((k) => k in patch)) markEpoch();
    getRunner().dispatch({ type: "setSettings", patch }); set({ settings: { ...getEngine().settings } });
  },
  setMode: (mode) => {
    // carry the operating point across: VC -> PC uses the last measured driving pressure; PC -> VC uses the last delivered volume
    const e = getEngine();
    const cur = e.settings;
    if (mode === cur.mode) return;
    const patch: Partial<VentSettings> = { mode };
    const b = [...e.breaths].reverse().find((x) => x.pplat.valid && x.drivingPressure.valid);
    const last = e.breaths[e.breaths.length - 1];
    if (mode === "PC-A/C" && b?.drivingPressure.value) {
      const tau = last?.expiratoryTimeConstantSec.value ?? 0;
      const fill = tau > 0 ? 1 - Math.exp(-cur.tiSec / tau) : 0.8; // fraction of the equilibrium volume reached in Ti
      patch.pInspCmH2O = Math.max(4, Math.min(30, Math.round(b.drivingPressure.value / Math.max(fill, 0.3))));
    }
    if (mode === "VC-A/C" && last) patch.vtMl = Math.max(200, Math.min(800, Math.round(last.vtiL * 1000 / 10) * 10));
    get().setSettings(patch);
  },
  setPatient: (patch) => { markEpoch(); getRunner().dispatch({ type: "setPatient", patch }); set({ patient: { ...getEngine().patient } }); },
  loadCase: (id) => { markEpoch(); getRunner().dispatch({ type: "loadCase", ...caseInput(id, get().settings.mode) }); set({ caseId: id, lungMode: null, ...snap() }); },
  hold: (kind) => getRunner().dispatch(kind === "insp" ? { type: "holdInspiratory", seconds: 0.5 } : { type: "holdExpiratory", seconds: 2 }),
  manualBreath: () => getRunner().dispatch({ type: "manualBreath" }),
  applyLungMode: (id) => {
    markEpoch();
    const r = getRunner();
    for (const inp of lungModeInputs(id)) r.dispatch(inp);
    set({ lungMode: id, caseId: LUNG_MODES.find((m) => m.id === id)!.presetId, ...snap() });
  },
  setLobeAeration: (api) => { markEpoch(); getRunner().dispatch(lobeExpansionInput(api)); set({ lungMode: null, ...snap() }); },
  setLabels3d: (labels3d) => set({ labels3d }),
  apiSetVentilator: (api) => {
    const mode = api.mode ? resolveLungMode(api.mode) : null;
    if (mode && mode !== "vc" && mode !== "pc") { get().applyLungMode(mode); }
    else if (mode === "vc" || mode === "pc") { if (get().lungMode !== null && get().lungMode !== mode) get().applyLungMode(mode); }
    const patch = apiSettingsPatch({ ...api, mode: mode === "pc" ? "PC-CMV" : mode === "vc" ? "VC-CMV" : api.mode }, getEngine().settings);
    if (Object.keys(patch).length) get().setSettings(patch);
    return { ok: true, message: mode ? LUNG_MODES.find((m) => m.id === mode)!.label : "settings applied" };
  },
  selectLobe: (selectedLobe) => set({ selectedLobe }),
  setLung3d: (lung3d) => set({ lung3d }),
}));

function caseInput(id: string, mode: VentSettings["mode"] = "VC-A/C"): { patient: RespiratoryPatient; compartments: ReturnType<typeof presetCompartments>; settings: Partial<VentSettings>; peripheralResistance: number } {
  const p = VENTILATOR_PRESETS[id];
  return { patient: { ...p.case.baselinePatient }, compartments: presetCompartments(id), settings: { ...DEFAULT_VENT_SETTINGS, mode, ...p.suggestedSettings }, peripheralResistance: p.peripheralResistance };
}
const presetCompartments = (id: string) => VENTILATOR_PRESETS[id].case.regionalCompartments.map((c) => ({ ...c }));
