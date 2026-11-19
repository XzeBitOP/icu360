import type { LungCompartment, RespiratoryPatient } from "@/sim/types";

/** Predicted body weight, ARDSNet formula (kg). Height in cm. */
export function predictedBodyWeightKg(heightCm: number, sex: "male" | "female"): number {
  return (sex === "male" ? 50 : 45.5) + 0.91 * (heightCm - 152.4);
}

/** Series combination of lung and chest-wall compliance: 1/C_RS = 1/C_L + 1/C_CW. */
export function respiratorySystemCompliance(cL: number, cCW: number): number {
  return 1 / (1 / cL + 1 / cCW);
}

export function makePatient(p: Partial<RespiratoryPatient> = {}): RespiratoryPatient {
  const heightCm = p.heightCm ?? 175;
  const sex = p.sex ?? "male";
  return {
    heightCm,
    sex,
    predictedBodyWeightKg: predictedBodyWeightKg(heightCm, sex),
    complianceLPerCmH2O: 0.17,
    airwayResistanceCmH2OPerLPerSec: 5,
    chestWallComplianceLPerCmH2O: 0.24,
    deadSpaceL: 0.15,
    shuntFraction: 0.03,
    respiratoryDrive: 0,
    musclePressureAmplitudeCmH2O: 0,
    inspiratoryTimeConstantSec: 0.7,
    expiratoryTimeConstantSec: 0.7,
    baselineFRC_L: 2.4,
    spontaneousRateBpm: 14,
    ...p,
  };
}

/** Peripheral (small-airway) resistance shared by the compartments in parallel, cmH2O/(L/s). */
export const DEFAULT_PERIPHERAL_RESISTANCE = 2;

/** Transpulmonary pressure (cmH2O) at which the display flags overdistension. Educational threshold, not a validated limit. */
export const OVERDISTENSION_PTP_CMH2O = 25;

export function makeCompartments(over: Partial<Record<string, Partial<LungCompartment>>> = {}, lungCompliance = 0.17): LungCompartment[] {
  const base: LungCompartment[] = [
    { id: "RUL", label: "Right upper", complianceFraction: 0.17, conductanceFraction: 0.17, anatomy: { side: "right", x: 0.55, y: 0.55, z: 0.2, dependent: false } },
    { id: "RML", label: "Right middle", complianceFraction: 0.09, conductanceFraction: 0.09, anatomy: { side: "right", x: 0.6, y: 0.0, z: 0.45, dependent: false } },
    { id: "RLL", label: "Right lower", complianceFraction: 0.26, conductanceFraction: 0.26, anatomy: { side: "right", x: 0.55, y: -0.55, z: -0.4, dependent: true } },
    { id: "LUL", label: "Left upper (incl. lingula)", complianceFraction: 0.2, conductanceFraction: 0.2, anatomy: { side: "left", x: -0.55, y: 0.4, z: 0.25, dependent: false } },
    { id: "LLL", label: "Left lower", complianceFraction: 0.28, conductanceFraction: 0.28, anatomy: { side: "left", x: -0.55, y: -0.55, z: -0.4, dependent: true } },
  ].map((c) => ({
    ...c,
    recruitmentThresholdCmH2O: 0,
    closingPressureCmH2O: -100,
    overdistensionThresholdL: OVERDISTENSION_PTP_CMH2O * lungCompliance * c.complianceFraction,
    perfusionFraction: c.complianceFraction,
    deadSpaceFraction: 0,
    shuntFraction: 0,
  })) as LungCompartment[];
  return base.map((c) => ({ ...c, ...(over[c.id] ?? {}) }));
}

/** Normalise fraction fields so they sum to 1 (user edits may break the sums). */
export function normaliseCompartments(cs: LungCompartment[]): LungCompartment[] {
  const sc = cs.reduce((a, c) => a + c.complianceFraction, 0) || 1;
  const sg = cs.reduce((a, c) => a + c.conductanceFraction, 0) || 1;
  return cs.map((c) => ({ ...c, complianceFraction: c.complianceFraction / sc, conductanceFraction: c.conductanceFraction / sg }));
}

/** Ids of the five lobes in display order, and the keys of the 3D/agent API (`rul` … `lll`). */
export const LOBE_IDS = ["RUL", "RML", "RLL", "LUL", "LLL"] as const;
export type LobeId = (typeof LOBE_IDS)[number];
export const LOBE_KEYS: Record<LobeId, "rul" | "rml" | "rll" | "lul" | "lll"> = { RUL: "rul", RML: "rml", RLL: "rll", LUL: "lul", LLL: "lll" };

/**
 * Patient-wide shunt including lobes that are isolated (excluded) or partly unaerated: perfusion continues through them but they
 * receive no ventilation. Shunt = base + (1 − base) · Σ perfusion_i · unventilated_i. Hypoxic pulmonary vasoconstriction is NOT modelled
 * (it would reduce this shunt in a real patient), so the value is an upper-bound teaching trend.
 */
export function lobarShuntFraction(compartments: LungCompartment[], baseShunt: number): number {
  const total = compartments.reduce((a, c) => a + c.perfusionFraction, 0) || 1;
  let un = 0;
  for (const c of compartments) un += (c.perfusionFraction / total) * (c.excluded ? 1 : 1 - Math.min(1, Math.max(c.aeration ?? 1, 0)));
  return Math.min(1, baseShunt + (1 - baseShunt) * un);
}
