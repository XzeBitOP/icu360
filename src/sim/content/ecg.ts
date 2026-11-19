import type { ECGCondition, ECGLeadName, LeadFinding } from "@/sim/types";
import { ECG_LEADS } from "@/sim/types";
import type { EcgConfig } from "@/sim/cardiac-ep";

type LF = Partial<Omit<LeadFinding, "lead">> & { explanation?: string };

const REFS_COMMON = [
  { title: "AHA/ACCF/HRS recommendations for the standardization and interpretation of the electrocardiogram", url: "https://www.jacc.org/doi/10.1016/j.jacc.2007.01.024", year: 2009 },
  { title: "NCBI Bookshelf: Electrocardiography (Clinical Methods)", url: "https://www.ncbi.nlm.nih.gov/books/NBK354/" },
];

function leads(base: LF, over: Partial<Record<ECGLeadName, LF>>): LeadFinding[] {
  return ECG_LEADS.map((lead) => {
    const o = over[lead] ?? {};
    return {
      lead,
      status: "usually_normal",
      explanation: "Usually normal / not specifically affected in this condition.",
      confidence: "moderate",
      ...base,
      ...o,
    } as LeadFinding;
  });
}

/** Normal sinus morphology by lead (model output and conventional teaching agree on these polarities). */
const NSR_LEADS: Record<ECGLeadName, LF> = {
  I: { pWave: "Upright", qrs: "qR / R, small or absent q", stSegment: "Isoelectric", tWave: "Upright", explanation: "Net depolarisation is leftward, toward lead I's positive pole." },
  II: { pWave: "Upright (largest P)", qrs: "R, usually small q", stSegment: "Isoelectric", tWave: "Upright", explanation: "Atrial and ventricular vectors point down and to the left, close to lead II's axis (+60°)." },
  III: { status: "variable", pWave: "Upright, small or biphasic", qrs: "Variable (R or rS)", stSegment: "Isoelectric", tWave: "Variable", explanation: "Depends on the frontal QRS axis; normal variation." },
  aVR: { pWave: "Inverted", qrs: "Predominantly negative (QS or rS)", stSegment: "Isoelectric", tWave: "Inverted", explanation: "aVR looks at the heart from the right shoulder: depolarisation moves away from it.", confidence: "high" },
  aVL: { status: "variable", pWave: "Upright or flat", qrs: "Variable (R or rS)", stSegment: "Isoelectric", tWave: "Upright, flat or inverted", explanation: "Depends on the frontal axis (more upright with a leftward axis)." },
  aVF: { pWave: "Upright", qrs: "R or qR", stSegment: "Isoelectric", tWave: "Upright", explanation: "Inferior lead; positive when the main vector points toward the feet." },
  V1: { pWave: "Biphasic or inverted (terminal negative)", qrs: "rS (small r, deep S)", stSegment: "Isoelectric to slightly elevated", tWave: "Upright, flat or inverted", explanation: "Septal activation toward V1 gives a small r; the dominant left ventricle then moves away (S). The late left-atrial component makes the P wave end negative." },
  V2: { qrs: "rS", pWave: "Upright or biphasic", stSegment: "Isoelectric to slightly elevated", tWave: "Upright", explanation: "As V1 with less negative terminal forces." },
  V3: { qrs: "RS: transition zone", pWave: "Upright", stSegment: "Isoelectric", tWave: "Upright", explanation: "Transition zone: R and S amplitudes similar, typically V3 to V4." },
  V4: { qrs: "Rs", pWave: "Upright", stSegment: "Isoelectric", tWave: "Upright", explanation: "Left ventricular forces now dominate." },
  V5: { qrs: "qR", pWave: "Upright", stSegment: "Isoelectric", tWave: "Upright", explanation: "Small septal q (initial rightward force), then tall R from the left ventricle." },
  V6: { qrs: "qR", pWave: "Upright", stSegment: "Isoelectric", tWave: "Upright", explanation: "Lateral lead: septal q and tall R." },
};

const FOUNDATION_COMMON = {
  difficulty: "foundation" as const,
  mechanismType: "mechanistic" as const,
  references: REFS_COMMON,
  validation: { status: "unreviewed" as const, notes: "Model output checked against conventional textbook ranges by automated tests. Awaiting review by a named cardiologist/clinician." },
};

