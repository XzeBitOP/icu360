/**
 * Context-text providers: each turns one block of on-screen content into the plain text the AI tutor receives.
 * Pages call the builder for their own content only, so the model sees exactly what the learner sees (no images, no other pages).
 * Pure functions with type-only imports, safe on the server and in the browser.
 */
import type { Algorithm, Calculator, Module, Topic } from "@/lib/content-types";
import type { GuideSection } from "@/lib/learn";
import type { AbgInput, AbgResult } from "@/lib/abg";
import type { Antimicrobial } from "@/data/antimicrobial.types";
import { AI_LIMITS, type AiContext } from "./schema";

/** Strips inline markdown so the model gets clean text. Keeps link text, drops URLs. */
export function plain(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Keeps the text under the API limit (cuts at a line break where possible). */
export function clip(text: string, max: number = AI_LIMITS.context): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 20);
  const nl = cut.lastIndexOf("\n");
  return `${nl > max * 0.6 ? cut.slice(0, nl) : cut}\n[…truncated]`;
}

const lines = (xs: (string | false | null | undefined)[]) => clip(xs.filter(Boolean).join("\n"));

/** Title + every node (in order, with type) + every branch, assembled from the algorithm data. */
export function algorithmText(algo: Algorithm): string {
  const byId = new Map(algo.nodes.map((n) => [n.id, n]));
  const label = (id: string) => plain(byId.get(id)?.text ?? id);
  const out = new Map<string, { to: string; label?: string }[]>();
  for (const e of algo.edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const typeName: Record<string, string> = { start: "Start", action: "Action", decision: "Decision", end: "End" };
  return lines([
    `Algorithm: ${plain(algo.title)}`,
    algo.description ? `Description: ${plain(algo.description)}` : null,
    "Steps:",
    ...algo.nodes.flatMap((n, i) => {
      const next = out.get(n.id) ?? [];
      return [
        `${i + 1}. [${typeName[n.type] ?? n.type}${n.severity === "critical" ? ", critical" : ""}] ${plain(n.text)}${n.detail ? ` — ${plain(n.detail)}` : ""}`,
        ...next.map((e) => `   → ${e.label ? `${plain(e.label)}: ` : "then "}${label(e.to)}`),
      ];
    }),
  ]);
}

export function bedsideText(topic: Topic): string {
  const b = topic.bedside;
  return lines([
    `Topic: ${plain(topic.title)}`,
    `Summary: ${plain(topic.summary)}`,
    b.definition ? `Definition: ${plain(b.definition.text)}` : null,
    "At the bedside:",
    ...b.steps.map((s) => `${s.n}. ${s.time ? `(${s.time}) ` : ""}${plain(s.title)}: ${plain(s.detail)}`),
    ...(b.doseCards ?? []).map((d) => `Dose card: ${d.drugId} (${plain(d.role)}), ${plain(d.route)}: ${plain(d.dose)}${d.dilution ? `; dilution ${plain(d.dilution)}` : ""}${d.target ? `; target ${plain(d.target)}` : ""}${d.notes ? `; ${plain(d.notes)}` : ""}`),
    ...(b.tables ?? []).flatMap((t) => [`Table: ${plain(t.title)}`, `  ${t.columns.join(" | ")}`, ...t.rows.map((r) => `  ${r.map(plain).join(" | ")}`)]),
    ...b.redFlags.map((c) => `Red flag: ${plain(c.text)}`),
    ...(b.pitfalls ?? []).map((c) => `Pitfall: ${plain(c.text)}`),
    ...(b.pearls ?? []).map((c) => `Pearl: ${plain(c.text)}`),
  ]);
}

export function notesText(topic: Topic): string {
  const n = topic.consultantNotes;
  return lines([
    `Topic: ${plain(topic.title)} (consultant notes)`,
    n.pathophysiology ? `Pathophysiology:\n${plain(n.pathophysiology)}` : null,
    `Evidence:\n${plain(n.evidence)}`,
    n.controversies ? `Controversies:\n${plain(n.controversies)}` : null,
    n.indiaNotes ? `India notes:\n${plain(n.indiaNotes)}` : null,
  ]);
}

export function moduleText(m: Pick<Module, "title" | "summary" | "topics">): string {
  return lines([`Module: ${plain(m.title)}`, `Summary: ${plain(m.summary)}`, "Topics:", ...m.topics.map((t, i) => `${i + 1}. ${plain(t.title)}: ${plain(t.summary)}`)]);
}

export function guideSectionText(guideTitle: string, s: GuideSection): string {
  return lines([`Guide: ${plain(guideTitle)}`, `Section: ${plain(s.h)}`, plain(s.body)]);
}

export function newsText(n: { title: string; summary: string; source: string; date: string; tag: string; url?: string }): string {
  return lines([`News item (${n.tag}, ${n.date})`, `Title: ${plain(n.title)}`, `Summary: ${plain(n.summary)}`, `Source: ${plain(n.source)}`]);
}

export function quizText(q: { stem: string; options: string[]; answerIndex: number; explanation: string; sourceLabel?: string }, picked: number | null): string {
  const L = (k: number) => String.fromCharCode(65 + k);
  return lines([
    `Question: ${plain(q.stem)}`,
    "Options:",
    ...q.options.map((o, k) => `${L(k)}) ${plain(o)}`),
    picked !== null ? `Learner's answer: ${L(picked)}) ${plain(q.options[picked])}` : null,
    `Correct answer: ${L(q.answerIndex)}) ${plain(q.options[q.answerIndex])}`,
    `Explanation: ${plain(q.explanation)}`,
    q.sourceLabel ? `Reference: ${plain(q.sourceLabel)}` : null,
  ]);
}

export function calculatorText(calc: Pick<Calculator, "name" | "description" | "inputs" | "output" | "interpretation" | "formula" | "notes">, vals: Record<string, number>, result: number, bandLabel?: string): string {
  return lines([
    `Calculator: ${plain(calc.name)}`,
    `What it does: ${plain(calc.description)}`,
    "Current inputs:",
    ...calc.inputs.map((i) => {
      const v = vals[i.id];
      if (i.type === "boolean") return `- ${plain(i.label)}: ${v ? `yes (+${i.points ?? 1})` : "no"}`;
      if (i.type === "select") return `- ${plain(i.label)}: ${i.options?.find((o) => o.value === v)?.label ?? v} (${v})`;
      return `- ${plain(i.label)}: ${v}${i.unit ? ` ${i.unit}` : ""}`;
    }),
    `Result: ${calc.output.label} = ${Number.isFinite(result) ? result.toFixed(calc.output.decimals) : "not calculable"}${calc.output.unit ? ` ${calc.output.unit}` : ""}`,
    bandLabel ? `Interpretation shown: ${plain(bandLabel)}` : null,
    calc.interpretation.length ? `Interpretation bands: ${calc.interpretation.map((b) => `${b.min ?? "−∞"} to <${b.max ?? "∞"}: ${plain(b.label)}`).join("; ")}` : null,
    `Formula: ${calc.formula.replace(/Math\./g, "")}`,
    calc.notes ? `Notes: ${plain(calc.notes)}` : null,
  ]);
}

export function abgText(input: AbgInput, res: AbgResult): string {
  return lines([
    "ABG interpreter (current values)",
    `Inputs: pH ${input.ph}, pCO2 ${input.pco2} mmHg, HCO3 ${input.hco3} mmol/L${input.na !== undefined ? `, Na ${input.na}` : ""}${input.cl !== undefined ? `, Cl ${input.cl}` : ""}${input.albumin !== undefined ? `, albumin ${input.albumin} g/L` : ""}`,
    `Interpretation: ${res.diagnoses.join(" + ")}`,
    res.ag !== undefined ? `Anion gap: ${res.ag.toFixed(1)}` : null,
    res.correctedAg !== undefined ? `Corrected anion gap: ${res.correctedAg.toFixed(1)}` : null,
    res.deltaRatio !== undefined ? `Delta ratio: ${res.deltaRatio.toFixed(2)}` : null,
    res.expectedPco2 ? `Expected pCO2 (Winter's): ${res.expectedPco2[0]}–${res.expectedPco2[1]} mmHg` : null,
    "Steps shown:",
    ...res.steps.map((s, i) => `${i + 1}. ${plain(s.title)}: ${plain(s.result)}${s.detail ? ` — ${plain(s.detail)}` : ""}`),
  ]);
}

export type EcgStateText = {
  rhythm: string; rhythmNote?: string; rateSetting: number; avDelayMs: number; modified: boolean;
  blocked: string[];
  measurements?: { hr?: number | null; pr?: number | null; qrs?: number | null; qt?: number | null; qtc?: number | null; axis?: number | null } | null;
  now?: { title: string; electrical: string; mechanical: string } | null;
  expected?: { p: string; pr: string; qrs: string; st: string; t: string } | null;
  criteria?: string[];
};

export function ecgText(s: EcgStateText): string {
  const n = (v: number | null | undefined, u: string) => (v === null || v === undefined || !Number.isFinite(v) ? "not measurable" : `${Math.round(v)} ${u}`);
  const m = s.measurements;
  return lines([
    "ECG OS simulator (simplified educational model), current state",
    `Rhythm/condition: ${s.rhythm}${s.modified ? " (modified by the learner)" : ""}`,
    s.rhythmNote ? `About this rhythm: ${plain(s.rhythmNote)}` : null,
    `Sinus rate setting: ${s.rateSetting}/min; AV nodal delay: ${s.avDelayMs} ms`,
    `Blocked conduction pathways: ${s.blocked.length ? s.blocked.join(", ") : "none"}`,
    m ? `Measured: heart rate ${n(m.hr, "/min")}, PR ${n(m.pr, "ms")}, QRS ${n(m.qrs, "ms")}, QT ${n(m.qt, "ms")}, QTc (Bazett) ${n(m.qtc, "ms")}, QRS axis ${n(m.axis, "°")}` : null,
    s.now ? `At this moment of the strip: ${s.now.title}. Electrical: ${plain(s.now.electrical)} Mechanical: ${plain(s.now.mechanical)}` : null,
    s.expected ? `Expected findings for the base condition: P ${s.expected.p}; PR ${s.expected.pr}; QRS ${s.expected.qrs}; ST ${s.expected.st}; T ${s.expected.t}` : null,
    s.criteria?.length ? `Criteria: ${s.criteria.join("; ")}` : null,
  ]);
}

export type VentStateText = {
  caseName: string; mode: string;
  settings: Record<string, string | number>;
  patient?: Record<string, string | number>;
  phase: string; phaseText: string;
  measured?: Record<string, string>;
  flags?: string[]; alarm?: string | null;
};

export function ventText(s: VentStateText): string {
  const kv = (o?: Record<string, string | number>) => (o ? Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ") : "");
  return lines([
    "Ventilator OS simulator (simplified educational model), current state",
    `Patient case: ${s.caseName}`,
    `Mode: ${s.mode}`,
    `Settings: ${kv(s.settings)}`,
    s.patient ? `Lung model: ${kv(s.patient)}` : null,
    `Current phase: ${s.phase}. ${plain(s.phaseText)}`,
    s.measured ? `Last breath measurements: ${kv(s.measured)}` : null,
    s.flags?.length ? `Flags shown: ${s.flags.join(" ")}` : null,
    s.alarm ? `Alarm: ${s.alarm}` : null,
  ]);
}

export function drugText(d: Antimicrobial): string {
  return lines([
    `Antimicrobial: ${d.name} (${d.drugClass}${d.subclass ? `, ${d.subclass}` : ""})`,
    `Route: ${d.route.join(", ")}`,
    `Spectrum: ${plain(d.spectrum)}`,
    `Indications: ${d.indications.map(plain).join("; ")}`,
    `Adult dose: ${plain(d.dose.adult)}`,
    d.dose.severeICU ? `Severe/ICU dose: ${plain(d.dose.severeICU)}` : null,
    d.dose.renal ? `Renal adjustment: ${plain(d.dose.renal)}` : null,
    d.dose.hepatic ? `Hepatic adjustment: ${plain(d.dose.hepatic)}` : null,
    d.contraindications.length ? `Contraindications: ${d.contraindications.map(plain).join("; ")}` : null,
    d.cautions.length ? `Cautions: ${d.cautions.map(plain).join("; ")}` : null,
    `India availability: ${plain(d.indiaAvailability)}${d.availabilityNote ? ` (${plain(d.availabilityNote)})` : ""}`,
  ]);
}

export const ctx = (kind: AiContext["kind"], title: string, text: string, actions?: AiContext["actions"]): AiContext => ({ kind, title: title.slice(0, AI_LIMITS.title), text: clip(text), actions });
