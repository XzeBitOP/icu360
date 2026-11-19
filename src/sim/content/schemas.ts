import { z } from "zod";
import { ECG_LEADS } from "@/sim/types";

const validation = z.object({
  status: z.enum(["unreviewed", "reviewed", "validated"]),
  reviewer: z.string().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const reference = z.object({ title: z.string().min(3), url: z.string().url(), year: z.number().int().optional() });

export const leadFindingSchema = z.object({
  lead: z.enum(ECG_LEADS as unknown as [string, ...string[]]),
  status: z.enum(["characteristic", "common", "reciprocal", "variable", "usually_normal", "not_localising"]),
  pWave: z.string().optional(),
  qrs: z.string().optional(),
  stSegment: z.string().optional(),
  tWave: z.string().optional(),
  explanation: z.string().min(5),
  confidence: z.enum(["high", "moderate", "low"]),
});

/** Spec §21/§58: every ECG condition has exactly 12 lead records (one per lead, no duplicates). */
export const ecgConditionSchema = z
  .object({
    id: z.string().min(2),
    name: z.string().min(2),
    moduleId: z.string(),
    difficulty: z.enum(["foundation", "intermediate", "advanced"]),
    mechanismType: z.enum(["mechanistic", "pathology_informed", "recognition"]),
    affectedStructures: z.array(z.string()),
    normalPhysiology: z.string().min(10),
    abnormalPhysiology: z.string().min(10),
    activationSequence: z.array(z.string()).min(3),
    expectedWaveChanges: z.object({ p: z.string(), pr: z.string(), qrs: z.string(), st: z.string(), t: z.string(), u: z.string().optional(), qt: z.string().optional() }),
    leadFindings: z.array(leadFindingSchema).length(12),
    diagnosticCriteria: z.array(z.string()).min(1),
    differential: z.array(z.string()),
    clinicalSignificance: z.string(),
    managementPrinciples: z.array(z.string()),
    commonPitfalls: z.array(z.string()),
    references: z.array(reference).min(1),
    validation,
  })
  .superRefine((c, ctx) => {
    const names = new Set(c.leadFindings.map((l) => l.lead));
    if (names.size !== 12) ctx.addIssue({ code: "custom", message: "leadFindings must cover each of the 12 leads exactly once" });
    if (c.validation.status === "validated" && !c.validation.reviewer) ctx.addIssue({ code: "custom", message: "validated content needs a named reviewer" });
  });

const patientSchema = z.object({
  heightCm: z.number().positive(),
  sex: z.enum(["male", "female"]),
  predictedBodyWeightKg: z.number().positive(),
  complianceLPerCmH2O: z.number().positive(),
  airwayResistanceCmH2OPerLPerSec: z.number().positive(),
  chestWallComplianceLPerCmH2O: z.number().positive(),
  deadSpaceL: z.number().min(0),
  shuntFraction: z.number().min(0).max(1),
  respiratoryDrive: z.number().min(0),
  musclePressureAmplitudeCmH2O: z.number().min(0),
  inspiratoryTimeConstantSec: z.number().positive(),
  expiratoryTimeConstantSec: z.number().positive(),
  baselineFRC_L: z.number().positive(),
  spontaneousRateBpm: z.number().positive(),
});

const compartmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  complianceFraction: z.number().min(0).max(1),
  conductanceFraction: z.number().min(0).max(1),
  recruitmentThresholdCmH2O: z.number(),
  closingPressureCmH2O: z.number(),
  overdistensionThresholdL: z.number().positive(),
  perfusionFraction: z.number().min(0).max(1),
  deadSpaceFraction: z.number().min(0).max(1),
  shuntFraction: z.number().min(0).max(1),
  anatomy: z.object({ side: z.enum(["right", "left"]), x: z.number(), y: z.number(), z: z.number(), dependent: z.boolean() }),
  aeration: z.number().min(0).max(1).optional(),
  excluded: z.boolean().optional(),
});

export const ventilatorCaseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    diagnosis: z.string(),
    difficulty: z.enum(["foundation", "intermediate", "advanced"]),
    baselinePatient: patientSchema,
    regionalCompartments: z.array(compartmentSchema).min(5).max(12),
    learningObjectives: z.array(z.string()).min(1),
    suggestedExplorationModes: z.array(z.string()),
    expectedWaveformFindings: z.array(z.string()).min(1),
    expectedAnatomicalChanges: z.array(z.string()).min(1),
    gasExchangeAssumptions: z.array(z.string()),
    haemodynamicAssumptions: z.array(z.string()),
    safetyWarnings: z.array(z.string()).min(1),
    references: z.array(reference).min(1),
    validationStatus: z.enum(["unreviewed", "reviewed", "validated"]),
  })
  .superRefine((c, ctx) => {
    const sc = c.regionalCompartments.reduce((a, x) => a + x.complianceFraction, 0);
    const sg = c.regionalCompartments.reduce((a, x) => a + x.conductanceFraction, 0);
    if (Math.abs(sc - 1) > 1e-6) ctx.addIssue({ code: "custom", message: `compliance fractions sum to ${sc}, expected 1` });
    if (Math.abs(sg - 1) > 1e-6) ctx.addIssue({ code: "custom", message: `conductance fractions sum to ${sg}, expected 1` });
  });
