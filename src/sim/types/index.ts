/** Shared types for ICU 360 Simulation Lab. Pure types + a few constants; no physiology here. */

export type Vector3 = { x: number; y: number; z: number };

export const MODEL_DISCLAIMER =
  "Simplified educational model. Not clinically validated, not diagnostic, not for patient care.";

// ───────────────────────── Clinical content (spec §58, §59, §21) ─────────────────────────
export type ECGLeadName =
  | "I" | "II" | "III"
  | "aVR" | "aVL" | "aVF"
  | "V1" | "V2" | "V3"
  | "V4" | "V5" | "V6";

export const ECG_LEADS: readonly ECGLeadName[] = [
  "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6",
] as const;

export type LeadFindingStatus =
  | "characteristic" | "common" | "reciprocal" | "variable" | "usually_normal" | "not_localising";

export type LeadFinding = {
  lead: ECGLeadName;
  status: LeadFindingStatus;
  pWave?: string;
  qrs?: string;
  stSegment?: string;
  tWave?: string;
  explanation: string;
  confidence: "high" | "moderate" | "low";
};

export type ValidationStatus = "unreviewed" | "reviewed" | "validated";

export type Reference = { title: string; url: string; year?: number };

export type ECGCondition = {
  id: string;
  name: string;
  moduleId: string;
  difficulty: "foundation" | "intermediate" | "advanced";
  mechanismType: "mechanistic" | "pathology_informed" | "recognition";
  affectedStructures: string[];
  normalPhysiology: string;
  abnormalPhysiology: string;
  activationSequence: string[];
  expectedWaveChanges: { p: string; pr: string; qrs: string; st: string; t: string; u?: string; qt?: string };
  leadFindings: LeadFinding[];
  diagnosticCriteria: string[];
  differential: string[];
  clinicalSignificance: string;
  managementPrinciples: string[];
  commonPitfalls: string[];
  references: Reference[];
  validation: { status: ValidationStatus; reviewer?: string; date?: string; notes?: string };
};

// ───────────────────────── Respiratory (spec §23, §26, §59) ─────────────────────────
export type RespiratoryPatient = {
  heightCm: number;
  sex: "male" | "female";
  predictedBodyWeightKg: number;
  /** Lung (not whole-system) compliance, L/cmH2O. */
  complianceLPerCmH2O: number;
  /** Central airway (+ ETT) resistance, cmH2O/(L/s). Peripheral resistance lives in the compartments. */
  airwayResistanceCmH2OPerLPerSec: number;
  chestWallComplianceLPerCmH2O: number;
  deadSpaceL: number;
  shuntFraction: number;
  respiratoryDrive: number;
  /** Peak respiratory muscle pressure (positive = inspiratory effort), cmH2O. 0 = passive. */
  musclePressureAmplitudeCmH2O: number;
  inspiratoryTimeConstantSec: number;
  expiratoryTimeConstantSec: number;
  baselineFRC_L: number;
  spontaneousRateBpm: number;
};

export type LungCompartment = {
  id: string;
  label: string;
  /** Fraction of total lung compliance carried by this compartment (sums to 1 over compartments). */
  complianceFraction: number;
  /** Fraction of total peripheral conductance (1/R) (sums to 1). */
  conductanceFraction: number;
  recruitmentThresholdCmH2O: number;
  closingPressureCmH2O: number;
  overdistensionThresholdL: number;
  perfusionFraction: number;
  deadSpaceFraction: number;
  shuntFraction: number;
  /** Anatomical placement for the schematic view (normalised -1..1). */
  anatomy: { side: "right" | "left"; x: number; y: number; z: number; dependent: boolean };
  /**
   * Fraction (0..1, default 1) of the lobe's alveolar units that are aerated. Compliance and conductance scale linearly with it
   * (0.35 = a mostly collapsed lobe). Distinct from recruitment, which is dynamic and pressure dependent.
   */
  aeration?: number;
  /** One-lung ventilation / pneumothorax: the lobe is isolated from the ventilator circuit (no flow, no volume change, zero ventilation, perfusion continues = shunt). */
  excluded?: boolean;
};

export type VentilatorCase = {
  id: string;
  name: string;
  diagnosis: string;
  difficulty: "foundation" | "intermediate" | "advanced";
  baselinePatient: RespiratoryPatient;
  regionalCompartments: LungCompartment[];
  learningObjectives: string[];
  suggestedExplorationModes: string[];
  expectedWaveformFindings: string[];
  expectedAnatomicalChanges: string[];
  gasExchangeAssumptions: string[];
  haemodynamicAssumptions: string[];
  safetyWarnings: string[];
  references: Reference[];
  validationStatus: ValidationStatus;
};
