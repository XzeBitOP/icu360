"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, RotateCcw, ListTree, Flag, OctagonAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Algorithm, AlgoNode } from "@/lib/content-types";

const muted = "text-ink-500 dark:text-night-muted";
const grad = { background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3),0 10px 24px -10px rgba(27,79,160,.7)" };

function md(text: string) {
  // inline **bold** only (algorithm text is short)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") ? <b key={i} className="font-semibold text-ink-900 dark:text-night-text">{p.slice(2, -2)}</b> : <span key={i}>{p.replace(/[*`]/g, "")}</span>));
}

function choiceTone(label: string) {
  const l = label.toLowerCase();
  if (/^(yes|present|positive|abnormal|unstable|severe|shockable)/.test(l)) return "yes";
  if (/^(no|absent|negative|normal|stable|non-shockable|nonshockable)/.test(l)) return "no";
  return "other";
}

export function AlgorithmStepper({ algo }: { algo: Algorithm }) {
  const nodes = useMemo(() => new Map(algo.nodes.map((n) => [n.id, n])), [algo]);
  const out = useMemo(() => {
    const m = new Map<string, { to: string; label?: string }[]>();
    for (const e of algo.edges) m.set(e.from, [...(m.get(e.from) ?? []), { to: e.to, label: e.label }]);
    return m;
  }, [algo]);
  const start = algo.nodes.find((n) => n.type === "start") ?? algo.nodes[0];
  const [path, setPath] = useState<{ id: string; via?: string }[]>([{ id: start.id }]);
  const [dir, setDir] = useState(1);
  const [chart, setChart] = useState(false);
  const curRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const cur = nodes.get(path[path.length - 1].id)!;
  const edges = out.get(cur.id) ?? [];

  // shortest remaining distance to an end node (for "Step x of ~y")
  const remaining = useMemo(() => {
    const seen = new Set([cur.id]);
    let frontier = [cur.id];
    let d = 0;
    while (frontier.length) {
      if (frontier.some((id) => nodes.get(id)?.type === "end")) return d;
      const next: string[] = [];
      for (const id of frontier) for (const e of out.get(id) ?? []) if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to); }
      frontier = next;
      d++;
    }
    return 0;
  }, [cur.id, nodes, out]);
  const stepNo = path.length;
  const totalEst = stepNo + remaining;

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    curRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [path.length]);

  const go = (to: string, via?: string) => { setDir(1); setPath((p) => [...p, { id: to, via }]); };
  const back = () => { if (path.length > 1) { setDir(-1); setPath((p) => p.slice(0, -1)); } };
  const restart = () => { setDir(-1); setPath([{ id: start.id }]); };

  const single = edges.length === 1 ? edges[0] : null;
  const isDecision = cur.type === "decision" || (edges.length > 1);
  const nextPreview = single ? nodes.get(single.to) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className={`text-[13px] ${muted}`}>
          Step <b className="text-ink-900 dark:text-night-text">{stepNo}</b> of {cur.type === "end" ? stepNo : `~${totalEst}`}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: Math.min(totalEst, 10) }).map((_, i) => (
            <span key={i} className={`h-1.5 w-5 sm:w-7 rounded-full transition-colors ${i < stepNo - 1 ? "bg-ok" : i === stepNo - 1 ? "bg-brand-500 dark:bg-glow-teal" : "bg-ink-300/60 dark:bg-white/15"}`} />
          ))}
        </div>
      </div>

      {algo.description ? <p className={`text-[13px] ${muted} px-1 leading-relaxed`}>{algo.description}</p> : null}

      <div>
        {/* trail */}
        {path.slice(0, -1).map((p, i) => {
          const n = nodes.get(p.id)!;
          const via = path[i + 1].via;
          return (
            <div key={`${p.id}-${i}`}>
              {i === 0 && n.type === "start" ? (
                <div className="mx-auto max-w-[300px] rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-center px-4 py-2.5 text-[13.5px] font-semibold shadow-lg">{md(n.text)}</div>
              ) : (
                <button type="button" onClick={() => { setDir(-1); setPath((pp) => pp.slice(0, i + 1)); }} className="w-full text-left glass-strong rounded-[22px] px-4 py-3 flex items-center gap-2.5" aria-label={`Go back to: ${n.text}`}>
                  <span className="w-6 h-6 rounded-full grid place-items-center bg-ok text-white shrink-0"><Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /></span>
                  <p className="font-semibold text-[14px] leading-snug flex-1">{md(n.text)}</p>
                </button>
              )}
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-3 rounded bg-ink-300/70 dark:bg-white/15" />
                {via ? <span className="glass-chip rounded-full px-2.5 py-0.5 text-[11px] font-bold text-brand-700 dark:text-glow-teal">{via}</span> : null}
                <div className="w-[2px] h-3 rounded bg-ink-300/70 dark:bg-white/15" />
              </div>
            </div>
          );
        })}

        {/* current */}
        <div ref={curRef} className="scroll-mt-24">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={`${cur.id}-${path.length}`} custom={dir}
              initial={{ opacity: 0, y: dir > 0 ? 28 : -18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: dir > 0 ? -14 : 20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}>
              <CurrentNode node={cur} stepNo={stepNo} edges={edges} nodes={nodes} isDecision={isDecision} onChoose={go} onRestart={restart} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* preview of the next step */}
        {nextPreview && cur.type !== "end" ? (
          <motion.div key={`prev-${nextPreview.id}-${path.length}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="mx-auto w-[2px] h-5 rounded bg-ink-300/70 dark:bg-white/15" />
            <div className="glass opacity-60 rounded-[22px] p-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold bg-ink-200 text-ink-500 dark:bg-white/10 dark:text-night-muted">{stepNo + 1}</span>
                <p className="font-semibold text-[15px]">{nextPreview.type === "decision" ? "Decision: " : ""}{md(nextPreview.text)}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={back} disabled={path.length < 2}
          className="glass-btn h-12 rounded-full text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" strokeWidth={2} aria-hidden="true" />Back
        </motion.button>
        {cur.type === "end" ? (
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={restart} className="h-12 rounded-full text-white text-[14px] font-semibold flex items-center justify-center gap-1.5" style={grad}>
            <RotateCcw className="w-4 h-4" strokeWidth={2} aria-hidden="true" />Restart
          </motion.button>
        ) : single ? (
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => go(single.to, single.label)} className="h-12 rounded-full text-white text-[14px] font-semibold flex items-center justify-center gap-1.5" style={grad}>
            Next step<ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          </motion.button>
        ) : (
          <button type="button" disabled className="h-12 rounded-full text-white/90 text-[14px] font-semibold flex items-center justify-center gap-1.5 opacity-50" style={grad}>
            Choose above
          </button>
        )}
      </div>

      <button type="button" onClick={() => setChart((c) => !c)} className={`flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 dark:text-glow-teal px-1`} aria-expanded={chart}>
        <ListTree className="w-4 h-4" strokeWidth={2} aria-hidden="true" />{chart ? "Hide" : "Show"} the whole flowchart
      </button>
      <AnimatePresence>
        {chart && (
          <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass rounded-[22px] p-4 space-y-3 overflow-hidden">
            {algo.nodes.map((n) => (
              <li key={n.id} className="text-[13.5px] leading-snug">
                <p className="font-semibold">
                  <span className={`text-[10.5px] uppercase tracking-[.08em] mr-2 ${n.type === "decision" ? "text-warn dark:text-warn-bright" : n.type === "end" ? "text-ok dark:text-ok-bright" : n.severity === "critical" ? "text-crit dark:text-crit-bright" : muted}`}>{n.type}</span>
                  {md(n.text)}
                </p>
                {(out.get(n.id) ?? []).map((e, i) => (
                  <p key={i} className={`${muted} text-[12.5px] pl-3`}>→ {e.label ? <b className="text-brand-700 dark:text-glow-teal">{e.label}: </b> : null}{nodes.get(e.to)?.text}</p>
                ))}
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

function CurrentNode({ node, stepNo, edges, nodes, isDecision, onChoose, onRestart }: {
  node: AlgoNode; stepNo: number; edges: { to: string; label?: string }[]; nodes: Map<string, AlgoNode>; isDecision: boolean; onChoose: (to: string, via?: string) => void; onRestart: () => void;
}) {
  const crit = node.severity === "critical";
  if (node.type === "start" && !isDecision)
    return (
      <div className="space-y-3">
        <div className="mx-auto max-w-[300px] rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-center px-4 py-2.5 text-[13.5px] font-semibold shadow-lg">{md(node.text)}</div>
        {node.detail ? <p className={`text-[13.5px] ${muted} text-center px-4`}>{md(node.detail)}</p> : null}
      </div>
    );
  if (isDecision) {
    const allLabelled = edges.every((e) => e.label);
    return (
      <div className="space-y-3">
        <div className="callout warn mx-auto max-w-[340px] rounded-[20px] px-4 py-3 text-center" style={{ boxShadow: "0 0 0 6px rgba(253,176,34,.12),0 18px 40px -16px rgba(196,87,10,.35)" }}>
          <p className="text-[11px] uppercase tracking-[.09em] font-bold text-warn dark:text-warn-bright">{node.type === "decision" ? "Decision" : "Choose your next step"}</p>
          <p className="font-semibold text-[15px] leading-snug mt-0.5">{md(node.text)}</p>
          {node.detail ? <p className={`text-[12.5px] ${muted} mt-1`}>{md(node.detail)}</p> : null}
        </div>
        <div className={`grid gap-2.5 ${edges.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {edges.map((e, i) => {
            const target = nodes.get(e.to);
            const tone = choiceTone(e.label ?? "");
            const label = allLabelled ? e.label : e.label ?? target?.text;
            return (
              <motion.button key={i} type="button" whileTap={{ scale: 0.96 }} whileHover={{ y: -1 }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.08 + i * 0.06 } }}
                onClick={() => onChoose(e.to, e.label ?? target?.text)}
                className={`rounded-[18px] px-4 py-3 text-left min-h-12 ${tone === "yes" ? "callout crit" : tone === "no" ? "callout ok" : "glass-strong"}`}>
                <span className={`block text-[14px] font-bold ${tone === "yes" ? "text-crit dark:text-crit-bright" : tone === "no" ? "text-ok dark:text-ok-bright" : "text-brand-700 dark:text-glow-teal"}`}>{label}</span>
                {allLabelled && target ? <span className={`block text-[12px] ${muted} mt-0.5 leading-snug line-clamp-2`}>then: {target.text}</span> : null}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }
  if (node.type === "end")
    return (
      <div className="callout ok rounded-[22px] pl-5 pr-4 py-4">
        <span className="bar bg-ok" />
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.07em] text-ok dark:text-ok-bright"><Flag className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />End point</p>
        <p className="font-semibold text-[16px] leading-snug mt-1">{md(node.text)}</p>
        {node.detail ? <p className={`text-[13.5px] ${muted} mt-1.5 leading-[1.5]`}>{md(node.detail)}</p> : null}
        <button type="button" onClick={onRestart} className="mt-3 text-[13px] font-semibold text-brand-600 dark:text-glow-teal">Start again</button>
      </div>
    );
  return (
    <div className={`glass-strong rounded-[22px] p-4 ring-2 ${crit ? "ring-crit/70 dark:ring-crit-bright/60" : "ring-brand-400/70 dark:ring-glow-teal/60"}`}
      style={{ boxShadow: crit ? "0 0 0 6px rgba(217,45,32,.12),0 18px 40px -16px rgba(217,45,32,.4)" : "0 0 0 6px rgba(62,157,174,.15),0 18px 40px -16px rgba(20,90,140,.45)" }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold text-white shrink-0" style={{ background: crit ? "linear-gradient(160deg,#F04438,#B42318)" : "linear-gradient(160deg,#1A8A9A,#1B4FA0)" }}>{stepNo}</span>
        <p className="font-semibold text-[15.5px] leading-snug flex-1">{md(node.text)}</p>
        {crit ? <OctagonAlert className="w-4 h-4 text-crit dark:text-crit-bright" strokeWidth={2.2} aria-label="Critical step" /> : null}
      </div>
      {node.detail ? <div className={`text-[13.5px] leading-[1.5] ${muted} mt-1.5`}>{md(node.detail)}</div> : null}
    </div>
  );
}
