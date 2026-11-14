#!/usr/bin/env python3
"""Validate ICU 360 content.

Usage:
  python3 shared/tools/validate.py                 # validate every */modules/*/module.json under the content root
  python3 shared/tools/validate.py phase1          # only phase1/modules
  python3 shared/tools/validate.py --check-dois    # also look up every DOI on Crossref (needs internet)

Requires: pip install jsonschema
Exit code 0 = no errors (warnings allowed), 1 = errors.
"""
import json, math, re, sys, os, glob, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
SHARED = os.path.dirname(HERE)
ROOT = os.path.dirname(SHARED)

try:
    import jsonschema
except ImportError:
    sys.exit("Missing dependency: pip install jsonschema")

def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

ALLOWED_MATH = {"sqrt", "pow", "min", "max", "abs", "log10", "round"}

def eval_formula(formula, values):
    used = set(re.findall(r"Math\.([a-zA-Z0-9]+)", formula))
    bad = used - ALLOWED_MATH
    if bad:
        raise ValueError(f"disallowed Math functions {bad}")
    expr = formula.replace("Math.", "_m.")
    if re.search(r"[^\w\s\.\+\-\*/\(\),]", expr):
        raise ValueError("formula contains characters outside the allowed grammar")
    ns = {"_m": type("M", (), {"sqrt": math.sqrt, "pow": math.pow, "min": min, "max": max, "abs": abs, "log10": math.log10, "round": round})}
    ns.update(values)
    return eval(expr, {"__builtins__": {}}, ns)

def check_calculators(errors, warnings):
    path = os.path.join(SHARED, "calculators.json")
    data = load(path)
    schema = load(os.path.join(SHARED, "schema", "calculators.schema.json"))
    for e in jsonschema.Draft202012Validator(schema).iter_errors(data):
        errors.append(f"calculators.json: {'/'.join(map(str, e.absolute_path))}: {e.message}")
    ids = set()
    for c in data.get("calculators", []):
        cid = c.get("id")
        if cid in ids:
            errors.append(f"calculators.json: duplicate id {cid}")
        ids.add(cid)
        input_ids = {i["id"] for i in c["inputs"]}
        names = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", c["formula"])) - {"Math"} - ALLOWED_MATH
        missing = names - input_ids
        if missing:
            errors.append(f"calculator {cid}: formula uses unknown inputs {sorted(missing)}")
            continue
        for i in c["inputs"]:
            if i["type"] == "select" and not i.get("options"):
                errors.append(f"calculator {cid}: select input {i['id']} has no options")
        vals = dict(c["example"]["inputs"])
        if set(vals) != input_ids:
            errors.append(f"calculator {cid}: example inputs {sorted(vals)} != inputs {sorted(input_ids)}")
            continue
        try:
            got = eval_formula(c["formula"], vals)
            if abs(got - c["example"]["expected"]) > 0.01 * max(1, abs(c["example"]["expected"])):
                errors.append(f"calculator {cid}: example expected {c['example']['expected']} but formula gives {round(got, 4)}")
        except Exception as ex:
            errors.append(f"calculator {cid}: formula error: {ex}")
    return ids

