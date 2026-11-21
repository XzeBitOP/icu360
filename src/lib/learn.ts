/**
 * Crawlable learning guides (/learn/*) and the "what you can learn" + FAQ copy
 * shown under the ECG OS and Ventilator OS simulators.
 *
 * Every clinical number here mirrors a reviewed ICU 360 module (mechanical-ventilation,
 * acid-base-abg, bedside-interpretation-ecg-cxr-ct-labs). Change both together.
 */

export type GuideLink = { href: string; title: string; sub: string; icon: string };
export type GuideSection = { id: string; h: string; body: string };
export type Faq = { q: string; a: string };

export type Guide = {
  slug: string;
  path: string;
  /** <title>, written for the search query; the layout template appends " — ICU 360". */
  metaTitle: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  cta?: GuideLink;
  sections: GuideSection[];
  links: GuideLink[];
  faqs: Faq[];
  /** Topics the page teaches, for LearningResource.teaches. */
  teaches: string[];
};

const VENT_OS: GuideLink = { href: "/tools/ventilator-os", title: "Open Ventilator OS", sub: "Free ventilator simulator · live waveforms · 3D lung", icon: "gauge" };
const ECG_OS: GuideLink = { href: "/tools/ecg-os", title: "Open ECG OS", sub: "Free ECG simulator · 3D heart · live 12-lead", icon: "heart-pulse" };
const ABG_TOOL: GuideLink = { href: "/tools/abg", title: "Open the ABG interpreter", sub: "Stepwise ABG calculator · compensation, anion gap, delta ratio", icon: "droplets" };

export const VENTILATOR_FAQS: Faq[] = [
  {
    q: "Is there a free ventilator simulator online?",
    a: "Yes. Ventilator OS on ICU 360 is a free mechanical ventilation simulator that runs in the browser on a phone or a computer. There is no sign-up and nothing to download. It is a teaching model of lung mechanics, not a copy of any one ventilator brand.",
  },
  {
    q: "What can I practise in Ventilator OS?",
    a: "Switch between volume control and pressure control, change tidal volume, rate, PEEP, FiO₂, flow and inspiratory time, and change lung compliance, airway resistance and patient effort. The pressure, flow and volume waveforms, peak and plateau pressure, driving pressure, compliance, auto-PEEP and a five-lobe 3D lung all respond as you go. Cases include normal lungs, an ARDS-like lung, COPD or asthma-like obstruction, and a right pneumothorax or mainstem intubation.",
  },
  {
    q: "What are the usual starting ventilator settings for an adult?",
    a: "A common start is volume assist-control with a tidal volume of 6–8 mL/kg of predicted body weight (6 mL/kg in ARDS), a rate of 14–20/min, PEEP 5–8 cmH₂O and FiO₂ 1.0, then titrating FiO₂ to SpO₂ 92–96% (88–92% in hypercapnic COPD). Check plateau and driving pressure with an inspiratory hold, and an ABG after about 30 minutes. Always follow your unit's protocol.",
  },
  {
    q: "What is driving pressure on a ventilator?",
    a: "Driving pressure is plateau pressure minus PEEP. It reflects how much the lungs are stretched by each breath relative to their size. A common target is 15 cmH₂O or less, with plateau pressure at or below 30 cmH₂O.",
  },
  {
    q: "What is the difference between volume control and pressure control?",
    a: "In volume control you set the tidal volume and flow, and the airway pressure changes with compliance and resistance, so you watch peak and plateau pressure. In pressure control you set the inspiratory pressure and time, and the tidal volume changes with the lung mechanics, so you watch exhaled tidal volume and minute ventilation.",
  },
  {
    q: "What is auto-PEEP and how do I spot it?",
    a: "Auto-PEEP (intrinsic PEEP) is gas trapped because expiration has not finished before the next breath. On the flow-time curve, expiratory flow does not return to zero. An expiratory hold measures it: total PEEP minus set PEEP. Lower rate, shorter inspiration or treating bronchospasm gives more time to breathe out.",
  },
];

