import Link from "next/link";
import { Clock, Syringe, Calculator as CalcIcon, ChevronRight, ExternalLink } from "lucide-react";
import type { Bedside, DoseCard as DoseCardT, Drug, Module, Reference, Step, Table } from "@/lib/content-types";
import { Callout, Chip, muted, numBadge } from "./ui";
import { Inline } from "./Markdown";
import { getCalculator } from "@/lib/content";

export function StepsList({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.n} className="relative flex gap-3.5 pb-4 last:pb-0">
          {i < steps.length - 1 ? <span className="absolute left-[16px] top-9 bottom-0 w-px bg-gradient-to-b from-brand-300/70 to-brand-300/10 dark:from-glow-teal/40 dark:to-transparent" /> : null}
          <span className="relative z-10 w-[33px] h-[33px] shrink-0 rounded-full grid place-items-center text-[13px] font-bold text-white tnum" style={numBadge}>{s.n}</span>
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[15.5px] leading-snug"><Inline text={s.title} /></p>
              {s.time ? <Chip className="text-brand-700 dark:text-glow-teal">{s.time}</Chip> : null}
            </div>
            <p className={`text-[13.5px] leading-[1.5] ${muted} mt-0.5`}><Inline text={s.detail} /></p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Cell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 border-ink-200/70 dark:border-white/10 ${className}`}>
      <dt className={`${muted} text-[12px]`}>{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium leading-snug"><>{children}</></dd>
    </div>
  );
}

/** 2-column grid; long values span both columns. Returns border hints per cell. */
function layoutCells(cells: [string, string | undefined][]) {
  const out: { l: string; v: string; wide: boolean; right: boolean; top: boolean }[] = [];
  let col = 0;
  let row = 0;
  const list = cells.filter((c): c is [string, string] => !!c[1]);
  list.forEach(([l, v], i) => {
    let wide = v.length > 34;
    const next = list[i + 1];
    if (!wide && col === 0 && (!next || next[1].length > 34)) wide = true; // nothing to pair with
    if (wide && col === 1) { row++; col = 0; }
    out.push({ l, v, wide, right: !wide && col === 0, top: row === 0 });
    if (wide) { row++; col = 0; } else if (col === 1) { row++; col = 0; } else col = 1;
  });
  return out;
}

export function DoseCardView({ card, drug, moduleId }: { card: DoseCardT; drug?: Drug; moduleId: string }) {
  const calc = card.calculatorId ? getCalculator(card.calculatorId) : undefined;
  const cells: [string, string | undefined][] = [
    ["Dose", card.dose],
    ["Range", card.doseRange ? `${card.doseRange.min ?? ""}${card.doseRange.min !== undefined && card.doseRange.max !== undefined ? "–" : ""}${card.doseRange.max ?? ""} ${card.doseRange.unit}`.trim() : undefined],
    ["Preparation", card.dilution],
    ["Target", card.target],
    ["Worked example", card.workedExample],
  ];
  const shown = cells.filter(([, v]) => v);
  return (
    <div className="glass-strong rounded-[24px] overflow-hidden" id={`dose-${card.drugId}`}>
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <span className="w-11 h-11 rounded-[14px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#1A8A9A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
          <Syringe className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[.09em] font-semibold text-ink-400 dark:text-night-muted">{card.role}</p>
          <h3 className="display text-[20px] font-semibold leading-tight">
            <Link href={`/m/${moduleId}#drug-${card.drugId}`}>{drug?.name ?? card.drugId}</Link>
          </h3>
        </div>
        <Chip>{card.route.length > 22 ? card.route.split(/[,;(]/)[0] : card.route}</Chip>
      </div>
      <dl className="grid grid-cols-2 border-t border-ink-200/70 dark:border-white/10">
        {layoutCells(shown).map(({ l, v, wide, right, top }) => (
          <Cell key={l} label={l} className={`${wide ? "col-span-2" : ""} ${right ? "border-r" : ""} ${top ? "" : "border-t"}`}>
            <span className={l === "Dose" ? "font-mono font-semibold text-[14.5px] text-brand-700 dark:text-glow-teal" : ""}><Inline text={v} /></span>
          </Cell>
        ))}
      </dl>
      {card.notes ? <p className={`px-4 py-3 border-t border-ink-200/70 dark:border-white/10 text-[13px] ${muted} leading-relaxed`}><Inline text={card.notes} /></p> : null}
      {calc ? (
        <Link href={`/tools/${calc.id}`} className="w-full flex items-center justify-between px-4 py-3.5 text-white text-[14px] font-semibold" style={{ background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)" }}>
          <span className="flex items-center gap-2"><CalcIcon className="w-4 h-4" strokeWidth={2} aria-hidden="true" />Open {calc.category === "infusion" ? "infusion calculator" : calc.name}</span>
          <ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function TableView({ table }: { table: Table }) {
  return (
    <section>
      <h2 className="display text-[18px] font-semibold mb-2.5 px-1">{table.title}</h2>
      <div className="glass-strong rounded-[22px] overflow-x-auto">
        <table className="w-full text-[13.5px] min-w-[420px]">
          <thead>
            <tr className={`text-left text-[12px] font-semibold ${muted} border-b border-ink-200/70 dark:border-white/10`}>
              {table.columns.map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0 border-ink-200/60 dark:border-white/10 align-top">
                {r.map((c, j) => <td key={j} className={`px-4 py-3 leading-snug ${j === 0 ? "font-semibold" : ""}`}><Inline text={c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.caption ? <p className={`text-[12.5px] ${muted} mt-2 px-1 leading-relaxed`}><Inline text={table.caption} /></p> : null}
    </section>
  );
}

export function RefList({ refs }: { refs: Reference[] }) {
  return (
    <ol className="space-y-3">
      {refs.map((r, i) => (
        <li key={r.id} id={`ref-${r.id}`} className="flex gap-3 text-[13px] leading-[1.5]">
          <span className="font-mono text-[12px] text-ink-400 dark:text-night-faint pt-px">{i + 1}</span>
          <p className="min-w-0">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-ink-700 dark:text-night-text hover:underline break-words">
              {r.citation}
            </a>{" "}
            <ExternalLink className="inline w-3 h-3 text-ink-400 -mt-0.5" aria-hidden="true" />
          </p>
        </li>
      ))}
    </ol>
  );
}

export function RefsCard({ refs, title = "References" }: { refs: Reference[]; title?: string }) {
  if (!refs.length) return null;
  return (
    <section className="glass rounded-[24px] p-4 lg:p-5">
      <h2 className="display text-[16px] font-semibold mb-3">{title}</h2>
      <RefList refs={refs} />
    </section>
  );
}

export function Callouts({ b, which }: { b: Bedside; which: ("crit" | "warn" | "pearl")[] }) {
  return (
    <>
      {which.includes("crit") && b.redFlags.map((c, i) => <Callout key={`c${i}`} kind="crit" title={i === 0 ? "Red flag · call your senior now" : "Red flag"} text={c.text} />)}
      {which.includes("warn") && (b.pitfalls ?? []).map((c, i) => <Callout key={`w${i}`} kind="warn" title="Pitfall" text={c.text} />)}
      {which.includes("pearl") && (b.pearls ?? []).map((c, i) => <Callout key={`p${i}`} kind="pearl" title="Pearl" text={c.text} />)}
    </>
  );
}

export function StepsCard({ steps, title = "Step by step" }: { steps: Step[]; title?: string }) {
  const first = steps[0]?.time;
  return (
    <section className="glass rounded-[26px] p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="display text-[20px] font-semibold">{title}</h2>
        {first ? (
          <Chip className="text-crit dark:text-crit-bright"><Clock className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" /> Timed steps</Chip>
        ) : null}
      </div>
      <StepsList steps={steps} />
    </section>
  );
}

export function drugFor(module: Module, id: string) {
  return module.drugs.find((d) => d.id === id);
}
