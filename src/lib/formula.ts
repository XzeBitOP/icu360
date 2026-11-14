/**
 * Safe evaluator for the calculator formula grammar in content/shared/CONTENT_FORMAT.md §6:
 * identifiers, numbers, + - * / ( ) , and Math.sqrt/pow/min/max/abs/log10/round. No eval().
 */
type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  "Math.sqrt": Math.sqrt,
  "Math.pow": Math.pow,
  "Math.min": Math.min,
  "Math.max": Math.max,
  "Math.abs": Math.abs,
  "Math.log10": Math.log10,
  "Math.round": Math.round,
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.eE]/.test(src[j])) j++;
      out.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/(),".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`Unexpected character '${c}' in formula`);
  }
  return out;
}

export function evaluate(formula: string, vars: Record<string, number>): number {
  const toks = tokenize(formula);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v?: string) => {
    const t = toks[p++];
    if (!t || (v !== undefined && t.v !== v)) throw new Error(`Expected ${v ?? "token"}`);
    return t;
  };
  function expr(): number {
    let v = term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = eat().v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = eat().v;
      const r = unary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function unary(): number {
    if (peek()?.t === "op" && peek().v === "-") { eat(); return -unary(); }
    if (peek()?.t === "op" && peek().v === "+") { eat(); return unary(); }
    return primary();
  }
  function primary(): number {
    const t = eat();
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") { const v = expr(); eat(")"); return v; }
    if (t.t === "id") {
      if (t.v in FUNCS) {
        eat("(");
        const args: number[] = [];
        if (!(peek()?.t === "op" && peek().v === ")")) {
          args.push(expr());
          while (peek()?.t === "op" && peek().v === ",") { eat(); args.push(expr()); }
        }
        eat(")");
        return FUNCS[t.v](...args);
      }
      if (t.v in vars) return vars[t.v];
      throw new Error(`Unknown identifier '${t.v}'`);
    }
    throw new Error("Unexpected token");
  }
  const v = expr();
  if (p !== toks.length) throw new Error("Trailing tokens in formula");
  return v;
}

export function identifiers(formula: string): string[] {
  return [...new Set(tokenize(formula).filter((t) => t.t === "id" && !(t.v in FUNCS)).map((t) => t.v as string))];
}