export const ECG_FAQS: Faq[] = [
  {
    q: "Can I learn ECG online for free?",
    a: "Yes. ICU 360 has a free ECG guide and ECG OS, an interactive ECG simulator that runs in the browser with no sign-up. You see the impulse travel through a 3D heart and watch the 12-lead ECG build from the same beat.",
  },
  {
    q: "What does ECG OS simulate?",
    a: "Normal sinus rhythm, sinus bradycardia and tachycardia, first-degree AV block, 2:1 AV block, and left and right bundle branch block. You can change the sinus rate and AV nodal delay, slow the beat down or step through it 5 ms at a time, and read the measured heart rate, PR, QRS, QT, QTc and QRS axis. Atrial fibrillation, ventricular tachycardia and more rhythms are coming next.",
  },
  {
    q: "What are the normal ECG intervals?",
    a: "PR interval 120–200 ms, QRS duration under 120 ms. QTc depends on heart rate; a QTc over 500 ms, or a rise of more than 60 ms from baseline, carries a high risk of torsades de pointes. At the standard 25 mm/s, one small square is 40 ms and one large square is 200 ms.",
  },
  {
    q: "How do I calculate heart rate from an ECG?",
    a: "For a regular rhythm at 25 mm/s, divide 300 by the number of large squares between two R waves. For an irregular rhythm, count the QRS complexes on a 10-second strip and multiply by 6.",
  },
  {
    q: "Is ECG OS good for ECG rhythm practice?",
    a: "It is built for understanding why each rhythm looks the way it does, which makes recognition stick. Use it alongside the ICU ECG topic and the daily ICU quiz. Rhythm-recognition practice will grow as more rhythms are added.",
  },
];

export const ABG_FAQS: Faq[] = [
  {
    q: "What are the steps of ABG interpretation?",
    a: "1) Is there acidaemia (pH below 7.35) or alkalaemia (above 7.45)? 2) Is the primary process metabolic or respiratory? 3) Is the compensation appropriate? 4) Calculate the anion gap, corrected for albumin. 5) If there is a high anion gap metabolic acidosis, use the delta ratio to find a hidden second disorder. Then fit it to the clinical story.",
  },
  {
    q: "What is Winter's formula?",
    a: "In metabolic acidosis the expected PaCO₂ is 1.5 × HCO₃⁻ + 8 (± 2) mmHg. A PaCO₂ outside that range means a second, respiratory disorder.",
  },
  {
    q: "How do you calculate the anion gap?",
    a: "Anion gap = Na⁺ − (Cl⁻ + HCO₃⁻). A typical normal range is about 8–12 mmol/L, depending on the analyser. Add about 2.5 for every 10 g/L that albumin is below 40 g/L.",
  },
  {
    q: "Is there a free ABG interpretation calculator?",
    a: "Yes. The ICU 360 ABG interpreter walks through the steps for you: primary disorder, expected compensation, anion gap and delta ratio. It is free and needs no sign-up. Always check the result against the patient.",
  },
];

export const ICU_FAQS: Faq[] = [
  {
    q: "What is ICU 360?",
    a: "ICU 360 (icu360.in) is a free ICU learning app and bedside reference for interns, junior doctors, residents and ICU nurses, written by Dr. Kenil Shah, a critical care consultant. It is a teaching website and is not related to any medical device or other product with a similar name.",
  },
  {
    q: "Is ICU 360 free?",
    a: "Yes. There are no ads, no paywall and no sign-up. It can be added to the home screen like an app and keeps working offline after the first visit.",
  },
  {
    q: "What is in ICU 360?",
    a: "Bedside cards and step-by-step algorithms across ICU modules, ICU calculators with Indian lab units, an ABG interpreter, a code timer, an antimicrobials guide, a daily quiz, critical care news with sources, and two interactive simulators: ECG OS and Ventilator OS.",
  },
  {
    q: "Is ICU 360 suitable for interns starting ICU duty?",
    a: "Yes, that is who it is written for: the first night shifts in an ICU. It does not replace your seniors, your hospital's protocols or clinical judgement.",
  },
];

