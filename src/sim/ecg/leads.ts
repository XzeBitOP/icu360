import type { ECGLeadName, Vector3 } from "@/sim/types";
import { ECG_LEADS } from "@/sim/types";

/**
 * Coordinate frame (heart-centred): x = patient's left, y = inferior (toward feet), z = anterior.
 * Frontal-plane angles are measured clockwise from +x (left) toward +y (feet), the standard hexaxial convention:
 * lead I = 0°, II = +60°, III = +120°, aVF = +90°, aVL = −30°, aVR = −150°.
 */

export type LeadDefinition = {
  name: ECGLeadName;
  /** Equivalent far-field lead vector (voltage = dot(heartVector, axis) × gain + baseline) for limb leads. */
  axis: Vector3;
  gain: number;
  baseline: number;
  /** Precordial electrode position (heart-centred). Absent for limb leads. */
  electrode?: Vector3;
};

/** Limb electrode directions in the frontal plane (equilateral Einthoven triangle). Far-field potential = k · (p · r̂). */
export const LIMB_ELECTRODES = {
  RA: { x: -0.5, y: -0.2887, z: 0 },
  LA: { x: 0.5, y: -0.2887, z: 0 },
  LL: { x: 0, y: 0.5774, z: 0 },
} as const satisfies Record<string, Vector3>;

/**
 * Precordial electrode directions from the heart centre (unit vectors; horizontal-plane angle θ measured from patient-left
 * toward anterior: V1 ≈ 108°, V2 ≈ 82°, V3 ≈ 62°, V4 ≈ 42°, V5 ≈ 22°, V6 ≈ 5°, all slightly below the heart's mid-level).
 * FIRST-VERSION LIMITATION: single equivalent dipole at the heart centre. Proximity effects of individual walls on V1–V3 are not modelled.
 */
const dirH = (thetaDeg: number, y: number): Vector3 => {
  const t = (thetaDeg * Math.PI) / 180;
  const x = Math.cos(t), z = Math.sin(t);
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};
export const PRECORDIAL_AXES: Record<"V1" | "V2" | "V3" | "V4" | "V5" | "V6", Vector3> = {
  V1: dirH(108, 0.1),
  V2: dirH(82, 0.1),
  V3: dirH(62, 0.15),
  V4: dirH(42, 0.2),
  V5: dirH(22, 0.2),
  V6: dirH(5, 0.2),
};
/** Electrode positions for display (axis × 1.25 heart radii). */
export const PRECORDIAL_ELECTRODES: Record<"V1" | "V2" | "V3" | "V4" | "V5" | "V6", Vector3> = Object.fromEntries(
  Object.entries(PRECORDIAL_AXES).map(([k, v]) => [k, { x: v.x * 1.25, y: v.y * 1.25, z: v.z * 1.25 }]),
) as Record<"V1" | "V2" | "V3" | "V4" | "V5" | "V6", Vector3>;

/** Per-lead calibration (mV per unit dipole). Tuned once so a normal adult ECG has realistic amplitudes. */
export const LIMB_GAIN = 0.6;
export const PRECORDIAL_GAIN: Record<"V1" | "V2" | "V3" | "V4" | "V5" | "V6", number> = { V1: 0.8, V2: 0.8, V3: 0.8, V4: 0.8, V5: 0.8, V6: 0.8 };

const sub = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: Vector3, k: number): Vector3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const mid = (a: Vector3, b: Vector3): Vector3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
export const vdot = dot;
export const vsub = sub;
export const vscale = scale;
export const vmid = mid;
export const vnorm = (a: Vector3): Vector3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Potential at a limb electrode (far-field). */
export function limbElectrodePotential(p: Vector3, which: keyof typeof LIMB_ELECTRODES): number {
  return LIMB_GAIN * dot(p, LIMB_ELECTRODES[which]);
}

/** Wilson central terminal = mean of the three limb electrode potentials. */
export function wilsonCentralTerminal(p: Vector3): number {
  return (limbElectrodePotential(p, "RA") + limbElectrodePotential(p, "LA") + limbElectrodePotential(p, "LL")) / 3;
}

/** Potential of a precordial electrode: equivalent-dipole potential along the electrode axis (relative to the Wilson terminal below). */
export function precordialPotential(p: Vector3, lead: keyof typeof PRECORDIAL_AXES): number {
  return PRECORDIAL_GAIN[lead] * dot(p, PRECORDIAL_AXES[lead]);
}

/** Lead voltage from a dipole moment p (the `source` position is accepted for a future near-field model and is unused here). */
export function leadVoltageFromDipole(lead: ECGLeadName, p: Vector3, _source?: Vector3): number {
  const pot = (w: keyof typeof LIMB_ELECTRODES) => limbElectrodePotential(p, w);
  switch (lead) {
    case "I": return pot("LA") - pot("RA");
    case "II": return pot("LL") - pot("RA");
    case "III": return pot("LL") - pot("LA");
    case "aVR": return pot("RA") - (pot("LA") + pot("LL")) / 2;
    case "aVL": return pot("LA") - (pot("RA") + pot("LL")) / 2;
    case "aVF": return pot("LL") - (pot("RA") + pot("LA")) / 2;
    default:
      return precordialPotential(p, lead as keyof typeof PRECORDIAL_AXES) - wilsonCentralTerminal(p);
  }
}

/** Equivalent far-field axis for limb leads (documented limitation: precordial leads have no single axis). */
export function leadDefinitions(): LeadDefinition[] {
  const ax = (name: ECGLeadName): Vector3 => {
    // voltage is linear in p, so the axis is the response to unit dipoles
    const r = (p: Vector3) => leadVoltageFromDipole(name, p);
    return { x: r({ x: 1, y: 0, z: 0 }), y: r({ x: 0, y: 1, z: 0 }), z: r({ x: 0, y: 0, z: 1 }) };
  };
  return ECG_LEADS.map((name) => ({
    name,
    axis: ax(name),
    gain: 1,
    baseline: 0,
    electrode: name.startsWith("V") ? PRECORDIAL_ELECTRODES[name as keyof typeof PRECORDIAL_ELECTRODES] : undefined,
  }));
}

export const LEAD_INDEX: Record<ECGLeadName, number> = Object.fromEntries(ECG_LEADS.map((l, i) => [l, i])) as Record<ECGLeadName, number>;
