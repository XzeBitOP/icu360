/**
 * ICU 360 content types — schemaVersion 1.0.0
 * Mirrors shared/schema/module.schema.json and calculators.schema.json exactly.
 * If you change one, change the other and add an entry to shared/CHANGELOG.md.
 */

export type Slug = string;            // ^[a-z0-9]+(-[a-z0-9]+)*$
export type RefId = string;           // id of an entry in Module.references
export type SectionId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";
export type Accent = "critical" | "high" | "standard";   // red / amber / teal styling
export type ReviewStatus = "draft-needs-consultant-review" | "consultant-reviewed" | "published";

export interface UiHints { icon: string /* Lucide name, e.g. "heart-pulse" */; accent: Accent; }
export interface VerifyItem { item: string; reason: string; }

export interface Reference {
  id: string;                 // ^[a-z0-9-]+$, unique within the module
  citation: string;
  url: string;                // https://doi.org/... when a DOI exists
  year: number;
  doi?: string;
  type?: "guideline" | "trial" | "review" | "consensus" | "textbook" | "web";
}

export interface Callout { text: string /* inline markdown */; refs?: RefId[]; }

export interface Step {
  n: number;                  // 1..N, consecutive
  time?: string;              // time chip, e.g. "0 min", "≤ 1 h"
  title: string;
  detail: string;             // inline markdown
  refs?: RefId[];
}

export interface DoseCard {
  drugId: Slug;               // must exist in Module.drugs
  role: string;
  route: string;
  dose: string;               // human-readable adult dose with units
  doseRange?: { min?: number; max?: number; unit: string };
  dilution?: string;          // common Indian ICU preparation
  target?: string;
  workedExample?: string;
  calculatorId?: Slug;        // must exist in shared/calculators.json
  notes?: string;
  verify?: string;            // present = value needs consultant verification
  refs?: RefId[];
}

export interface Table {
  id: Slug; title: string;
  columns: string[];          // >= 2
  rows: string[][];           // each cell is inline markdown
  caption?: string; refs?: RefId[];
}

export interface Bedside {
  definition?: Callout;
  steps: Step[];
  doseCards?: DoseCard[];
  tables?: Table[];
  redFlags: Callout[];
  pitfalls?: Callout[];
  pearls?: Callout[];
}

export type NodeType = "start" | "action" | "decision" | "end";
export interface AlgoNode { id: string /* ^[a-z0-9_-]+$ */; type: NodeType; text: string; detail?: string; severity?: Accent; }
export interface AlgoEdge { from: string; to: string; label?: string /* required on edges leaving a decision */; }
export interface Algorithm { title: string; description?: string; nodes: AlgoNode[]; edges: AlgoEdge[]; refs?: RefId[]; }

export interface ConsultantNotes {
  pathophysiology?: string;   // markdown
  evidence: string;           // markdown
  controversies?: string;     // markdown
  indiaNotes?: string;        // markdown
}

export interface QuizItem {
  id: string;
  stem: string;
  options: string[];          // 4-5
  answerIndex: number;        // 0-based
  explanation: string;
}

export interface Topic {
  id: Slug;
  title: string;
  summary: string;
  viewKey: string;            // "topic:<moduleId>/<topicId>"
  uiHints: UiHints;
  bedside: Bedside;           // Layer 1
  algorithm: Algorithm | null;// Layer 2 (null = hide the tab)
  consultantNotes: ConsultantNotes; // Layer 3
  drugIds: Slug[];
  calculatorIds: Slug[];
  references: RefId[];
  quiz: QuizItem[];           // 3-5
  verify?: VerifyItem[];
}

export interface Drug {
  id: Slug; name: string; class: string; indications: string; adultDose: string;
  preparationIndia?: string; renalHepatic?: string; cautions?: string; monitoring?: string;
  verify?: string; refs: RefId[];
}

export interface Module {
  schemaVersion: string;
  id: Slug;
  number: number;
  folder: string;             // "<NN>-<id>"
  section: { id: SectionId; title: string };
  phase: 1 | 2 | 3;
  title: string;
  summary: string;
  tags: string[];
  relatedModules: Slug[];     // module ids from shared/modules-index.json
  version: string;            // semver
  lastReviewed: string | null;// ISO date once a consultant signs off
  reviewStatus: ReviewStatus;
  authors?: string[];
  uiHints: UiHints;
  viewKey: string;            // "module:<id>"
  topics: Topic[];
  drugs: Drug[];
  references: Reference[];
  verify?: VerifyItem[];
}

/* ---------------- shared/calculators.json ---------------- */
export interface CalcInput {
  id: string; label: string; type: "number" | "select" | "boolean";
  unit?: string; default?: number; min?: number; max?: number;
  points?: number;            // boolean only: value when true (default 1)
  options?: { label: string; value: number }[];  // select only
}
export interface CalcBand { min?: number /* inclusive */; max?: number /* exclusive */; label: string; severity: "normal" | "mild" | "moderate" | "severe" | "critical"; }
export interface Calculator {
  id: Slug; name: string;
  category: "infusion" | "body-size" | "ventilation" | "acid-base" | "electrolytes" | "renal" | "haemodynamics" | "cardiac" | "fluids" | "score" | "toxicology" | "dosing" | "other";
  description: string;
  inputs: CalcInput[];
  formula: string;            // see CONTENT_FORMAT.md §6
  output: { label: string; unit?: string; decimals: number };
  interpretation: CalcBand[];
  references: { citation: string; url: string; year: number }[];
  example: { inputs: Record<string, number>; expected: number };
  notes?: string; verify?: string;
}
export interface CalculatorsFile { schemaVersion: string; description?: string; calculators: Calculator[]; }

/* ---------------- shared/modules-index.json ---------------- */
export interface ModuleIndexEntry {
  number: number; id: Slug; folder: string; section: SectionId; sectionTitle: string;
  phase: 1 | 2 | 3; title: string; plannedTopics: string[]; icon: string; accent: Accent;
}
export interface ModulesIndex { schemaVersion: string; description: string; sections: { id: SectionId; title: string }[]; modules: ModuleIndexEntry[]; }
