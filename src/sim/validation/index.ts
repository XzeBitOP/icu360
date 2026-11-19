/**
 * Reference / validation records (spec §62). Phase 1 holds ANALYTIC reference cases (closed-form results of the equations)
 * and published ADULT REFERENCE RANGES. No third-party waveform data is stored. Every record carries source, licence,
 * annotation and reviewer; reviewer = null means "not yet clinically reviewed" and the case must NOT be called validated.
 */
export type ReferenceMetric = { metric: string; min: number; max: number; unit: string; rationale: string };

export type ReferenceCase = {
  id: string;
  domain: "ecg" | "ventilator";
  title: string;
  kind: "published-reference-range" | "analytic-solution";
  source: { title: string; url: string; licence: string };
  annotation: string;
  reviewer: string | null;
  status: "unreviewed" | "reviewed" | "validated";
  expected: ReferenceMetric[];
};

const AHA = { title: "AHA/ACCF/HRS recommendations for the standardization and interpretation of the ECG (2007/2009)", url: "https://www.jacc.org/doi/10.1016/j.jacc.2007.01.024", licence: "Reference values quoted only; no figures or waveform data copied" };
const RESPCARE = { title: "Respiratory Mechanics During Mechanical Ventilation (Respir Care 2014)", url: "https://rc.rcjournal.com/content/respcare/59/11/1773.full.pdf", licence: "Equations quoted only; no figures copied" };
const FLOW = { title: "Go with the flow: clinical importance of flow curves during mechanical ventilation (2020)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7427988/", licence: "CC BY; concepts only" };

export const ECG_REFERENCE_CASES: ReferenceCase[] = [
  {
    id: "ecg-nsr-ranges", domain: "ecg", title: "Normal sinus rhythm, adult reference ranges", kind: "published-reference-range", source: AHA,
    annotation: "Adult reference ranges for intervals; the simplified model is tuned to fall inside them at 72/min.", reviewer: null, status: "unreviewed",
    expected: [
      { metric: "heartRateBpm", min: 60, max: 100, unit: "beats/min", rationale: "Sinus rhythm range" },
      { metric: "prMs", min: 120, max: 200, unit: "ms", rationale: "Normal PR interval" },
      { metric: "qrsMs", min: 70, max: 110, unit: "ms", rationale: "Normal QRS duration (upper limit ≈ 110 ms in adults)" },
      { metric: "qtcMs", min: 350, max: 450, unit: "ms", rationale: "Normal QTc range (Bazett)" },
      { metric: "frontalAxisDeg", min: -30, max: 90, unit: "degrees", rationale: "Normal frontal QRS axis" },
    ],
  },
  {
    id: "ecg-lbbb-ranges", domain: "ecg", title: "Complete LBBB criteria", kind: "published-reference-range", source: AHA,
    annotation: "Complete LBBB: QRS ≥ 120 ms; broad R in I, V5–V6 without septal q; negative QRS in V1; secondary ST–T discordance.", reviewer: null, status: "unreviewed",
    expected: [{ metric: "qrsMs", min: 120, max: 200, unit: "ms", rationale: "QRS ≥ 120 ms" }],
  },
  {
    id: "ecg-rbbb-ranges", domain: "ecg", title: "Complete RBBB criteria", kind: "published-reference-range", source: AHA,
    annotation: "Complete RBBB: QRS ≥ 120 ms; terminal R′ in V1; broad terminal S in I and V6.", reviewer: null, status: "unreviewed",
    expected: [{ metric: "qrsMs", min: 120, max: 200, unit: "ms", rationale: "QRS ≥ 120 ms" }],
  },
];

export const VENTILATOR_REFERENCE_CASES: ReferenceCase[] = [
  {
    id: "vent-normal-vc", domain: "ventilator", title: "Normal passive VC (square flow)", kind: "analytic-solution", source: RESPCARE,
    annotation: "Pplat = PEEP + VT / C_RS; Ppeak − Pplat = R × Flow (square flow); τ = R × C. For VT 0.45 L, flow 1 L/s, PEEP 5, C_RS 0.0995 L/cmH2O, R 7 cmH2O/L/s: Pplat ≈ 9.5, Ppeak ≈ 16.5.", reviewer: null, status: "unreviewed",
    expected: [
      { metric: "pplat", min: 9.3, max: 9.7, unit: "cmH2O", rationale: "PEEP + VT/C" },
      { metric: "ppeak", min: 16.2, max: 16.8, unit: "cmH2O", rationale: "Pplat + R·Flow" },
    ],
  },
  {
    id: "vent-normal-pc", domain: "ventilator", title: "Normal passive PC (pressure target)", kind: "analytic-solution", source: RESPCARE,
    annotation: "Volume approaches C_RS × P_insp with time constant τ = R × C; at Ti ≫ 3τ delivered volume ≈ C_RS × ΔP. With P_insp 12 and C_RS 0.0995, Ti 1 s (τ≈0.7 s) delivers about 0.7 × 1.19 L ≈ 0.8 L × (1 − e^(−Ti/τ)).", reviewer: null, status: "unreviewed",
    expected: [{ metric: "vtiL", min: 0.5, max: 1.2, unit: "L", rationale: "C_RS·ΔP·(1−e^(−Ti/τ))" }],
  },
  {
    id: "vent-reduced-compliance", domain: "ventilator", title: "Reduced-compliance pressure waveform", kind: "analytic-solution", source: RESPCARE,
    annotation: "Halving C_RS doubles the elastic component VT/C of the pressure at the same VT in volume control.", reviewer: null, status: "unreviewed",
    expected: [{ metric: "pplatRatio", min: 1.5, max: 2.5, unit: "×(Pplat−PEEP)", rationale: "Elastic pressure ∝ 1/C" }],
  },
  {
    id: "vent-obstructive-flow", domain: "ventilator", title: "Obstructive expiratory flow-time waveform", kind: "analytic-solution", source: FLOW,
    annotation: "Expiratory flow decays exponentially with τ = R × C; a prolonged τ means expiratory flow may not reach zero before the next breath.", reviewer: null, status: "unreviewed",
    expected: [{ metric: "expiratoryTimeConstantSec", min: 1.0, max: 4.0, unit: "s", rationale: "Prolonged τ with raised resistance" }],
  },
  {
    id: "vent-auto-peep", domain: "ventilator", title: "Auto-PEEP from incomplete expiration", kind: "analytic-solution", source: FLOW,
    annotation: "When expiratory time is short relative to τ, end-expiratory alveolar pressure exceeds set PEEP and an expiratory hold shows total PEEP > set PEEP.", reviewer: null, status: "unreviewed",
    expected: [{ metric: "peepTotalMinusSet", min: 0.5, max: 30, unit: "cmH2O", rationale: "Auto-PEEP" }],
  },
];
