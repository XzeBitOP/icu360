/**
 * SIMPLIFIED gas-exchange model (spec §51). Steady-state, single patient-wide shunt/dead-space description.
 * Outputs are DIRECTIONAL TRENDS for teaching, not predictions for a real patient.
 *
 * Units: volumes mL or L as named; pressures mmHg; flows L/min.
 *  - Alveolar ventilation  VA = RR × (VT − VD)                       [L/min]
 *  - PaCO2 = 0.863 × VCO2 / VA                                        [mmHg; VCO2 in mL/min STPD, VA in L/min BTPS; steady state]
 *  - Alveolar gas equation PAO2 = FiO2 (PB − PH2O) − PaCO2 / RQ        [mmHg]
 *  - Oxygenation: shunt mixing of end-capillary and mixed-venous content, solved for PaO2 (bisection)
 *  - SpO2 from PaO2 via the Severinghaus (1979) oxyhaemoglobin dissociation curve approximation (PaO2 → SaO2)
 *  - pH from Henderson–Hasselbalch with fixed HCO3− (acute respiratory change only; no renal compensation)
 */
export const GAS_PARAMS = {
  barometricMmHg: 760,
  waterVapourMmHg: 47,
  respiratoryQuotient: 0.8,
  hbGPerDl: 14,
  /** Arterio-venous O2 content difference (mL/dL) used to set mixed-venous content. */
  avDifferenceMlPerDl: 5,
  hco3MmolPerL: 24,
  vco2MlPerMin: 200,
};

export const minuteVentilationLPerMin = (rr: number, vtL: number) => rr * vtL;
export const alveolarVentilationLPerMin = (rr: number, vtL: number, deadSpaceL: number) => rr * Math.max(vtL - deadSpaceL, 0);
export const deadSpaceFraction = (vtL: number, deadSpaceL: number) => (vtL > 0 ? Math.min(deadSpaceL / vtL, 1) : 1);

export function paco2MmHg(vco2MlPerMin: number, vaLPerMin: number): number {
  if (vaLPerMin <= 0.05) return 120;
  return Math.min(0.863 * (vco2MlPerMin / vaLPerMin), 120);
}

/** Severinghaus approximation: SaO2 (0..1) from PO2 (mmHg). Standard conditions; P50 ≈ 26.8 mmHg. */
export function saO2Severinghaus(po2: number): number {
  const p = Math.max(po2, 0);
  return 1 / (23400 / (p * p * p + 150 * p) + 1);
}

export const alveolarPo2 = (fio2: number, paco2: number, p = GAS_PARAMS) =>
  fio2 * (p.barometricMmHg - p.waterVapourMmHg) - paco2 / p.respiratoryQuotient;

const content = (po2: number, hb: number) => 1.34 * hb * saO2Severinghaus(po2) + 0.003 * po2; // mL O2 / dL

/** PaO2 from shunt mixing: CaO2 = (1−Qs) Cc' + Qs Cv, with Cv = CaO2 − AVDO2. Solved by bisection. */
export function pao2WithShunt(pAO2: number, shuntFraction: number, p = GAS_PARAMS): number {
  const cc = content(Math.max(pAO2, 1), p.hbGPerDl);
  const f = (pao2: number) => {
    const ca = content(pao2, p.hbGPerDl);
    const cv = ca - p.avDifferenceMlPerDl;
    return (1 - shuntFraction) * cc + shuntFraction * cv - ca;
  };
  let lo = 1, hi = Math.max(pAO2, 2);
  if (f(lo) < 0) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const phHendersonHasselbalch = (paco2: number, hco3 = GAS_PARAMS.hco3MmolPerL) => 6.1 + Math.log10(hco3 / (0.03 * Math.max(paco2, 1)));

export type GasExchangeInput = { fio2: number; rr: number; vtL: number; deadSpaceL: number; shuntFraction: number; vco2MlPerMin?: number };
export type GasExchangeResult = {
  minuteVentilationLPerMin: number;
  alveolarVentilationLPerMin: number;
  deadSpaceFraction: number;
  paco2MmHg: number;
  alveolarPo2MmHg: number;
  pao2MmHg: number;
  spo2Percent: number;
  ph: number;
  pfRatio: number | null;
  shuntFraction: number;
  assumptions: string[];
};

export function computeGasExchange(i: GasExchangeInput): GasExchangeResult {
  const va = alveolarVentilationLPerMin(i.rr, i.vtL, i.deadSpaceL);
  const pc = paco2MmHg(i.vco2MlPerMin ?? GAS_PARAMS.vco2MlPerMin, va);
  const pA = alveolarPo2(i.fio2, pc);
  const pa = pao2WithShunt(pA, i.shuntFraction);
  return {
    minuteVentilationLPerMin: minuteVentilationLPerMin(i.rr, i.vtL),
    alveolarVentilationLPerMin: va,
    deadSpaceFraction: deadSpaceFraction(i.vtL, i.deadSpaceL),
    paco2MmHg: pc,
    alveolarPo2MmHg: pA,
    pao2MmHg: pa,
    spo2Percent: saO2Severinghaus(pa) * 100,
    ph: phHendersonHasselbalch(pc),
    pfRatio: i.fio2 > 0 ? pa / i.fio2 : null,
    shuntFraction: i.shuntFraction,
    assumptions: [
      "Steady state; fixed CO2 production and O2 consumption.",
      "One patient-wide shunt fraction and dead-space volume; no regional V/Q model.",
      "pH uses fixed bicarbonate (no metabolic or renal compensation).",
      "Directional teaching trend, not a prediction for a real patient.",
    ],
  };
}