export const GUIDES: Guide[] = [
  {
    slug: "ventilator",
    path: "/learn/ventilator",
    metaTitle: "Learn mechanical ventilation: basics and a free ventilator simulator",
    description: "Learn mechanical ventilation basics for beginners: modes, initial ventilator settings, plateau and driving pressure, and reading waveforms. Then practise in Ventilator OS, a free interactive ventilator simulator.",
    eyebrow: "Free guide · Ventilator basics",
    h1: "Learn mechanical ventilation",
    intro: "A plain-language guide to mechanical ventilation for interns, residents and ICU nurses: how a ventilator breath works, the main modes, safe starting settings, the pressures to check and how to read the waveforms. Then try every idea in **Ventilator OS**, a free interactive ventilator simulator that runs in your browser.",
    cta: VENT_OS,
    sections: [
      {
        id: "how-a-breath-works",
        h: "How a ventilator breath works",
        body: "Every breath has to push gas through the tube and airways (resistance) and stretch the lungs and chest wall (compliance). The equation of motion sums it up:\n\n**Airway pressure = PEEP + flow × resistance + volume ÷ compliance**\n\nStiff lungs (low compliance, as in ARDS) need more pressure for the same volume. Narrow airways (high resistance, as in bronchospasm or a kinked tube) raise the pressure only while gas is flowing. Expiration is passive and takes about 3–5 time constants (resistance × compliance) to finish.",
      },
      {
        id: "ventilator-modes",
        h: "Ventilator modes, simply",
        body: "Each mode is defined by what the machine controls (volume or pressure), what starts a breath (time or the patient) and what ends it (volume, time or flow).\n\n- **Volume control (VC-AC):** you set tidal volume and flow; pressure varies with compliance and resistance. Watch peak and plateau pressure.\n- **Pressure control (PC-AC):** you set inspiratory pressure and time; tidal volume varies with lung mechanics. Watch exhaled tidal volume and minute ventilation.\n- **Pressure support (PSV/CPAP):** every breath is triggered by the patient and ends when flow falls; there is no backup rate, so set apnoea ventilation. Used for weaning.\n- **SIMV:** mandatory breaths synchronised with spontaneous ones. It slows weaning compared with pressure support or spontaneous breathing trials.",
      },
      {
        id: "initial-settings",
        h: "Initial ventilator settings (adult)",
        body: "Common starting points, to adjust for the patient and your unit's protocol:\n\n- **Tidal volume** 6–8 mL/kg of predicted body weight (PBW), 6 mL/kg in ARDS. Never use actual weight.\n- **PBW** = 50 (men) or 45.5 (women) + 0.91 × (height in cm − 152.4).\n- **Rate** 14–20/min; higher in severe metabolic acidosis, lower (8–12) in asthma or COPD.\n- **PEEP** 5–8 cmH₂O. **FiO₂** 1.0 at first, then titrate to SpO₂ 92–96% (88–92% in hypercapnic COPD).\n- **I:E** about 1:2, with a longer expiration in obstructive disease.\n- Check an **ABG** after about 30 minutes and adjust rate for PaCO₂ and pH.",
      },
      {
        id: "pressures",
        h: "Peak, plateau and driving pressure",
        body: "An inspiratory hold stops flow, so the pressure that remains is the **plateau pressure**, the pressure in the alveoli. Keep it at or below 30 cmH₂O. **Driving pressure** is plateau minus PEEP; keep it at or below 15 cmH₂O.\n\n- **High peak, normal plateau:** an airway resistance problem (kinked tube, secretions, bronchospasm).\n- **High peak and high plateau:** a compliance problem (ARDS, pneumothorax, abdominal distension, mainstem intubation).",
      },
      {
        id: "waveforms",
        h: "Reading ventilator waveforms",
        body: "- **Flow-time curve:** expiratory flow should return to zero before the next breath. If it does not, gas is trapped (auto-PEEP). An expiratory hold measures it: total PEEP minus set PEEP.\n- **Scooped pressure curve in volume control:** the patient wants more flow than you set (flow starvation). Increase flow or change to a pressure mode.\n- **Dips without a delivered breath:** ineffective triggering, often from auto-PEEP or over-assistance.\n- **Two breaths stacked:** double triggering, when the patient's demand outlasts the set inspiratory time or volume.",
      },
      {
        id: "practise",
        h: "Practise it in Ventilator OS",
        body: "Ventilator OS is a free mechanical ventilation simulator. Change one setting at a time and watch what happens:\n\n- Switch **volume control** and **pressure control**, square or decelerating flow.\n- Change tidal volume, rate, PEEP, FiO₂, flow and inspiratory time.\n- Change **lung compliance**, **airway resistance** and **patient effort**, and see triggering.\n- Read Ppeak, Pplat, driving pressure, static and dynamic compliance, auto-PEEP, minute ventilation and simulated gases.\n- Watch a **3D five-lobe lung** inflate, and try normal lungs, an ARDS-like lung, COPD or asthma-like obstruction, and a right pneumothorax or mainstem intubation.",
      },
    ],
    links: [
      { href: "/m/mechanical-ventilation/initial-settings", title: "Initial ventilator settings", sub: "Bedside card with a PBW table", icon: "wind" },
      { href: "/m/mechanical-ventilation/modes", title: "Ventilator modes made simple", sub: "VC, PC, PRVC, PSV, SIMV, APRV", icon: "sliders-horizontal" },
      { href: "/m/mechanical-ventilation/graphics-asynchrony", title: "Waveforms, auto-PEEP and asynchrony", sub: "Spot it and fix it", icon: "activity" },
      { href: "/m/ards-refractory-hypoxaemia/lung-protective-peep", title: "Lung-protective ventilation in ARDS", sub: "Tidal volume, PEEP, plateau", icon: "wind" },
      { href: "/m/mechanical-ventilation/weaning-sbt", title: "Weaning and the SBT", sub: "When and how to extubate", icon: "trending-down" },
      { href: "/tools/tidal-volume-pbw", title: "Tidal volume calculator", sub: "6–8 mL/kg of predicted body weight", icon: "calculator" },
      { href: "/tools/driving-pressure", title: "Driving pressure calculator", sub: "Plateau − PEEP", icon: "calculator" },
      { href: "/tools/pf-ratio", title: "P/F ratio calculator", sub: "PaO₂/FiO₂ for ARDS severity", icon: "calculator" },
    ],
    faqs: VENTILATOR_FAQS,
    teaches: ["Mechanical ventilation", "Ventilator modes", "Initial ventilator settings", "Plateau and driving pressure", "Ventilator waveforms", "Auto-PEEP"],
  },
  {
    slug: "ecg",
    path: "/learn/ecg",
    metaTitle: "Learn ECG online free: interactive ECG basics and simulator",
    description: "Learn ECG interpretation online, free: what each wave means, a systematic ECG read, normal intervals and conduction blocks. Then see them happen in ECG OS, an interactive ECG simulator with a 3D heart and a live 12-lead.",
    eyebrow: "Free guide · ECG basics",
    h1: "Learn ECG interpretation",
    intro: "A free, step-by-step way to learn the ECG: what each wave means, a systematic read, normal intervals and the conduction blocks you will meet on the ward. Then watch the same ideas happen in **ECG OS**, an interactive ECG simulator with a 3D heart and a live 12-lead.",
    cta: ECG_OS,
    sections: [
      {
        id: "waves",
        h: "What each wave means",
        body: "- **P wave:** atrial depolarisation, started by the sinus (SA) node.\n- **PR interval:** from the start of atrial depolarisation to the start of ventricular depolarisation; most of it is the delay in the AV node.\n- **QRS complex:** ventricular depolarisation through the His bundle, bundle branches and Purkinje fibres.\n- **T wave:** ventricular repolarisation.\n- **QT interval:** ventricular depolarisation plus repolarisation; it shortens as the heart rate rises, so it is corrected (QTc).",
      },
      {
        id: "systematic-read",
        h: "A systematic ECG read",
        body: "Read every ECG in the same order so nothing is missed:\n\n1. **Rate:** for a regular rhythm, 300 ÷ large squares between R waves; for an irregular one, QRS count on a 10-second strip × 6.\n2. **Rhythm:** regular or irregular? Is there a P wave before every QRS and a QRS after every P?\n3. **Axis:** look at leads I and aVF.\n4. **Intervals:** PR, QRS and QTc.\n5. **Morphology:** P waves, Q waves, ST segments and T waves.\n6. **Compare** with an old ECG and the patient in front of you.",
      },
      {
        id: "normal-values",
        h: "Normal values and ECG paper",
        body: "- Paper speed **25 mm/s**: one small square = 40 ms, one large square = 200 ms. Standard gain 10 mm/mV.\n- **PR interval** 120–200 ms.\n- **QRS** under 120 ms.\n- **QTc** (Bazett, or Fridericia when the heart rate is over 100): over 500 ms, or a rise of more than 60 ms from baseline, means a high risk of torsades de pointes.",
      },
      {
        id: "blocks",
        h: "Rhythms and conduction blocks to know first",
        body: "- **Sinus bradycardia / tachycardia:** a normal P before every QRS, at under 60 or over 100 per minute.\n- **First-degree AV block:** PR over 200 ms, every P conducted.\n- **2:1 AV block:** every second P wave is not followed by a QRS.\n- **Left bundle branch block:** QRS 120 ms or more, broad notched R in I, aVL and V5–V6, deep S in V1.\n- **Right bundle branch block:** QRS 120 ms or more, rsR′ in V1–V2, broad terminal S in I and V5–V6.",
      },
      {
        id: "practise",
        h: "Practise it in ECG OS",
        body: "ECG OS is a free interactive ECG simulator. Instead of memorising pictures, you see why each ECG looks the way it does:\n\n- Watch the impulse travel from the **SA node** through the atria, **AV node**, His bundle and bundle branches in a **3D cutaway heart**.\n- See the **12-lead ECG** computed from that same beat.\n- Change the sinus rate and AV nodal delay, block a bundle branch, or create 2:1 AV block.\n- Slow the beat down or step through it 5 ms at a time.\n- Read the measured heart rate, PR, QRS, QT, **QTc** and **QRS axis**, with lead-by-lead findings.",
      },
    ],
    links: [
      { href: "/m/bedside-interpretation-ecg-cxr-ct-labs/icu-ecg", title: "ECG interpretation in the ICU", sub: "STEMI criteria, mimics, QTc, electrolytes", icon: "heart-pulse" },
      { href: "/m/cardiac-emergencies-arrhythmias/af-rapid-ventricular-response", title: "AF with rapid ventricular response", sub: "Rate or rhythm control in the ICU", icon: "heart-pulse" },
      { href: "/m/cardiac-emergencies-arrhythmias/vt-wide-complex", title: "VT and broad-complex tachycardia", sub: "Stable vs unstable", icon: "zap" },
      { href: "/m/cardiac-emergencies-arrhythmias/bradycardia-pacing", title: "Bradycardia and pacing", sub: "Atropine, adrenaline, pacing", icon: "activity" },
      { href: "/m/fluids-electrolytes/hyperkalaemia", title: "Hyperkalaemia", sub: "ECG changes and emergency treatment", icon: "zap" },
      { href: "/tools/qtc-bazett", title: "QTc calculator (Bazett)", sub: "Corrected QT from QT and heart rate", icon: "calculator" },
    ],
    faqs: ECG_FAQS,
    teaches: ["ECG interpretation", "ECG waves and intervals", "Cardiac conduction system", "AV block", "Bundle branch block", "QTc"],
  },
  {
    slug: "abg",
    path: "/learn/abg",
    metaTitle: "ABG interpretation made easy: 5 steps and a free ABG calculator",
    description: "ABG interpretation step by step: acidaemia or alkalaemia, primary disorder, compensation (Winter's formula), anion gap and delta ratio, with a free ABG interpretation calculator.",
    eyebrow: "Free guide · Acid–base",
    h1: "ABG interpretation, step by step",
    intro: "Five steps that work on every arterial blood gas, with the formulas you need and a free **ABG interpretation calculator** that walks through them for you.",
    cta: ABG_TOOL,
    sections: [
      {
        id: "normal-values",
        h: "Normal values",
        body: "- **pH** 7.35–7.45\n- **PaCO₂** 35–45 mmHg\n- **HCO₃⁻** 22–26 mmol/L\n- **Anion gap** about 8–12 mmol/L (analyser-dependent)",
      },
      {
        id: "five-steps",
        h: "The five steps",
        body: "1. **pH:** under 7.35 is acidaemia, over 7.45 is alkalaemia. A normal pH does not rule out a mixed disorder.\n2. **Primary process:** low pH with low HCO₃⁻ is metabolic acidosis; low pH with high PaCO₂ is respiratory acidosis; high pH with high HCO₃⁻ is metabolic alkalosis; high pH with low PaCO₂ is respiratory alkalosis.\n3. **Compensation:** in metabolic acidosis, expected PaCO₂ = 1.5 × HCO₃⁻ + 8 (± 2) (Winter's formula). In metabolic alkalosis, PaCO₂ rises about 0.7 for each 1 mmol/L rise in HCO₃⁻. Outside the expected range means a second disorder.\n4. **Anion gap:** Na⁺ − (Cl⁻ + HCO₃⁻). Add about 2.5 for every 10 g/L that albumin is below 40 g/L.\n5. **Delta ratio** (in a high anion gap acidosis): (AG − 12) ÷ (24 − HCO₃⁻). Under 0.4 suggests a normal anion gap acidosis; 0.4–0.8 a mixed one; 0.8–2 a pure high anion gap acidosis; over 2 an added metabolic alkalosis.",
      },
      {
        id: "oxygenation",
        h: "Then look at oxygenation",
        body: "The **A–a gradient** = PAO₂ − PaO₂, where PAO₂ = FiO₂ × (760 − 47) − PaCO₂ ÷ 0.8. On room air it is normally about age ÷ 4 + 4. The **P/F ratio** (PaO₂ ÷ FiO₂) grades hypoxaemia and ARDS severity.",
      },
    ],
    links: [
      { href: "/m/acid-base-abg/stepwise-interpretation", title: "Five-step blood gas interpretation", sub: "Bedside card with references", icon: "flask-conical" },
      { href: "/m/acid-base-abg/hagma", title: "High anion gap metabolic acidosis", sub: "Causes and workup", icon: "flask-conical" },
      { href: "/m/acid-base-abg/nagma", title: "Normal anion gap acidosis", sub: "Causes and workup", icon: "flask-conical" },
      { href: "/tools/anion-gap", title: "Anion gap calculator", sub: "With albumin correction", icon: "calculator" },
      { href: "/tools/winters-formula", title: "Winter's formula calculator", sub: "Expected PaCO₂", icon: "calculator" },
      { href: "/tools/delta-ratio", title: "Delta ratio calculator", sub: "Hidden second disorder", icon: "calculator" },
      { href: "/tools/aa-gradient", title: "A–a gradient calculator", sub: "Alveolar–arterial O₂ gradient", icon: "calculator" },
      { href: "/tools/pf-ratio", title: "P/F ratio calculator", sub: "PaO₂/FiO₂", icon: "calculator" },
    ],
    faqs: ABG_FAQS,
    teaches: ["ABG interpretation", "Acid–base disorders", "Anion gap", "Winter's formula", "Delta ratio"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Interactive practice linked from module and topic pages. */
const PRACTICE: Record<string, GuideLink[]> = {
  "mechanical-ventilation": [VENT_OS, { href: "/learn/ventilator", title: "Learn mechanical ventilation", sub: "Free beginner's guide", icon: "book-open" }],
  "ards-refractory-hypoxaemia": [VENT_OS],
  "oxygen-hfnc-niv": [VENT_OS],
  "airway-management": [VENT_OS],
  "cardiac-emergencies-arrhythmias": [ECG_OS, { href: "/learn/ecg", title: "Learn ECG interpretation", sub: "Free beginner's guide", icon: "book-open" }],
  "bedside-interpretation-ecg-cxr-ct-labs": [ECG_OS, { href: "/learn/ecg", title: "Learn ECG interpretation", sub: "Free beginner's guide", icon: "book-open" }],
  "cardiac-arrest-post-rosc": [ECG_OS],
  "acid-base-abg": [ABG_TOOL, { href: "/learn/abg", title: "ABG interpretation, step by step", sub: "Free guide", icon: "book-open" }],
};

export function practiceLinks(moduleId: string): GuideLink[] {
  return PRACTICE[moduleId] ?? [];
}
