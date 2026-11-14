# ICU 360 — Content Format (schema 1.0.0)

This is the authoritative spec for every clinical module in ICU 360. It is written for two readers:

- **A coding agent** (Grok, Claude Code, Codex…) that will build the Next.js app from these files.
- **The clinical reviewer** (Kenil) who needs to read and check content without opening JSON.

> **Golden rule:** `module.json` is the single source of truth. `module.md` and `index.html` are generated from it — never edit them by hand.

---

## 1. Files at a glance

```
icu-content/
├── shared/
│   ├── CONTENT_FORMAT.md        ← this file
│   ├── CHANGELOG.md             ← every schema change after v1.0.0 must be logged here
│   ├── SCHEMA_READY             ← flag: schema frozen at this timestamp
│   ├── modules-index.json       ← all 40 modules: id, number, folder, section, phase, planned topics, icon
│   ├── calculators.json         ← shared calculators (formulas, inputs, bands, references)
│   ├── schema/
│   │   ├── module.schema.json       ← JSON Schema (draft 2020-12) for module.json
│   │   ├── calculators.schema.json  ← JSON Schema for calculators.json
│   │   └── types.ts                 ← identical TypeScript types for the app
│   ├── tools/
│   │   ├── validate.py          ← run before every commit / zip
│   │   ├── build_readable.py    ← makes module.md files + the offline index.html viewer
│   │   ├── yaml2json.py         ← optional: write modules in compact YAML, convert to JSON
│   │   └── pubmed_lookup.py     ← find PMID / DOI for a reference
│   └── examples/04-sepsis-septic-shock/   ← worked example (module.json, module.md, source.yaml)
└── phase1/  (phase2/, phase3/)
    ├── index.html               ← offline viewer for that phase (double-click)
    └── modules/
        └── 04-sepsis-septic-shock/
            ├── module.json      ← SOURCE OF TRUTH
            └── module.md        ← generated, human-readable
```

Folder name = `<two-digit number>-<module id>`, exactly as in `modules-index.json`. Module ids, numbers, sections and phases are fixed there.

## 2. Module (`module.json`)

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | `"1.0.0"` | constant |
| `id` | slug | from modules-index (e.g. `sepsis-septic-shock`) |
| `number` | int | 1–40, from modules-index |
| `folder` | string | `NN-id` |
| `section` | `{id: "A".."K", title}` | from modules-index |
| `phase` | 1 \| 2 \| 3 | from modules-index |
| `title`, `summary` | string | summary ≥ 20 chars, one or two sentences |
| `tags` | string[] | search keywords (drug names, synonyms, abbreviations) |
| `relatedModules` | slug[] | ids that exist in modules-index (cross-links in the app) |
| `version` | semver | start at `0.1.0`; bump on content change |
| `lastReviewed` | ISO date \| null | null until a consultant signs off |
| `reviewStatus` | enum | `draft-needs-consultant-review` → `consultant-reviewed` → `published` |
| `uiHints` | `{icon, accent}` | Lucide icon name; accent `critical` (red) / `high` (amber) / `standard` (teal) |
| `viewKey` | string | `module:<id>` — key for the view counter |
| `topics` | Topic[] | ≥ 1, in reading order |
| `drugs` | Drug[] | module formulary; topics and dose cards refer to these by `id` |
| `references` | Reference[] | module bibliography; everything cites these by `id` |
| `verify` | VerifyItem[] | optional module-level items for the reviewer |
| `authors` | string[] | optional |

## 3. Topic — the three layers

Every topic has the same shape, so the app can render every topic with one component.

