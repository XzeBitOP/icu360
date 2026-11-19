import type { LungCompartment, VentilatorCase } from "@/sim/types";
import { makeCompartments, makePatient } from "@/sim/resp";
import type { VentSettings } from "@/sim/vent";

const REFS = [
  { title: "Respiratory Mechanics During Mechanical Ventilation (Respiratory Care)", url: "https://rc.rcjournal.com/content/respcare/59/11/1773.full.pdf", year: 2014 },
  { title: "Go with the flow: clinical importance of flow curves during mechanical ventilation", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7427988/", year: 2020 },
];
const REFS_ARDS = [...REFS, { title: "ATS Clinical Practice Guideline Update on Adult ARDS Management", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/", year: 2024 }];

export type VentilatorPreset = {
  case: VentilatorCase;
  /** Peripheral (small-airway) resistance shared by the compartments, cmH2O/(L/s). */
  peripheralResistance: number;
  suggestedSettings: Partial<VentSettings>;
  /** Short statement of which physiological parameters differ from the healthy adult (spec rule 7). */
  changedParameters: string[];
};

const healthyPatient = makePatient();

const healthy: VentilatorPreset = {
  peripheralResistance: 2,
  suggestedSettings: {},
  changedParameters: ["None: reference passive adult (PBW ≈ 70 kg, lung C 0.17, chest wall C 0.24 → C_RS ≈ 0.10 L/cmH2O; R_total ≈ 7 cmH2O/L/s)."],
  case: {
    id: "healthy-adult", name: "Healthy adult (passive)", diagnosis: "Normal lungs, sedated/paralysed, intubated", difficulty: "foundation",
    baselinePatient: healthyPatient,
    regionalCompartments: makeCompartments({}, healthyPatient.complianceLPerCmH2O),
    learningObjectives: [
      "See how volume control targets volume while pressure is the consequence.",
      "See pressure control target pressure while volume depends on compliance and resistance.",
      "Separate peak (resistive + elastic) from plateau (elastic) pressure with an inspiratory hold.",
    ],
    suggestedExplorationModes: ["VC-A/C", "PC-A/C"],
    expectedWaveformFindings: ["VC: square flow, linear volume rise, ramped pressure with a step from resistance.", "PC: flat pressure plateau, decelerating flow, volume rises exponentially.", "Passive expiration returns volume to baseline."],
    expectedAnatomicalChanges: ["Coordinated expansion of all lung regions.", "Normal airway calibre."],
    gasExchangeAssumptions: ["Dead space 150 mL, shunt 3 %, VCO2 200 mL/min (illustrative)."],
    haemodynamicAssumptions: ["Not modelled; qualitative note only."],
    safetyWarnings: ["Educational model only: not a substitute for clinical judgement or manufacturer documentation."],
    references: REFS, validationStatus: "unreviewed",
  },
};

const ardsPatient = makePatient({ complianceLPerCmH2O: 0.07, airwayResistanceCmH2OPerLPerSec: 5, shuntFraction: 0.3, deadSpaceL: 0.2 });
const ardsComps: LungCompartment[] = makeCompartments(
  {
    // dependent (lower, posterior) units: stiff and collapsed unless recruited by pressure
    RLL: { recruitmentThresholdCmH2O: 14, closingPressureCmH2O: 8 },
    LLL: { recruitmentThresholdCmH2O: 14, closingPressureCmH2O: 8 },
    RML: { complianceFraction: 0.07, conductanceFraction: 0.07 },
    RUL: { complianceFraction: 0.2, conductanceFraction: 0.2 },
    LUL: { complianceFraction: 0.25, conductanceFraction: 0.25 },
    RLL2: undefined,
  },
  ardsPatient.complianceLPerCmH2O,
);
// fractions sum to 1: RUL .2, RML .07, RLL .25, LUL .25 (incl. lingula), LLL .23
ardsComps.find((c) => c.id === "RLL")!.complianceFraction = 0.25;
ardsComps.find((c) => c.id === "RLL")!.conductanceFraction = 0.25;
ardsComps.find((c) => c.id === "LLL")!.complianceFraction = 0.23;
ardsComps.find((c) => c.id === "LLL")!.conductanceFraction = 0.23;
for (const c of ardsComps) {
  c.overdistensionThresholdL = 25 * ardsPatient.complianceLPerCmH2O * c.complianceFraction;
  c.shuntFraction = c.anatomy.dependent ? 0.45 : 0.1;
}

const ards: VentilatorPreset = {
  peripheralResistance: 2.5,
  suggestedSettings: { vtMl: 420, rr: 20, peepCmH2O: 10, fio2: 0.6 },
  changedParameters: ["Lung compliance 0.17 → 0.07 L/cmH2O", "Dependent lower-lobe units have an opening pressure of 14 and closing pressure of 8 cmH2O (recruitable atelectasis)", "Shunt 3 % → 30 %, dead space 150 → 200 mL"],
  case: {
    id: "ards-like", name: "ARDS-like: low compliance, heterogeneous", diagnosis: "Acute hypoxaemic respiratory failure with reduced compliance (educational ARDS-like model)", difficulty: "intermediate",
    baselinePatient: ardsPatient, regionalCompartments: ardsComps,
    learningObjectives: [
      "Lower compliance raises plateau pressure and driving pressure for the same tidal volume.",
      "Tidal volume is scaled to predicted body weight, not actual weight.",
      "Observe how PEEP changes recruitment of the dependent units and the resulting compliance (and the cost: higher end-expiratory pressures).",
    ],
    suggestedExplorationModes: ["VC-A/C", "PC-A/C"],
    expectedWaveformFindings: ["Steeper pressure rise in VC for the same volume (higher plateau).", "In PC the delivered volume falls and flow decays quickly (short time constant).", "The pressure–volume relationship changes when dependent units open."],
    expectedAnatomicalChanges: ["Collapsed dependent units at low PEEP; some recruit with higher pressure.", "Non-dependent units receive more of the tidal volume and expand more (relative overdistension risk)."],
    gasExchangeAssumptions: ["Shunt 30 % (illustrative) so PaO2 responds weakly to FiO2.", "Dead space increased."],
    haemodynamicAssumptions: ["Not modelled; higher mean airway pressure can reduce venous return in real patients."],
    safetyWarnings: ["Educational demonstration only: not a recommendation of any ventilator strategy for ARDS.", "No single setting is correct for every patient; individualise using mechanics, gas exchange and haemodynamics."],
    references: REFS_ARDS, validationStatus: "unreviewed",
  },
};

const obstructPatient = makePatient({ complianceLPerCmH2O: 0.25, airwayResistanceCmH2OPerLPerSec: 8, deadSpaceL: 0.25, shuntFraction: 0.05 });
const obstructComps = makeCompartments(
  {
    RUL: { complianceFraction: 0.17, conductanceFraction: 0.1 },
    RML: { complianceFraction: 0.09, conductanceFraction: 0.05 },
    RLL: { complianceFraction: 0.26, conductanceFraction: 0.3 },
    LUL: { complianceFraction: 0.2, conductanceFraction: 0.15 },
    LLL: { complianceFraction: 0.28, conductanceFraction: 0.4 },
  },
  obstructPatient.complianceLPerCmH2O,
);
const obstructive: VentilatorPreset = {
  peripheralResistance: 14,
  suggestedSettings: { vtMl: 450, rr: 16, inspFlowLpm: 80, peepCmH2O: 5 },
  changedParameters: ["Central + peripheral resistance raised (R_aw 5 → 8; peripheral 2 → 14 cmH2O/L/s, uneven between regions)", "Lung compliance raised 0.17 → 0.25 L/cmH2O (hyperinflated, emphysema-like)", "Dead space 150 → 250 mL"],
  case: {
    id: "obstructive", name: "High-resistance obstruction (COPD / asthma-like)", diagnosis: "Expiratory airflow obstruction with a long expiratory time constant (educational model)", difficulty: "intermediate",
    baselinePatient: obstructPatient, regionalCompartments: obstructComps,
    learningObjectives: [
      "Higher resistance raises peak pressure far more than plateau pressure in volume control.",
      "A long expiratory time constant (τ = R × C) means expiration may not finish: expiratory flow does not return to zero before the next breath.",
      "Incomplete expiration traps gas and raises end-expiratory pressure (auto-PEEP) and volume (dynamic hyperinflation); expiratory time and rate are determinants.",
    ],
    suggestedExplorationModes: ["VC-A/C", "PC-A/C"],
    expectedWaveformFindings: ["Large Ppeak–Pplat gap in VC.", "Slowly decaying expiratory flow that fails to reach zero at higher rates.", "End-expiratory volume does not return to baseline (trapped gas) with an expiratory hold showing total PEEP > set PEEP."],
    expectedAnatomicalChanges: ["Uneven filling: low-conductance regions fill and empty slowly.", "Hyperinflation when expiration is incomplete."],
    gasExchangeAssumptions: ["Increased dead space; CO2 retention when minute ventilation is limited."],
    haemodynamicAssumptions: ["Air trapping raises intrathoracic pressure in real patients; not quantified here."],
    safetyWarnings: ["Educational model: does not replace clinical decision-making. Auto-PEEP assessment requires an expiratory hold in a passive patient."],
    references: REFS, validationStatus: "unreviewed",
  },
};

export const VENTILATOR_PRESETS: Record<string, VentilatorPreset> = {
  "healthy-adult": healthy,
  "ards-like": ards,
  obstructive,
};
export const VENTILATOR_CASES: VentilatorCase[] = Object.values(VENTILATOR_PRESETS).map((p) => p.case);