def walk_refs(obj, acc):
    """Collect every refs/references list of ids inside a topic or drug."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "refs" and isinstance(v, list):
                acc.update(v)
            else:
                walk_refs(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            walk_refs(v, acc)

def check_algorithm(where, alg, errors, warnings):
    nodes = {}
    for n in alg["nodes"]:
        if n["id"] in nodes:
            errors.append(f"{where}: duplicate node id {n['id']}")
        nodes[n["id"]] = n
    starts = [n for n in alg["nodes"] if n["type"] == "start"]
    ends = [n for n in alg["nodes"] if n["type"] == "end"]
    if len(starts) != 1:
        errors.append(f"{where}: needs exactly one start node (found {len(starts)})")
    if not ends:
        errors.append(f"{where}: needs at least one end node")
    out = {k: [] for k in nodes}
    for e in alg["edges"]:
        for side in ("from", "to"):
            if e[side] not in nodes:
                errors.append(f"{where}: edge {e['from']}->{e['to']} references missing node '{e[side]}'")
        if e["from"] in out:
            out[e["from"]].append(e)
    for nid, n in nodes.items():
        if n["type"] == "end" and out[nid]:
            errors.append(f"{where}: end node {nid} has outgoing edges")
        if n["type"] != "end" and not out[nid]:
            errors.append(f"{where}: node {nid} ({n['type']}) has no outgoing edge")
        if n["type"] == "decision":
            if len(out[nid]) < 2:
                errors.append(f"{where}: decision node {nid} needs >= 2 outgoing edges")
            if any(not e.get("label") for e in out[nid]):
                errors.append(f"{where}: decision node {nid} has an unlabelled edge")
    if len(starts) == 1:
        seen, stack = set(), [starts[0]["id"]]
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack += [e["to"] for e in out.get(x, []) if e["to"] in nodes]
        unreachable = set(nodes) - seen
        if unreachable:
            errors.append(f"{where}: nodes unreachable from start: {sorted(unreachable)}")

def check_module(path, schema, calc_ids, index_ids, errors, warnings, stats):
    rel = os.path.relpath(path, ROOT)
    try:
        m = load(path)
    except Exception as ex:
        errors.append(f"{rel}: invalid JSON: {ex}")
        return
    errs = list(jsonschema.Draft202012Validator(schema).iter_errors(m))
    for e in errs:
        errors.append(f"{rel}: {'/'.join(map(str, e.absolute_path))}: {e.message[:300]}")
    if errs:
        return
    folder = os.path.basename(os.path.dirname(path))
    if folder != m["folder"]:
        errors.append(f"{rel}: folder name '{folder}' != module.folder '{m['folder']}'")
    if m["folder"] != f"{m['number']:02d}-{m['id']}":
        errors.append(f"{rel}: folder must be '<NN>-<id>' = '{m['number']:02d}-{m['id']}'")
    if m["viewKey"] != f"module:{m['id']}":
        errors.append(f"{rel}: viewKey must be 'module:{m['id']}'")
    if index_ids is not None:
        if m["id"] not in index_ids:
            errors.append(f"{rel}: module id '{m['id']}' not in shared/modules-index.json")
        else:
            ix = index_ids[m["id"]]
            for k in ("number", "phase"):
                if ix[k] != m[k]:
                    errors.append(f"{rel}: {k}={m[k]} but modules-index says {ix[k]}")
            if ix["section"] != m["section"]["id"]:
                errors.append(f"{rel}: section {m['section']['id']} but modules-index says {ix['section']}")
        for r in m["relatedModules"]:
            if r not in index_ids:
                errors.append(f"{rel}: relatedModules '{r}' not in modules-index")
    ref_ids = [r["id"] for r in m["references"]]
    dup = {x for x in ref_ids if ref_ids.count(x) > 1}
    if dup:
        errors.append(f"{rel}: duplicate reference ids {sorted(dup)}")
    ref_set = set(ref_ids)
    drug_ids = [d["id"] for d in m["drugs"]]
    if len(set(drug_ids)) != len(drug_ids):
        errors.append(f"{rel}: duplicate drug ids")
    used_refs = set()
    for d in m["drugs"]:
        for r in d["refs"]:
            used_refs.add(r)
            if r not in ref_set:
                errors.append(f"{rel}: drug {d['id']} cites unknown reference '{r}'")
    topic_ids = set()
    for t in m["topics"]:
        where = f"{rel} › {t['id']}"
        if t["id"] in topic_ids:
            errors.append(f"{where}: duplicate topic id")
        topic_ids.add(t["id"])
        if t["viewKey"] != f"topic:{m['id']}/{t['id']}":
            errors.append(f"{where}: viewKey must be 'topic:{m['id']}/{t['id']}'")
        refs = set(t["references"])
        walk_refs(t, refs)
        used_refs |= refs
        for r in sorted(refs - ref_set):
            errors.append(f"{where}: cites unknown reference '{r}'")
        if not t["references"]:
            errors.append(f"{where}: topic has no references")
        steps = t["bedside"]["steps"]
        if [s["n"] for s in steps] != list(range(1, len(steps) + 1)):
            errors.append(f"{where}: bedside step numbers must run 1..{len(steps)}")
        for dc in t["bedside"].get("doseCards", []):
            if dc["drugId"] not in drug_ids:
                errors.append(f"{where}: dose card drugId '{dc['drugId']}' not in module drugs")
            if dc.get("calculatorId") and dc["calculatorId"] not in calc_ids:
                errors.append(f"{where}: dose card calculatorId '{dc['calculatorId']}' not in shared/calculators.json")
        for d in t["drugIds"]:
            if d not in drug_ids:
                errors.append(f"{where}: drugIds '{d}' not in module drugs")
        for c in t["calculatorIds"]:
            if c not in calc_ids:
                errors.append(f"{where}: calculatorIds '{c}' not in shared/calculators.json")
        for q in t["quiz"]:
            if q["answerIndex"] >= len(q["options"]):
                errors.append(f"{where}: quiz {q['id']} answerIndex out of range")
        qids = [q["id"] for q in t["quiz"]]
        if len(set(qids)) != len(qids):
            errors.append(f"{where}: duplicate quiz ids")
        if t["algorithm"] is not None:
            check_algorithm(f"{where} › algorithm", t["algorithm"], errors, warnings)
        else:
            warnings.append(f"{where}: no algorithm (Algorithm tab will be hidden)")
        stats["topics"] += 1
        stats["quiz"] += len(t["quiz"])
        stats["doseCards"] += len(t["bedside"].get("doseCards", []))
    unused = ref_set - used_refs
    for r in sorted(unused):
        warnings.append(f"{rel}: reference '{r}' is never cited")
    stats["modules"] += 1
    stats["references"] += len(ref_set)
    stats["drugs"] += len(drug_ids)
    return m

def check_dois(paths, errors, warnings):
    seen = {}
    for p in paths:
        try:
            m = load(p)
        except Exception:
            continue
        for r in m.get("references", []):
            url = r["url"]
            mt = re.match(r"https://doi\.org/(.+)$", url)
            if not mt:
                continue
            doi = mt.group(1)
            if doi in seen:
                continue
            try:
                req = urllib.request.Request(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}", headers={"User-Agent": "icu360-validator/1.0 (mailto:none@example.com)"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.load(resp)["message"]
                title = (data.get("title") or [""])[0]
                year = (data.get("issued", {}).get("date-parts") or [[None]])[0][0]
                seen[doi] = (title, year)
                print(f"DOI ok  {doi}  [{year}] {title[:90]}")
                if year and abs(int(year) - int(r["year"])) > 1:
                    warnings.append(f"{os.path.relpath(p, ROOT)}: ref {r['id']} year {r['year']} but Crossref says {year}")
            except urllib.error.HTTPError as ex:
                errors.append(f"{os.path.relpath(p, ROOT)}: ref {r['id']} DOI {doi} not found on Crossref ({ex.code})")
                seen[doi] = None
            except Exception as ex:
                warnings.append(f"{os.path.relpath(p, ROOT)}: ref {r['id']} DOI {doi} lookup inconclusive ({ex})")
                seen[doi] = None

def main():
    import urllib.parse  # noqa
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_doi = "--check-dois" in sys.argv
    errors, warnings = [], []
    calc_ids = check_calculators(errors, warnings)
    idx_path = os.path.join(SHARED, "modules-index.json")
    index_ids = {m["id"]: m for m in load(idx_path)["modules"]} if os.path.exists(idx_path) else None
    schema = load(os.path.join(SHARED, "schema", "module.schema.json"))
    if args:
        paths = []
        for a in args:
            base = a if os.path.isabs(a) else os.path.join(ROOT, a)
            paths += glob.glob(os.path.join(base, "modules", "*", "module.json")) + glob.glob(os.path.join(base, "*", "module.json"))
    else:
        paths = glob.glob(os.path.join(ROOT, "**", "modules", "*", "module.json"), recursive=True)
        paths += glob.glob(os.path.join(SHARED, "examples", "*", "module.json"))
    paths = sorted(set(os.path.abspath(p) for p in paths))
    stats = {"modules": 0, "topics": 0, "quiz": 0, "doseCards": 0, "references": 0, "drugs": 0}
    ids = {}
    for p in paths:
        m = check_module(p, schema, calc_ids, index_ids, errors, warnings, stats)
        if m and "/examples/" not in p:
            if m["id"] in ids:
                errors.append(f"module id {m['id']} appears twice: {ids[m['id']]} and {p}")
            ids[m["id"]] = p
    if check_doi:
        check_dois(paths, errors, warnings)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"\nChecked {len(paths)} module file(s): {stats}. Calculators: {len(calc_ids)}.")
    print(f"{len(errors)} error(s), {len(warnings)} warning(s).")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