```
Topic
├── id, title, summary, viewKey ("topic:<moduleId>/<topicId>"), uiHints
├── bedside            ← LAYER 1: what to do at 3 am
│   ├── definition?    (callout)
│   ├── steps[]        {n, time?, title, detail, refs?}   numbered 1..N, time chip e.g. "≤ 1 h"
│   ├── doseCards[]?   {drugId, role, route, dose, doseRange?, dilution?, target?, workedExample?, calculatorId?, notes?, verify?, refs?}
│   ├── tables[]?      {id, title, columns[], rows[][], caption?, refs?}
│   ├── redFlags[]     callouts (always shown in red)
│   ├── pitfalls[]?    callouts (amber)
│   └── pearls[]?      callouts (teal)
├── algorithm | null   ← LAYER 2: step-through flowchart (see §4)
├── consultantNotes    ← LAYER 3: markdown {pathophysiology?, evidence (required), controversies?, indiaNotes?}
├── drugIds[]          drugs used in this topic (must exist in module.drugs)
├── calculatorIds[]    shared calculators to show (must exist in calculators.json)
├── references[]       reference ids cited by this topic (≥ 1)
├── quiz[]             3–5 MCQs {id, stem, options (4–5), answerIndex (0-based), explanation}
└── verify[]?          {item, reason} for the reviewer
```

**Text fields** (`detail`, callout `text`, table cells, dose fields) allow *inline* markdown only: `**bold**`, `*italic*`, `` `code` ``, `[link](https://…)`. `consultantNotes` fields allow block markdown: paragraphs, `-` lists, `####` headings.

**Citations inside text:** use the structured `refs` arrays, not inline “[1]” markers.

## 4. Algorithms (Layer 2)

A directed graph rendered as a tap-through stepper (one node at a time, buttons for each outgoing edge) plus a full-chart view.

- `nodes[]`: `{id, type: start|action|decision|end, text, detail?, severity?}`
- `edges[]`: `{from, to, label?}`
- Exactly **one** `start`; at least one `end`; every node reachable from start.
- `decision` nodes need ≥ 2 outgoing edges, **all labelled** (e.g. "Yes"/"No", "MAP < 65").
- `end` nodes have no outgoing edges; every other node has ≥ 1.
- Loops are allowed (e.g. "still fluid responsive → give another bolus").
- `severity: critical` = red border (life-threatening step).
- A topic with no sensible flowchart sets `"algorithm": null`; the app hides the tab.

## 5. Drugs and dose cards

- `drugs[]` (formulary): `{id, name, class, indications, adultDose, preparationIndia?, renalHepatic?, cautions?, monitoring?, verify?, refs}`.
- Dose cards are the bedside view of a drug *for that topic*. Always give: adult dose with units, a **common Indian preparation/dilution**, and a **worked example for a 70 kg adult** (or the weight stated).
- Units: mcg (not µg) in doses, mg, g, units (not IU/U), mL, mL/h, mcg/kg/min, mmol/L, mg/dL for creatinine, glucose and bilirubin (Indian lab convention). Give both units when they matter (e.g. sodium mmol/L).
- `doseRange` is machine-readable: `{min, max, unit}` so the app can warn when a calculator result is out of range.
- Link infusions to a calculator with `calculatorId` (e.g. `infusion-rate-weight-min`).

## 6. Calculators (`shared/calculators.json`)

Each calculator: `{id, name, category, description, inputs[], formula, output{label, unit?, decimals}, interpretation[], references[], example{inputs, expected}, notes?, verify?}`.

**Formula grammar** (safe to evaluate in JS and Python):

- Identifiers = input ids. Numbers. Operators `+ - * / ( ) ,`.
- Functions: `Math.sqrt Math.pow Math.min Math.max Math.abs Math.log10 Math.round` only.
- No ternaries, comparisons or strings. Categorical choices are `select` inputs whose options carry numeric values (e.g. sex → 50 / 45.5 for PBW).
- `boolean` inputs contribute `points` when true (default 1) and 0 when false; scores are sums.
- `interpretation` bands: `min` inclusive, `max` exclusive, first match wins.
- `example` is evaluated by `validate.py` — expected must match within 1%.

To add a calculator after the schema freeze: add it to `calculators.json`, make sure `validate.py` passes, and add a CHANGELOG line (“added calculator x”). Do not rename or delete existing ids.

