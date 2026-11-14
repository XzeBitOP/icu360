/**
 * Stepwise arterial blood gas interpretation (adults).
 * Units: pCO2 mmHg, HCO3/Na/Cl mmol/L, albumin g/dL.
 * Rules used (standard bedside approximations):
 *   Normal: pH 7.35–7.45, pCO2 35–45, HCO3 22–26, AG 8–12 (Na − [Cl + HCO3], no K+); 12 used as the "normal" AG.
 *   Consistency: Henderson–Hasselbalch pH = 6.1 + log10(HCO3 / (0.03 × pCO2)); flag if |Δ| > 0.05 (≈ the H+ = 24 × pCO2/HCO3 check).
 *   Metabolic acidosis: Winter's expected pCO2 = 1.5 × HCO3 + 8 ± 2.
 *   Metabolic alkalosis: expected pCO2 = 0.7 × HCO3 + 21 ± 2.
 *   Respiratory acidosis: HCO3 rises 1 (acute) or 3.5 (chronic) per 10 mmHg pCO2 above 40.
 *   Respiratory alkalosis: HCO3 falls 2 (acute) or 5 (chronic) per 10 mmHg pCO2 below 40.
 *   Albumin-corrected AG = AG + 2.5 × (4 − albumin g/dL).
 *   Delta ratio = (AG − 12) / (24 − HCO3): <0.4 NAGMA; 0.4–0.8 HAGMA + NAGMA; 0.8–2 pure HAGMA; >2 HAGMA + metabolic alkalosis.
 */
export interface AbgInput {
  ph: number;
  pco2: number;
  hco3: number;
  na?: number;
  cl?: number;
  albumin?: number;
}

export type Tone = "ok" | "info" | "warn" | "crit";
export interface AbgStep {
  id: string;
  title: string;
  result: string;
  detail?: string;
  tone: Tone;
}

export type Primary =
  | "normal"
  | "metabolic-acidosis"
  | "metabolic-alkalosis"
  | "respiratory-acidosis"
  | "respiratory-alkalosis"
  | "mixed-acidosis"
  | "mixed-alkalosis"
  | "mixed-normal-ph";

export interface AbgResult {
  steps: AbgStep[];
  primary: Primary;
  diagnoses: string[];
  ag?: number;
  correctedAg?: number;
  deltaRatio?: number;
  expectedPco2?: [number, number];
  consistent: boolean;
  calcPh: number;
  hagma: boolean;
}

export const NORMAL = { phLow: 7.35, phHigh: 7.45, pco2Low: 35, pco2High: 45, hco3Low: 22, hco3High: 26, ag: 12, agHigh: 12 };

const r1 = (n: number) => (Math.round(n * 10) / 10).toString();
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export function validateAbg(i: AbgInput): string[] {
  const e: string[] = [];
  if (!(i.ph >= 6.5 && i.ph <= 8)) e.push("pH must be between 6.50 and 8.00");
  if (!(i.pco2 >= 5 && i.pco2 <= 200)) e.push("pCO₂ must be between 5 and 200 mmHg");
  if (!(i.hco3 >= 1 && i.hco3 <= 70)) e.push("HCO₃⁻ must be between 1 and 70 mmol/L");
  if (i.na !== undefined && !(i.na >= 90 && i.na <= 200)) e.push("Na⁺ must be between 90 and 200 mmol/L");
  if (i.cl !== undefined && !(i.cl >= 50 && i.cl <= 160)) e.push("Cl⁻ must be between 50 and 160 mmol/L");
  if (i.albumin !== undefined && !(i.albumin >= 0.5 && i.albumin <= 7)) e.push("Albumin must be in g/dL (0.5–7)");
  return e;
}

