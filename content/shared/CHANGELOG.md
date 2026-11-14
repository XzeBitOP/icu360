# ICU 360 content schema — changelog

(The app was called **ICU Atlas** until 15 Nov 2026; entries 1.0.0 and 1.1.0 were written under that name.)

All times IST.

## 1.0.0 — 2026-11-14 23:20 IST
- Initial frozen schema: module.schema.json, calculators.schema.json, types.ts.
- 42 shared calculators in calculators.json.
- modules-index.json with all 40 modules (ids, folders, sections, phases, planned topics, icons).
- Tools: validate.py, build_readable.py, yaml2json.py, pubmed_lookup.py.
- Worked example: examples/04-sepsis-septic-shock.

## 1.1.0 — 2026-11-15 00:30 IST (additive, backward-compatible)
No schema files changed; `schemaVersion` stays "1.0.0". All existing calculator ids, input ids and formulas are unchanged, so Phase 2/3 content that references them keeps validating.
- `o2-cylinder-duration`: default capacity 1360 L → **1500 L** (Indian B-type ≈ 1.5 m³); example updated (1500 L, 50%, 10 L/min → 75 min); notes now point to the new contents calculator. (Phase 3 worker suggestion 1.)
- Added calculators (Phase 3 worker suggestion 2, plus one split): `o2-cylinder-contents` (water capacity × bar), `maintenance-fluids-421`, `paeds-ett-size`, `paeds-ett-depth`, `paeds-weight-estimate` (APLS), `croup-score` (Westley), `clinical-frailty-scale` (CFS v2.0), `stop-bang`. Total calculators: 50.
- Shared drug ids with module-specific indication text (Phase 3 worker suggestion 3): **by design**, `drugs[]` live inside each module and `indications` describes the use *in that module*. Apps must key drug cards by `(moduleId, drugId)`, not by `drugId` alone. A global drug list is deferred to a future additive version; no field was added now.
- `CONTENT_FORMAT.md` §11 wording clarified to match: drug pages group by `id` but show one card per `(moduleId, drugId)`. Documentation only.

## 1.2.0 — 2026-11-15 IST (content + branding; schema unchanged)
No schema structure changed; `schemaVersion` stays "1.0.0". All module, topic, drug and calculator ids are unchanged, so app code keyed on them keeps working.

**Surviving Sepsis Campaign 2026 update.** Adult sepsis content now follows SSC 2026 (Prescott HC, Antonelli M, et al. Intensive Care Med 2026;52(5):863-936, doi:10.1007/s00134-026-08361-1; co-published Crit Care Med, doi:10.1097/CCM.0000000000007075; executive summary Crit Care Med 2026;54(4):715-724). Recommendation wording was checked against the official SCCM recommendation list.
- New reference ids: `ssc2026`, `ssc2026-exec`, `vasspr` (VASSPR, JAMA 2026). `ssc2021` is replaced by `ssc2026` in modules 03, 33 (phase 1) and 01, 12, 36, 38 (phase 2); module 04 keeps `ssc2021` only for the 2021-vs-2026 comparison and the line-removal statement.
- 04 Sepsis and septic shock → 0.2.0: all six topics updated (screening, cultures, fluids, MAP 60-65 for age ≥ 65, fluid-then-vasopressor, albumin, gelatin, BP monitoring, antibiotic timing tiers, MDR/anaerobic/antifungal cover, prolonged beta-lactam infusion now strong, source control ≤ 6 h, vasopressin/steroid/inotrope wording, against beta-blockers, terlipressin, levosimendan; de-escalation with negative cultures, SDD). New table `ssc-2026-changes`; new algorithm nodes `ana`, `anacov`; 4 new quiz items; new verify flags.
- 03 Shock and vasoactive support → 0.2.0; 33 ICU pharmacology → 0.2.0; 01 Deteriorating patient → 0.2.0; 12 Haemodynamic monitoring → 0.2.0; 38 Bedside interpretation → 0.2.0; 36 ICU care bundles → 0.2.0 (reference swap only; glucose ≥ 180 mg/dL is unchanged).
- 31 Paediatric emergencies → 0.1.1: verify flag only. The SSC **paediatric** 2026 guideline (Weiss 2026, Pediatr Crit Care Med 27(4):379-434) was published too; this module still follows SSC paediatric 2020 and needs its own review.
- `calculators.json`: `qsofa` notes and references updated to SSC 2026 (formula unchanged).
- `examples/04-sepsis-septic-shock/module.json` replaced with the 0.2.0 module; `source.yaml` kept as the original shorthand demo (marked at the top).

**Rename ICU Atlas → ICU 360.** READMEs, checklists, CONTENT_FORMAT, schema titles and `$id` (`https://icu360.local/...`), types.ts header, tools, viewer titles (`index.html`), module `authors` strings, and zip names (`ICU360-Phase1.zip`, `ICU360-Phase2.zip`, `ICU360-Phase3.zip`). Pre-update originals are backed up in `/home/box/icu-ssc-backup/` (not shipped).