## 7. References — citation policy

- Every module has `references[]`: `{id, citation, url, year, doi?, type?}`. `id` is short and memorable (`ssc2021`, `adrenal`).
- **Never invent a citation.** Preferred `url` is `https://doi.org/<doi>` and the DOI must resolve (`validate.py --check-dois` checks Crossref). Otherwise use the guideline publisher page or the PubMed page `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`.
- Use `shared/tools/pubmed_lookup.py "title words author"` to find PMIDs and DOIs.
- Cite primary guidelines first (SSC, AHA/ERC, KDIGO, ATS/ESICM, BTS, NICE, ISCCM, ICMR, WHO, national programmes), then landmark RCTs.

## 8. The `verify` mechanism

Anything a careful consultant might query gets a `verify` note: doses that vary by local formulary, Indian availability, contested thresholds, values from a single source, or anything the author was not fully certain of. `verify` exists on modules, topics, drugs, dose cards and calculators. The phase checklist (`PHASEn_REVIEW_CHECKLIST.md`) collects all of them plus every dose and threshold.

## 9. Writing style

- Bedside layer: short imperative steps ("Give…", "Check…"), numbers with units, no paragraphs. A junior at 3 am must act from it.
- Algorithm text ≤ ~12 words per node; put the rest in `detail`.
- Consultant notes: evidence with trial names and years, real controversies, and an **India** paragraph (availability, cost, epidemiology, national guidance).
- British spelling (haemoglobin, oedema), generic drug names, adult doses unless stated.
- Every dose is for adults; paediatrics lives in module 31.

## 10. Commands

```bash
pip install jsonschema pyyaml                         # once
python3 shared/tools/validate.py                      # all phases
python3 shared/tools/validate.py phase1               # one phase
python3 shared/tools/validate.py phase1 --check-dois  # + Crossref DOI check (internet)
python3 shared/tools/build_readable.py phase1         # module.md files + phase1/index.html
python3 shared/tools/build_readable.py --all --out ICU360-all.html
python3 shared/tools/yaml2json.py my-module.yaml      # optional YAML shorthand → module.json
```

**YAML shorthand** (optional, see `examples/04-sepsis-septic-shock/source.yaml`): module meta comes from modules-index via `number`; steps are `"time | title | detail [ref: a, b]"`; nodes are `"id | type | text | detail | severity"`; edges are `"from > to | label"`; callouts are strings with an optional trailing `[ref: a, b]`; dose cards use `drug, role, route, dose, range: [min, max, unit], dilution, target, example, calc, notes, verify, refs`; quiz items use `q, o, a, e`.

## 11. How the app consumes this

- Build time: import every `phase*/modules/*/module.json`, validate against `module.schema.json` (or trust `types.ts`), generate static routes `/m/<moduleId>` and `/m/<moduleId>/<topicId>` with tabs `bedside | algorithm | notes | quiz`.
- Search index: titles, summaries, tags, drug names, step titles, table cells.
- Drug pages: group `drugs[]` across modules by `id` (same id = same drug), but keep each module's entry as its own card keyed by `(moduleId, drugId)`: `indications`, `adultDose` and `preparationIndia` are written for that module's context and differ on purpose (e.g. atropine in cardiac arrest vs organophosphate poisoning). Show the module name on each card. (Clarified in 1.1.0.)
- Calculators: `/tools/<calculatorId>` from `calculators.json`; topic pages show the linked ones.
- View counter: `viewKey` strings (`module:…`, `topic:…/…`) are the keys for the weekly view-count job.
- Offline/PWA: all content is static JSON, so precache it.
- Show the `reviewStatus` badge and a disclaimer until `published`.

## 12. Changing the schema

The schema is frozen at the timestamp in `SCHEMA_READY`. Any change after that requires: (1) editing `module.schema.json` **and** `types.ts`, (2) bumping `schemaVersion` if not backward-compatible, (3) a dated entry in `CHANGELOG.md`, (4) re-running `validate.py` on every phase.