export function interpretAbg(i: AbgInput): AbgResult {
  const steps: AbgStep[] = [];
  const diagnoses: string[] = [];
  const { ph, pco2, hco3 } = i;

  // 1. Internal consistency
  const calcPh = 6.1 + Math.log10(hco3 / (0.03 * pco2));
  const consistent = Math.abs(calcPh - ph) <= 0.05;
  steps.push({
    id: "consistency",
    title: "1 · Is the gas internally consistent?",
    result: consistent ? "Yes" : "No – check the sample",
    detail: `Henderson–Hasselbalch pH from pCO₂ and HCO₃⁻ = ${r2(calcPh)} (measured ${r2(ph)}). ${
      consistent ? "Within 0.05, so the values agree." : "Differs by more than 0.05: transcription error, venous sample or timing mismatch. Repeat before acting."
    }`,
    tone: consistent ? "ok" : "warn",
  });

  // 2. pH
  const acidaemia = ph < NORMAL.phLow;
  const alkalaemia = ph > NORMAL.phHigh;
  steps.push({
    id: "ph",
    title: "2 · Acidaemia or alkalaemia?",
    result: acidaemia ? "Acidaemia" : alkalaemia ? "Alkalaemia" : "pH in the normal range",
    detail: `pH ${r2(ph)} (normal 7.35–7.45).`,
    tone: acidaemia || alkalaemia ? (ph < 7.2 || ph > 7.6 ? "crit" : "warn") : "ok",
  });

  // 3. Primary process
  const lowHco3 = hco3 < NORMAL.hco3Low;
  const highHco3 = hco3 > NORMAL.hco3High;
  const highCo2 = pco2 > NORMAL.pco2High;
  const lowCo2 = pco2 < NORMAL.pco2Low;
  let primary: Primary = "normal";
  let primaryText = "";
  if (acidaemia) {
    if (lowHco3 && highCo2) { primary = "mixed-acidosis"; primaryText = "Mixed metabolic and respiratory acidosis (low HCO₃⁻ and high pCO₂)"; }
    else if (lowHco3) { primary = "metabolic-acidosis"; primaryText = "Metabolic acidosis (low HCO₃⁻)"; }
    else if (highCo2) { primary = "respiratory-acidosis"; primaryText = "Respiratory acidosis (high pCO₂)"; }
    else { primary = "metabolic-acidosis"; primaryText = "Acidaemia with borderline values: treat as an early metabolic acidosis and check the anion gap"; }
  } else if (alkalaemia) {
    if (highHco3 && lowCo2) { primary = "mixed-alkalosis"; primaryText = "Mixed metabolic and respiratory alkalosis (high HCO₃⁻ and low pCO₂)"; }
    else if (highHco3) { primary = "metabolic-alkalosis"; primaryText = "Metabolic alkalosis (high HCO₃⁻)"; }
    else if (lowCo2) { primary = "respiratory-alkalosis"; primaryText = "Respiratory alkalosis (low pCO₂)"; }
    else { primary = "metabolic-alkalosis"; primaryText = "Alkalaemia with borderline values"; }
  } else {
    if (highCo2 && highHco3) { primary = "mixed-normal-ph"; primaryText = "Normal pH but high pCO₂ and high HCO₃⁻: respiratory acidosis with metabolic alkalosis (compensation rarely normalises pH fully)"; }
    else if (lowCo2 && lowHco3) { primary = "mixed-normal-ph"; primaryText = "Normal pH but low pCO₂ and low HCO₃⁻: respiratory alkalosis with metabolic acidosis (e.g. salicylate, sepsis, liver failure)"; }
    else if (highCo2 || lowCo2 || highHco3 || lowHco3) { primary = "normal"; primaryText = "Normal pH with one abnormal value: look for a hidden disorder (anion gap below)"; }
    else { primary = "normal"; primaryText = "No primary acid–base disturbance on pH, pCO₂ and HCO₃⁻"; }
  }
  steps.push({
    id: "primary",
    title: "3 · What is the primary process?",
    result: primaryText,
    detail: `pCO₂ ${r1(pco2)} mmHg (35–45), HCO₃⁻ ${r1(hco3)} mmol/L (22–26).`,
    tone: primary === "normal" ? "ok" : primary.startsWith("mixed") ? "crit" : "warn",
  });

  // 4. Compensation
  let expectedPco2: [number, number] | undefined;
  const compDx: string[] = [];
  if (primary === "metabolic-acidosis") {
    const mid = 1.5 * hco3 + 8;
    expectedPco2 = [mid - 2, mid + 2];
    let res: string;
    let tone: Tone = "ok";
    if (pco2 > mid + 2) { res = "pCO₂ higher than expected: additional respiratory acidosis"; tone = "crit"; compDx.push("Concomitant respiratory acidosis (inadequate respiratory compensation)"); }
    else if (pco2 < mid - 2) { res = "pCO₂ lower than expected: additional respiratory alkalosis"; tone = "warn"; compDx.push("Concomitant respiratory alkalosis"); }
    else res = "Appropriate respiratory compensation";
    steps.push({ id: "comp", title: "4 · Is compensation appropriate? (Winter's formula)", result: res, detail: `Expected pCO₂ = 1.5 × ${r1(hco3)} + 8 ± 2 = ${r1(mid - 2)}–${r1(mid + 2)} mmHg; measured ${r1(pco2)}.`, tone });
  } else if (primary === "metabolic-alkalosis") {
    const mid = 0.7 * hco3 + 21;
    expectedPco2 = [mid - 2, mid + 2];
    let res: string;
    let tone: Tone = "ok";
    if (pco2 > mid + 2) { res = "pCO₂ higher than expected: additional respiratory acidosis"; tone = "warn"; compDx.push("Concomitant respiratory acidosis"); }
    else if (pco2 < mid - 2) { res = "pCO₂ lower than expected: additional respiratory alkalosis"; tone = "warn"; compDx.push("Concomitant respiratory alkalosis"); }
    else res = "Appropriate respiratory compensation";
    steps.push({ id: "comp", title: "4 · Is compensation appropriate?", result: res, detail: `Expected pCO₂ = 0.7 × ${r1(hco3)} + 21 ± 2 = ${r1(mid - 2)}–${r1(mid + 2)} mmHg; measured ${r1(pco2)}. Compensation rarely takes pCO₂ above ~55.`, tone });
  } else if (primary === "respiratory-acidosis") {
    const d = (pco2 - 40) / 10;
    const acute = 24 + 1 * d;
    const chronic = 24 + 3.5 * d;
    let res: string;
    let tone: Tone = "ok";
    if (hco3 > chronic + 2) { res = "HCO₃⁻ higher than even chronic compensation: additional metabolic alkalosis"; tone = "warn"; compDx.push("Concomitant metabolic alkalosis"); }
    else if (hco3 < acute - 2) { res = "HCO₃⁻ lower than acute compensation: additional metabolic acidosis"; tone = "crit"; compDx.push("Concomitant metabolic acidosis"); }
    else if (Math.abs(hco3 - acute) <= 2) res = "Acute respiratory acidosis (compensation as expected)";
    else if (Math.abs(hco3 - chronic) <= 2) res = "Chronic (compensated) respiratory acidosis";
    else res = "Between acute and chronic: acute-on-chronic respiratory acidosis";
    steps.push({ id: "comp", title: "4 · Acute or chronic? Is compensation appropriate?", result: res, detail: `Expected HCO₃⁻: acute ≈ ${r1(acute)} (+1 per 10 mmHg), chronic ≈ ${r1(chronic)} (+3.5 per 10 mmHg); measured ${r1(hco3)}.`, tone });
  } else if (primary === "respiratory-alkalosis") {
    const d = (40 - pco2) / 10;
    const acute = 24 - 2 * d;
    const chronic = 24 - 5 * d;
    let res: string;
    let tone: Tone = "ok";
    if (hco3 < chronic - 2) { res = "HCO₃⁻ lower than even chronic compensation: additional metabolic acidosis"; tone = "warn"; compDx.push("Concomitant metabolic acidosis"); }
    else if (hco3 > acute + 2) { res = "HCO₃⁻ higher than acute compensation: additional metabolic alkalosis"; tone = "warn"; compDx.push("Concomitant metabolic alkalosis"); }
    else if (Math.abs(hco3 - acute) <= 2) res = "Acute respiratory alkalosis (compensation as expected)";
    else if (Math.abs(hco3 - chronic) <= 2) res = "Chronic (compensated) respiratory alkalosis";
    else res = "Between acute and chronic compensation";
    steps.push({ id: "comp", title: "4 · Acute or chronic? Is compensation appropriate?", result: res, detail: `Expected HCO₃⁻: acute ≈ ${r1(acute)} (−2 per 10 mmHg), chronic ≈ ${r1(chronic)} (−5 per 10 mmHg); measured ${r1(hco3)}.`, tone });
  } else if (primary === "mixed-acidosis" || primary === "mixed-alkalosis" || primary === "mixed-normal-ph") {
    steps.push({ id: "comp", title: "4 · Compensation", result: "Not applicable: two primary processes are present", detail: "pCO₂ and HCO₃⁻ are moving in directions that compensation cannot explain.", tone: "crit" });
  }

  // 5. Anion gap
  let ag: number | undefined;
  let correctedAg: number | undefined;
  let deltaRatio: number | undefined;
  let hagma = false;
  if (i.na !== undefined && i.cl !== undefined) {
    ag = i.na - (i.cl + hco3);
    const useAlb = i.albumin !== undefined;
    correctedAg = useAlb ? ag + 2.5 * (4 - (i.albumin as number)) : undefined;
    const agForDx = correctedAg ?? ag;
    hagma = agForDx > NORMAL.agHigh;
    const metabolicAcid = primary === "metabolic-acidosis" || primary === "mixed-acidosis" || (primary === "mixed-normal-ph" && lowHco3) || compDx.some((d) => d.includes("metabolic acidosis"));
    let res: string;
    if (hagma) res = `High anion gap (${r1(agForDx)}): high anion gap metabolic acidosis present`;
    else if (metabolicAcid) res = `Normal anion gap (${r1(agForDx)}): normal anion gap (hyperchloraemic) metabolic acidosis`;
    else res = `Normal anion gap (${r1(agForDx)})`;
    steps.push({
      id: "ag",
      title: "5 · Anion gap",
      result: res,
      detail: `AG = Na⁺ − (Cl⁻ + HCO₃⁻) = ${r1(i.na)} − (${r1(i.cl)} + ${r1(hco3)}) = ${r1(ag)} (normal 8–12).${
        useAlb ? ` Albumin-corrected AG = ${r1(ag)} + 2.5 × (4 − ${r1(i.albumin as number)}) = ${r1(correctedAg as number)}. Low albumin hides a raised gap.` : " Add albumin to correct the gap: each 1 g/dL fall lowers the AG by about 2.5."
      }`,
      tone: hagma ? "crit" : metabolicAcid ? "warn" : "ok",
    });

    // 6. Delta ratio
    if (hagma) {
      if (hco3 < 24) {
        deltaRatio = (agForDx - NORMAL.ag) / (24 - hco3);
        let res2: string;
        if (deltaRatio < 0.4) res2 = "< 0.4: hyperchloraemic normal anion gap acidosis predominates";
        else if (deltaRatio < 0.8) res2 = "0.4–0.8: combined high and normal anion gap acidosis (or renal failure)";
        else if (deltaRatio <= 2) res2 = "0.8–2: pure high anion gap acidosis (DKA often ~1, lactic ~1.6)";
        else res2 = "> 2: high anion gap acidosis plus a metabolic alkalosis (or a pre-existing compensated respiratory acidosis)";
        steps.push({ id: "delta", title: "6 · Delta ratio: anything else hiding?", result: `Delta ratio ${r2(deltaRatio)}: ${res2}`, detail: `(AG − 12) ÷ (24 − HCO₃⁻) = (${r1(agForDx)} − 12) ÷ (24 − ${r1(hco3)}).`, tone: deltaRatio < 0.8 || deltaRatio > 2 ? "warn" : "info" });
        if (deltaRatio < 0.4) diagnoses.push("Coexisting normal anion gap metabolic acidosis");
        else if (deltaRatio < 0.8) diagnoses.push("Coexisting normal anion gap metabolic acidosis");
        else if (deltaRatio > 2) diagnoses.push("Coexisting metabolic alkalosis");
      } else {
        steps.push({ id: "delta", title: "6 · Delta ratio: anything else hiding?", result: "Raised anion gap with HCO₃⁻ ≥ 24: high anion gap acidosis masked by a metabolic alkalosis", detail: "The rise in AG should lower HCO₃⁻; a normal or high HCO₃⁻ means something is adding alkali (vomiting, NG drainage, diuretics) or a compensated respiratory acidosis.", tone: "warn" });
        diagnoses.push("Coexisting metabolic alkalosis");
      }
    }
  } else {
    steps.push({ id: "ag", title: "5 · Anion gap", result: "Enter Na⁺ and Cl⁻ to calculate", detail: "Always calculate the anion gap, even when the primary problem looks respiratory: a hidden metabolic acidosis is common in the ICU.", tone: "info" });
  }

  // Summary diagnoses
  const primaryLabel: Record<Primary, string> = {
    normal: "No primary disorder on pH, pCO₂ and HCO₃⁻",
    "metabolic-acidosis": "Metabolic acidosis",
    "metabolic-alkalosis": "Metabolic alkalosis",
    "respiratory-acidosis": "Respiratory acidosis",
    "respiratory-alkalosis": "Respiratory alkalosis",
    "mixed-acidosis": "Mixed metabolic and respiratory acidosis",
    "mixed-alkalosis": "Mixed metabolic and respiratory alkalosis",
    "mixed-normal-ph": "Mixed disorder with normal pH",
  };
  const head = primaryLabel[primary];
  const summary: string[] = [];
  if (primary === "metabolic-acidosis" || primary === "mixed-acidosis") {
    summary.push(ag === undefined ? head : hagma ? (primary === "mixed-acidosis" ? "High anion gap metabolic acidosis with respiratory acidosis" : "High anion gap metabolic acidosis") : primary === "mixed-acidosis" ? "Normal anion gap metabolic acidosis with respiratory acidosis" : "Normal anion gap metabolic acidosis");
  } else {
    summary.push(head);
    if (hagma) summary.push("High anion gap metabolic acidosis");
  }
  const compSteps = steps.find((s) => s.id === "comp");
  if (compSteps && (primary === "respiratory-acidosis" || primary === "respiratory-alkalosis") && !compDx.length) summary[0] = compSteps.result.replace(/ \(compensation as expected\)/, "");
  summary.push(...compDx.filter((d) => !(hagma && d.includes("metabolic acidosis"))));
  summary.push(...diagnoses);

  // Next steps
  const next: string[] = [];
  if (hagma) next.push("High AG: check lactate, ketones (capillary β-hydroxybutyrate), urea/creatinine, and an osmolar gap if toxic alcohol is possible (GOLDMARK).");
  if (ag !== undefined && !hagma && (primary === "metabolic-acidosis" || primary === "mixed-acidosis")) next.push("Normal AG: think GI bicarbonate loss (diarrhoea, fistula), large-volume 0.9% saline, renal tubular acidosis; a urine anion gap helps separate gut from kidney.");
  if (primary === "metabolic-alkalosis" || summary.some((d) => d.includes("metabolic alkalosis"))) next.push("Metabolic alkalosis: check volume status and urine chloride (< 20 mmol/L suggests vomiting/NG loss or diuretic after-effect); correct K⁺ and Cl⁻.");
  if (primary === "respiratory-acidosis" || summary.some((d) => d.includes("respiratory acidosis"))) next.push("Respiratory acidosis: assess airway, drive and fatigue; consider NIV or intubation if pH < 7.25 and worsening.");
  if (!consistent) next.unshift("Values are inconsistent: repeat the gas and confirm it is arterial before acting on it.");
  if (next.length) steps.push({ id: "next", title: "What next?", result: next.join(" "), tone: "info" });

  return { steps, primary, diagnoses: [...new Set(summary)], ag, correctedAg, deltaRatio, expectedPco2, consistent, calcPh, hagma };
}
