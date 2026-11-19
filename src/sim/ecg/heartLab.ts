import { DEFAULT_ECG_CONFIG, type EcgConfig } from "../cardiac-ep";
import { mechanicsAt, type MechanicalState } from "../cardiac-mech";
import { ECG_PRESETS } from "../content/ecg";
import type { EcgEngine, EcgInput } from "./engine";
import { activeTransits, blockedEdges, structureActivity } from "./explain";

/**
 * Glue between the 3D heart / `window.HeartSim` and the ECG engine. Reads engine state (activation, transits, mechanics) and maps
 * UI intents to engine inputs. The 3D scene adds only geometry and easing; timing comes from the simulation clock.
 */

export type HeartRhythm = { id: string; label: string; supported: boolean; preset?: string; note: string };

export const HEART_RHYTHMS: HeartRhythm[] = [
  { id: "nsr", label: "Normal sinus rhythm", supported: true, preset: "nsr", note: "SA node → atria → AV node → His–Purkinje → ventricles." },
  { id: "av-block-2-1", label: "2:1 AV block", supported: true, preset: "av-block-2-1", note: "Every second P wave is not conducted: the atria beat at the sinus rate, the ventricles at half of it." },
  { id: "lbbb", label: "Left bundle branch block", supported: true, preset: "lbbb", note: "The left bundle does not conduct; the LV is activated late through the myocardium." },
  { id: "rbbb", label: "Right bundle branch block", supported: true, preset: "rbbb", note: "The right bundle does not conduct; the RV is activated late." },
  { id: "af", label: "Atrial fibrillation (phase 2)", supported: false, note: "Not simulated yet: needs chaotic atrial activation and an irregular ventricular response. Coming in phase 2." },
  { id: "vt", label: "Ventricular tachycardia (phase 2)", supported: false, note: "Not simulated yet: needs a ventricular focus and AV dissociation. Coming in phase 2." },
];

const ALIASES: Record<string, string> = {
  normal: "nsr", "normal sinus rhythm": "nsr", sinus: "nsr", nsr: "nsr",
  "2:1": "av-block-2-1", "2:1 av block": "av-block-2-1", "av block": "av-block-2-1", "2:1-block": "av-block-2-1", "av-block-2-1": "av-block-2-1", "av_block_2_1": "av-block-2-1",
  af: "af", afib: "af", "atrial fibrillation": "af", vt: "vt", "ventricular tachycardia": "vt", lbbb: "lbbb", rbbb: "rbbb",
};

export function findRhythm(mode: string): HeartRhythm | null {
  const k = ALIASES[mode.trim().toLowerCase()] ?? mode.trim().toLowerCase();
  return HEART_RHYTHMS.find((r) => r.id === k) ?? null;
}

/** Engine input for a rhythm id at the given sinus (atrial) rate, or null if the rhythm is not simulated. */
export function heartRhythmInput(id: string, bpm: number): EcgInput | null {
  const r = findRhythm(id);
  if (!r || !r.supported || !r.preset) return null;
  const config: EcgConfig = { ...DEFAULT_ECG_CONFIG, ...ECG_PRESETS[r.preset], sinusRateBpm: clampBpm(bpm) };
  return { type: "replaceConfig", config };
}

export const clampBpm = (bpm: number) => Math.min(180, Math.max(40, Math.round(bpm)));

export type HeartVisual = {
  timeMs: number;
  /** Mechanical contraction 0..1 per chamber (engine mechanics). */
  ra: number; la: number; rv: number; lv: number; septum: number;
  /** Valve opening 0..1 (engine valve state, smoothed over a 40 ms window so leaflets move instead of teleporting). */
  valves: { tricuspid: number; mitral: number; pulmonary: number; aortic: number };
  /** Apical twist 0..1 (scaled LV contraction; the scene applies its own 10° maximum). */
  twist: number;
  /** Activation level 0..1 of conduction-system nodes (SA, AV, His, bundle branches, fascicles) and Purkinje. */
  node: Record<"saNode" | "avNode" | "hisBundle" | "rightBundle" | "leftBundle" | "leftAnteriorFascicle" | "leftPosteriorFascicle" | "purkinje", number>;
  /** Per conduction edge: 0 = idle, 0..1 = wavefront at that fraction of the edge, 1..2 = trailing glow decaying after passage. */
  edge: Record<string, number>;
  /** Edge ids where an impulse arrived but could not cross (block) in the last 1.2 s. */
  blocked: string[];
  mechanics: MechanicalState;
  /** Atrial and ventricular rates from the schedule of recent beats (bpm), null if fewer than two beats. */
  atrialRate: number | null;
  ventricularRate: number | null;
};

const TRAIL_MS = 140;

export function heartVisual(engine: EcgEngine, t: number): HeartVisual {
  const beats = engine.beatsNear(t);
  const mech = mechanicsAt(beats, t);
  const act = structureActivity(engine, t);
  const w = [0, 10, 20, 30, 40].map((d) => (d === 0 ? mech : mechanicsAt(beats, t - d)));
  const open = (pick: (m: MechanicalState) => "open" | "closed") => w.reduce((a, m) => a + (pick(m) === "open" ? 1 : 0), 0) / w.length;
  const edge: Record<string, number> = {};
  for (const tr of activeTransits(engine, t)) edge[tr.edgeId] = Math.max(edge[tr.edgeId] ?? 0, Math.min(0.999, Math.max(0.001, tr.progress)));
  for (const b of engine.beatsNear(t, 400)) {
    for (const tr of b.transits) {
      if (!tr.conducted || t <= tr.endMs || t > tr.endMs + TRAIL_MS) continue;
      const v = 1 + (t - tr.endMs) / TRAIL_MS;
      if (!(tr.edgeId in edge)) edge[tr.edgeId] = v;
    }
  }
  const node = {
    saNode: act.saNode.activation, avNode: act.avNode.activation, hisBundle: act.hisBundle.activation, rightBundle: act.rightBundle.activation,
    leftBundle: act.leftBundle.activation, leftAnteriorFascicle: act.leftAnteriorFascicle.activation, leftPosteriorFascicle: act.leftPosteriorFascicle.activation,
    purkinje: act.purkinje.activation,
  };
  const sa = engine.beatsBefore(t).slice(-3).map((b) => b.saMs);
  const qrs = engine.beatsBefore(t).filter((b) => b.conductedToVentricles && b.fiducials.qrsOnsetMs !== undefined && b.fiducials.qrsOnsetMs <= t).slice(-2).map((b) => b.fiducials.qrsOnsetMs!);
  const rate = (a: number[]) => (a.length >= 2 ? 60000 / (a[a.length - 1] - a[a.length - 2]) : null);
  return {
    timeMs: t,
    ra: mech.rightAtrium, la: mech.leftAtrium, rv: mech.rightVentricle, lv: mech.leftVentricle, septum: mech.septum,
    valves: { tricuspid: open((m) => m.valves.tricuspid), mitral: open((m) => m.valves.mitral), pulmonary: open((m) => m.valves.pulmonic), aortic: open((m) => m.valves.aortic) },
    twist: Math.min(1, mech.leftVentricle),
    node, edge, blocked: blockedEdges(engine, t), mechanics: mech,
    atrialRate: rate(sa), ventricularRate: rate(qrs),
  };
}
