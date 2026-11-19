import type { LungCompartment, RespiratoryPatient } from "../types";
import { VENTILATOR_PRESETS } from "../content";
import { LOBE_IDS, LOBE_KEYS, type LobeId } from "../resp";
import { DEFAULT_VENT_SETTINGS, type VentInput, type VentSettings } from "./types";
import type { VentilatorEngine } from "./engine";

/**
 * Glue between the 3D lung view / `window.LungSim` API and the ventilator engine. No physiology is computed here:
 * every function maps a UI intent onto engine inputs (settings, case loads, per-lobe aeration/exclusion) or reads engine state.
 */

export type LungModeId = "vc" | "pc" | "ards" | "copd" | "one-lung";

export type LungMode = {
  id: LungModeId;
  label: string;
  /** Short teaching note shown under the selector. */
  note: string;
  presetId: "healthy-adult" | "ards-like" | "obstructive";
};

export const LUNG_MODES: LungMode[] = [
  { id: "vc", label: "Volume control (VC-CMV)", presetId: "healthy-adult", note: "Normal lungs, set tidal volume and flow; pressures follow compliance and resistance." },
  { id: "pc", label: "Pressure control (PC-CMV)", presetId: "healthy-adult", note: "Normal lungs, set inspiratory pressure and time; tidal volume follows compliance, resistance and Ti." },
  { id: "ards", label: "ARDS lung-protective", presetId: "ards-like", note: "Stiff lungs with collapsible dependent lobes; small tidal volume and PEEP (educational illustration, not a protocol)." },
  { id: "copd", label: "COPD / bronchospasm", presetId: "obstructive", note: "High, uneven airway resistance and a long expiratory time constant; short expiratory times trap gas (auto-PEEP)." },
  { id: "one-lung", label: "Right pneumothorax / mainstem intubation", presetId: "healthy-adult", note: "Right lung isolated and collapsed: the whole tidal volume goes to the left lung (one-lung ventilation)." },
];

export const RIGHT_LOBES: LobeId[] = ["RUL", "RML", "RLL"];
export const COLLAPSED_AERATION = 0.35;

export function caseInput(presetId: string, settings: Partial<VentSettings> = {}): { patient: RespiratoryPatient; compartments: LungCompartment[]; settings: Partial<VentSettings>; peripheralResistance: number } {
  const p = VENTILATOR_PRESETS[presetId];
  return {
    patient: { ...p.case.baselinePatient },
    compartments: p.case.regionalCompartments.map((c) => ({ ...c, anatomy: { ...c.anatomy } })),
    settings: { ...DEFAULT_VENT_SETTINGS, ...p.suggestedSettings, ...settings },
    peripheralResistance: p.peripheralResistance,
  };
}

/** Engine inputs that put the engine into a named lung mode. Replays deterministically through the runner input log. */
export function lungModeInputs(id: LungModeId): VentInput[] {
  const mode = LUNG_MODES.find((m) => m.id === id)!;
  const extra: Partial<VentSettings> = id === "pc" ? { mode: "PC-A/C", pInspCmH2O: 12, tiSec: 1.0, rr: 14 } : id === "copd" ? { rr: 20, tiSec: 1.0, inspFlowLpm: 70 } : { mode: "VC-A/C" };
  const inputs: VentInput[] = [{ type: "loadCase", ...caseInput(mode.presetId, extra) }];
  if (id === "one-lung") {
    inputs.push({
      type: "setLobes",
      aeration: Object.fromEntries(RIGHT_LOBES.map((l) => [l, COLLAPSED_AERATION])),
      excluded: Object.fromEntries(RIGHT_LOBES.map((l) => [l, true])),
    });
  }
  return inputs;
}

export type LungApiSettings = { vt?: number; peep?: number; rr?: number; fio2?: number; ieRatio?: number | string; mode?: string };

/** Parse an I:E ratio given as 0.5, "1:2" or "1:2.5" into I/E (0.5 = 1:2). */
export function parseIeRatio(v: number | string): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const m = /^\s*([\d.]+)\s*:\s*([\d.]+)\s*$/.exec(v);
  if (!m) return null;
  const i = parseFloat(m[1]), e = parseFloat(m[2]);
  return i > 0 && e > 0 ? i / e : null;
}

/**
 * `window.LungSim.setVentilator` → engine settings. FiO2 may be given as % (21–100) or a fraction. I:E sets the inspiratory time:
 * PC uses Ti directly; VC derives the constant inspiratory flow from VT/Ti (square wave, so Pplat/resistance stay measurable).
 */