export const ECG_CONDITIONS: ECGCondition[] = [
  {
    id: "nsr", name: "Normal sinus rhythm", moduleId: "module-1-normal-sinus", ...FOUNDATION_COMMON,
    affectedStructures: ["saNode", "rightAtrium", "leftAtrium", "avNode", "hisBundle", "rightBundle", "leftBundle", "purkinje", "septum", "leftVentricle", "rightVentricle"],
    normalPhysiology: "The SA node fires at 60–100/min. The impulse spreads through the right then left atrium, is delayed in the AV node, then travels via the His bundle, bundle branches and Purkinje fibres to depolarise the ventricles almost simultaneously.",
    abnormalPhysiology: "None: this is the reference rhythm.",
    activationSequence: ["SA node fires", "Right atrium activates", "Left atrium activates via Bachmann bundle", "AV node delay", "His bundle", "Right and left bundle branches", "Septum activates left to right", "Purkinje fibres distribute activation", "Ventricular myocardium activates endocardium to epicardium", "Regional repolarisation (epicardium before endocardium)"],
    expectedWaveChanges: { p: "One P wave before every QRS; upright in I, II, aVF; inverted in aVR", pr: "About 120–200 ms", qrs: "Narrow (< ~110 ms in this model)", st: "Isoelectric", t: "Upright in leads where the QRS is mainly upright", qt: "QTc within the normal range" },
    leadFindings: leads({}, NSR_LEADS),
    diagnosticCriteria: ["Regular rhythm, rate 60–100/min", "Each QRS preceded by a P wave", "P wave upright in I and II and negative in aVR", "PR interval 120–200 ms", "Narrow QRS"],
    differential: ["Ectopic atrial rhythm (abnormal P axis)", "Junctional rhythm (retrograde or absent P)"],
    clinicalSignificance: "Reference pattern against which every abnormal ECG is compared.",
    managementPrinciples: ["No rhythm-specific treatment is needed."],
    commonPitfalls: ["Limb-lead reversal can mimic abnormal P-wave axis (negative P in lead I)."],
  },
  {
    id: "sinus-bradycardia", name: "Sinus bradycardia", moduleId: "module-1-normal-sinus", ...FOUNDATION_COMMON,
    affectedStructures: ["saNode"],
    normalPhysiology: "The SA node fires at 60–100/min.",
    abnormalPhysiology: "The SA node fires slower than 60/min; conduction through the atria, AV node and ventricles is normal, so each beat looks normal but the RR interval is longer. Repolarisation lengthens at slower rates, so QT lengthens while QTc stays similar.",
    activationSequence: ["SA node fires (slower)", "Right then left atrium", "AV node delay", "His–Purkinje", "Ventricles", "Repolarisation"],
    expectedWaveChanges: { p: "Normal morphology, normal axis", pr: "Normal (120–200 ms)", qrs: "Normal", st: "Isoelectric", t: "Normal", qt: "QT longer than at 72/min; QTc roughly unchanged" },
    leadFindings: leads({}, NSR_LEADS),
    diagnosticCriteria: ["Sinus P waves before every QRS", "Rate < 60/min"],
    differential: ["Sinus pause/arrest", "2:1 AV block (blocked P waves hidden in T waves)", "Junctional escape rhythm"],
    clinicalSignificance: "Common in athletes and sleep; pathological with symptoms, drugs (β-blockers etc.), raised intracranial pressure, hypothyroidism or sick sinus syndrome.",
    managementPrinciples: ["Treat the cause and symptoms/haemodynamic effect rather than the number."],
    commonPitfalls: ["Blocked atrial beats in 2:1 AV block can look like sinus bradycardia."],
  },
  {
    id: "sinus-tachycardia", name: "Sinus tachycardia", moduleId: "module-1-normal-sinus", ...FOUNDATION_COMMON,
    affectedStructures: ["saNode"],
    normalPhysiology: "The SA node fires at 60–100/min.",
    abnormalPhysiology: "The SA node fires faster than 100/min with normal conduction. At fast rates diastole shortens and repolarisation shortens (QT shortens) so the P wave may sit on the preceding T wave.",
    activationSequence: ["SA node fires (faster)", "Right then left atrium", "AV node delay", "His–Purkinje", "Ventricles", "Repolarisation"],
    expectedWaveChanges: { p: "Normal morphology; may merge with the preceding T wave", pr: "Normal (may shorten slightly in real hearts; fixed in this model)", qrs: "Normal", st: "Isoelectric", t: "Normal, shorter QT", qt: "QT shortens; QTc roughly unchanged (Bazett over-corrects at high rates)" },
    leadFindings: leads({}, NSR_LEADS),
    diagnosticCriteria: ["Sinus P waves before every QRS", "Rate > 100/min", "Gradual onset and offset in real patients"],
    differential: ["Atrial tachycardia", "AVNRT/AVRT (usually faster, abrupt)", "Atrial flutter with 2:1 block (about 150/min)"],
    clinicalSignificance: "A physiological response to fever, pain, hypovolaemia, hypoxia, anaemia, sepsis or drugs: look for the cause.",
    managementPrinciples: ["Treat the underlying cause rather than the rate."],
    commonPitfalls: ["Fixed rates near 150/min should prompt consideration of flutter 2:1.", "Bazett correction over-corrects at fast rates; compare with Fridericia."],
  },
  {
    id: "first-degree-av-block", name: "First-degree AV block", moduleId: "module-2-av-blocks", ...FOUNDATION_COMMON,
    affectedStructures: ["avNode", "hisBundle"],
    normalPhysiology: "AV nodal conduction takes about 80–100 ms in this model, giving a PR interval of about 160 ms.",
    abnormalPhysiology: "AV conduction is slowed but every atrial impulse is conducted. The PR interval is prolonged (> 200 ms) and constant; no beats are dropped. The ventricular activation and QRS are unchanged because conduction below the AV node is normal.",
    activationSequence: ["SA node fires", "Right then left atrium", "Prolonged AV node delay", "His bundle", "Bundle branches", "Normal ventricular activation", "Repolarisation"],
    expectedWaveChanges: { p: "Normal", pr: "Prolonged (> 200 ms) and constant", qrs: "Normal", st: "Isoelectric", t: "Normal", qt: "Normal" },
    leadFindings: leads({ status: "usually_normal" }, { II: { ...NSR_LEADS.II, status: "characteristic", explanation: "Long PR interval is easiest to measure in lead II, where the P wave is largest." }, ...(Object.fromEntries(ECG_LEADS.filter((l) => l !== "II").map((l) => [l, { ...NSR_LEADS[l], status: "not_localising" as const, explanation: "Prolonged PR interval is present in every lead; morphology is otherwise as in normal sinus rhythm." }])) as Partial<Record<ECGLeadName, LF>>) }),
    diagnosticCriteria: ["PR interval > 200 ms", "Constant PR interval", "Every P wave followed by a QRS"],
    differential: ["Sinus tachycardia with P on T (apparent long PR)", "Mobitz I (progressive lengthening)"],
    clinicalSignificance: "Often benign (high vagal tone, drugs such as β-blockers, calcium-channel blockers, digoxin); may progress in some conduction diseases or after MI/surgery.",
    managementPrinciples: ["Review contributing drugs and electrolytes; monitor for progression to higher-grade block."],
    commonPitfalls: ["Very long PR with a fast rate can bury the P wave in the preceding T wave."],
  },
  {
    id: "lbbb", name: "Complete left bundle branch block", moduleId: "module-3-intraventricular-conduction", ...FOUNDATION_COMMON,
    difficulty: "intermediate",
    affectedStructures: ["leftBundle", "septum", "leftVentricle", "rightBundle"],
    normalPhysiology: "The left bundle activates the septum (left to right) and left ventricle together with the right ventricle, giving a QRS under about 110 ms.",
    abnormalPhysiology: "Conduction through the left bundle is blocked. The right ventricle and septum are activated via the right bundle; activation then crosses the septum from right to left and spreads slowly through left-ventricular myocardium. LV activation is delayed, the QRS is broad (here > 120 ms), the normal initial left-to-right septal force is lost, and repolarisation follows the abnormal activation order, giving ST–T changes opposite to the main QRS direction (secondary, discordant).",
    activationSequence: ["SA node fires", "Atria", "AV node", "His bundle", "Right bundle conducts normally", "Left bundle blocked", "RV and septum (right side) activate first", "Septum activated right to left", "LV activated late and slowly through myocardium", "Broad QRS", "Secondary repolarisation changes (discordant ST–T)"],
    expectedWaveChanges: { p: "Normal", pr: "Normal", qrs: "Broad (> 120 ms), V1 predominantly negative, I/aVL/V5/V6 broad monophasic or notched R with no septal q", st: "Discordant (opposite to the main QRS direction)", t: "Discordant (inverted in I, aVL, V5, V6; upright in V1)", qt: "Prolonged by the wide QRS (use caution with QTc)" },
    leadFindings: leads({ status: "usually_normal" }, {
      I: { status: "characteristic", qrs: "Broad, monophasic/notched R; no q", stSegment: "Depressed (discordant)", tWave: "Inverted (discordant)", explanation: "Delayed leftward LV activation with no initial septal q.", confidence: "high" },
      II: { status: "common", qrs: "Broad, variable", tWave: "Variable", explanation: "Depends on the frontal axis; usually upright broad complexes." },
      III: { status: "variable", qrs: "Variable", explanation: "Depends on the frontal axis." },
      aVR: { status: "reciprocal", qrs: "Broad, predominantly negative", tWave: "Upright or biphasic", explanation: "Mirror of the leftward activation." },
      aVL: { status: "characteristic", qrs: "Broad R, often notched", tWave: "Inverted (discordant)", explanation: "Same reason as lead I.", confidence: "high" },
      aVF: { status: "variable", qrs: "Variable", explanation: "Depends on the frontal axis." },
      V1: { status: "characteristic", qrs: "Predominantly negative (rS or QS), broad", stSegment: "Elevated (discordant)", tWave: "Upright (discordant)", explanation: "Late leftward/posterior LV activation moves away from V1.", confidence: "high" },
      V2: { status: "characteristic", qrs: "Deep, broad S", stSegment: "Elevated (discordant)", tWave: "Upright", explanation: "Same as V1." },
      V3: { status: "common", qrs: "Broad transition", explanation: "Transition zone is broad/late." },
      V4: { status: "common", qrs: "Broad R", explanation: "Late LV activation." },
      V5: { status: "characteristic", qrs: "Broad, notched R; no q", stSegment: "Depressed (discordant)", tWave: "Inverted (discordant)", explanation: "Delayed LV lateral wall activation.", confidence: "high" },
      V6: { status: "characteristic", qrs: "Broad, notched R; no q", stSegment: "Depressed (discordant)", tWave: "Inverted (discordant)", explanation: "Delayed LV lateral wall activation.", confidence: "high" },
    }),
    diagnosticCriteria: ["QRS ≥ 120 ms (conventional)", "Broad notched/slurred R in I, aVL, V5–V6", "No septal q in I, V5, V6", "Predominantly negative QRS in V1", "Discordant ST–T changes"],
    differential: ["Ventricular pacing (LBBB-like pattern)", "Hyperkalaemia and drug-related QRS widening", "Pre-excitation"],
    clinicalSignificance: "Usually indicates underlying structural heart disease. New LBBB with symptoms prompts evaluation; ST changes in LBBB cannot be interpreted like normal ST–T (see Sgarbossa criteria).",
    managementPrinciples: ["Evaluate for structural heart disease.", "Consider cardiac resynchronisation therapy evaluation in selected heart failure patients."],
    commonPitfalls: ["Do not read ST elevation in V1–V3 as MI without applying LBBB-specific criteria.", "Model simplification: Purkinje activation and septal geometry are schematic."],
  },
  {
    id: "rbbb", name: "Complete right bundle branch block", moduleId: "module-3-intraventricular-conduction", ...FOUNDATION_COMMON,
    difficulty: "intermediate",
    affectedStructures: ["rightBundle", "rightVentricle", "septum"],
    normalPhysiology: "The right bundle activates the right ventricle simultaneously with the left ventricle, so right-ventricular forces are hidden by the larger left ventricle.",
    abnormalPhysiology: "Conduction down the right bundle is blocked. The septum and left ventricle activate normally through the left bundle; the right ventricle is then activated late by slow cell-to-cell spread from the septum. These late, unopposed rightward and anterior forces prolong the QRS and appear as a terminal R′ in V1–V2 and broad terminal S waves in I and V5–V6.",
    activationSequence: ["SA node fires", "Atria", "AV node", "His bundle", "Left bundle conducts normally", "Right bundle blocked", "Septum and LV activate normally", "RV activated late through myocardium", "Late rightward/anterior terminal forces (broad QRS)"],
    expectedWaveChanges: { p: "Normal", pr: "Normal", qrs: "Broad (≥ 120 ms) with terminal R′ in V1–V2 and broad terminal S in I, V5–V6", st: "Secondary ST–T changes in V1–V3", t: "Often inverted in V1–V2", qt: "Prolonged by the wide QRS" },
    leadFindings: leads({ status: "usually_normal" }, {
      I: { status: "characteristic", qrs: "qRS with broad terminal S", explanation: "Terminal rightward forces from the late RV activation.", confidence: "high" },
      II: { status: "variable", qrs: "Variable; may show terminal S", explanation: "Depends on the frontal axis." },
      III: { status: "variable", explanation: "Depends on the frontal axis." },
      aVR: { status: "reciprocal", qrs: "Terminal R (r′)", explanation: "Mirror of the rightward terminal forces." },
      aVL: { status: "variable", explanation: "Depends on the frontal axis." },
      aVF: { status: "variable", explanation: "Depends on the frontal axis." },
      V1: { status: "characteristic", qrs: "rSR′ (terminal R′) and widened", tWave: "Inverted", explanation: "Late RV activation moves anteriorly and rightward, toward V1.", confidence: "high" },
      V2: { status: "characteristic", qrs: "rSR′ or R′", tWave: "Often inverted", explanation: "As V1.", confidence: "high" },
      V3: { status: "common", explanation: "May show smaller terminal R′." },
      V4: { status: "usually_normal", explanation: "Usually little change." },
      V5: { status: "characteristic", qrs: "qRS with broad terminal S", explanation: "Terminal rightward forces move away from V5.", confidence: "high" },
      V6: { status: "characteristic", qrs: "qRS with broad terminal S", explanation: "Terminal rightward forces move away from V6.", confidence: "high" },
    }),
    diagnosticCriteria: ["QRS ≥ 120 ms (conventional) for complete RBBB", "rsR′ or broad R in V1–V2", "Broad terminal S in I and V5–V6"],
    differential: ["Incomplete RBBB (QRS 110–120 ms)", "Brugada pattern", "Normal variant (rSr′ in V1)", "Posterior MI (tall R in V1) or RV hypertrophy"],
    clinicalSignificance: "May be a normal variant or reflect right heart strain (PE, pulmonary hypertension) or structural disease; the QRS and T-wave changes in V1–V3 are secondary.",
    managementPrinciples: ["No rhythm-specific treatment; evaluate the clinical context."],
    commonPitfalls: ["A new RBBB in an unwell patient can accompany acute right-heart strain: interpret in context."],
  },
];

/** Simulation presets that realise each condition mechanistically (no waveform templates). */
export const ECG_PRESETS: Record<string, Partial<EcgConfig>> = {
  nsr: {},
  "sinus-bradycardia": { sinusRateBpm: 45 },
  "sinus-tachycardia": { sinusRateBpm: 120 },
  "first-degree-av-block": { avNodalDelayMs: 160 },
  lbbb: { edgeOverrides: { "hisBundle->leftBundle": { enabled: false } } },
  rbbb: { edgeOverrides: { "hisBundle->rightBundle": { enabled: false } } },
  /** Fixed 2:1 AV block (engine pattern "fixed", ratio 2): every second P wave is not conducted. Rate is the atrial (sinus) rate. */
  "av-block-2-1": { sinusRateBpm: 90, avBlock: { type: "fixed", ratio: 2 } },
};