export function apiSettingsPatch(api: LungApiSettings, current: VentSettings): Partial<VentSettings> {
  const patch: Partial<VentSettings> = {};
  const mode: VentSettings["mode"] = api.mode && /pc/i.test(api.mode) ? "PC-A/C" : api.mode && /vc/i.test(api.mode) ? "VC-A/C" : current.mode;
  if (api.mode && /(pc|vc)/i.test(api.mode)) patch.mode = mode;
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  if (api.vt !== undefined) patch.vtMl = clamp(Math.round(api.vt), 100, 1000);
  if (api.peep !== undefined) patch.peepCmH2O = clamp(api.peep, 0, 30);
  if (api.rr !== undefined) patch.rr = clamp(Math.round(api.rr), 4, 40);
  if (api.fio2 !== undefined) patch.fio2 = clamp(api.fio2 > 1.5 ? api.fio2 / 100 : api.fio2, 0.21, 1);
  if (api.ieRatio !== undefined) {
    const r = parseIeRatio(api.ieRatio);
    if (r !== null) {
      const rr = patch.rr ?? current.rr;
      const ti = clamp(((60 / rr) * r) / (1 + r), 0.3, 3);
      patch.tiSec = Math.round(ti * 100) / 100;
      if ((patch.mode ?? current.mode) === "VC-A/C") {
        const vt = (patch.vtMl ?? current.vtMl) / 1000;
        patch.inspFlowLpm = clamp(Math.round((vt / ti) * 60), 15, 150);
      }
    }
  }
  return patch;
}

/** `window.LungSim.setLobeExpansion` → `setLobes` input. Values are aerated fractions 0..1 (1 = normal). */
export function lobeExpansionInput(api: Partial<Record<"rul" | "rml" | "rll" | "lul" | "lll", number>>): VentInput {
  const aeration: Record<string, number> = {};
  for (const id of LOBE_IDS) {
    const v = api[LOBE_KEYS[id]];
    if (v !== undefined && Number.isFinite(v)) aeration[id] = Math.min(1, Math.max(0, v));
  }
  return { type: "setLobes", aeration };
}

export type LobeVisual = {
  id: LobeId;
  /** Normalised size 0..~1.3 (≈1 at the overdistension threshold), from the engine's compartment volume. */
  expansion: number;
  /** Gas above relaxed volume, mL. */
  volumeMl: number;
  open: boolean;
  excluded: boolean;
  aeration: number;
};

export type LungVisual = {
  timeMs: number;
  lobes: LobeVisual[];
  /** Total volume above the end-expiratory reference at set PEEP, L (the plotted volume signal). */
  volumeL: number;
  /** Instantaneous flow, L/s (+ = inspiration). */
  flowLps: number;
  paw: number;
  phase: string;
  /** Fraction of non-excluded lobe units that are open (recruited), 0..1. */
  recruited: number;
  /** End-expiratory gas trapped above set PEEP volume at the latest breath start, L (auto-PEEP / dynamic hyperinflation). */
  trappedL: number;
};

/** Read the display state of the lungs from the engine (latest sample + compartment state). */
export function lungVisual(engine: VentilatorEngine): LungVisual {
  const s = engine.lastSample;
  const sys = engine.sys;
  const lobes = LOBE_IDS.map((id): LobeVisual => {
    const i = sys.compartments.findIndex((c) => c.id === id);
    const st = sys.state[i];
    return { id, expansion: sys.expansion(i), volumeMl: st.v * 1000, open: st.open, excluded: !!sys.compartments[i].excluded, aeration: sys.aeration(i) };
  });
  const live = lobes.filter((l) => !l.excluded);
  const last = engine.lastBreath;
  return {
    timeMs: engine.timeMs,
    lobes,
    volumeL: s?.volume ?? 0,
    flowLps: s?.flow ?? 0,
    paw: s?.paw ?? 0,
    phase: s?.phase ?? "baseline",
    recruited: live.length ? live.filter((l) => l.open).length / live.length : 0,
    trappedL: Math.max(0, last?.endExpVolumeL ?? 0),
  };
}

/** Map a `window.LungSim.setVentilator({ mode })` string to a named lung mode (null if it is a plain ventilator mode or unknown). */
export function resolveLungMode(mode: string): LungModeId | null {
  const m = mode.trim().toLowerCase();
  if (/(one[- ]?lung|pneumothorax|mainstem|main stem)/.test(m)) return "one-lung";
  if (/ards/.test(m)) return "ards";
  if (/(copd|bronchospasm|obstruct)/.test(m)) return "copd";
  if (/^pc/.test(m)) return "pc";
  if (/^vc/.test(m)) return "vc";
  return null;
}
