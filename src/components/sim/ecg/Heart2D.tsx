"use client";
import { useEffect, useRef, useState } from "react";
import { HEART_STRUCTURES } from "@/sim/cardiac-ep";
import { activeTransits, blockedEdges, structureActivity, type StructureActivity } from "@/sim/ecg";
import { subscribeFrame } from "@/components/sim/waveform";
import { getEngine, getRunner, useEcgStore, type WaveKind } from "./store";

const P0 = Object.fromEntries(HEART_STRUCTURES.map((s) => [s.id, s.position])) as Record<string, { x: number; y: number; z: number }>;
/** 2-D projection: the two left fascicles overlap in the frontal view, so they are separated for legibility. */
const P: Record<string, { x: number; y: number }> = { ...P0, leftAnteriorFascicle: { x: 0.55, y: -0.8 }, leftPosteriorFascicle: { x: 0.2, y: -1.2 }, leftBundle: { x: 0.2, y: -0.45 }, hisBundle: { x: -0.02, y: -0.02 }, avNode: { x: -0.15, y: 0.2 } };
/** 2-D schematic positions (x right = patient's left, y up) for graph nodes, used to draw the travelling impulse. */
const NODE_POS: Record<string, { x: number; y: number }> = {
  saNode: P.saNode, raHigh: { x: -0.7, y: 1.0 }, raLow: P.atrialPathways, laHigh: P.bachmann, laLow: { x: 0.5, y: 0.55 },
  avNode: P.avNode, hisBundle: P.hisBundle, rightBundle: P.rightBundle, leftBundle: P.leftBundle,
  leftAnteriorFascicle: P.leftAnteriorFascicle, leftPosteriorFascicle: P.leftPosteriorFascicle,
  sepL: { x: 0.05, y: -0.75 }, sepR: { x: -0.1, y: -0.75 },
  rvEndo: { x: -0.7, y: -1.0 }, rvEpi: { x: -1.0, y: -1.0 }, rvoEndo: { x: -0.55, y: -0.25 }, rvoEpi: { x: -0.8, y: -0.2 },
  lvaEndo: { x: 0.5, y: -1.45 }, lvaEpi: { x: 0.6, y: -1.7 }, lvlEndo: { x: 0.8, y: -0.8 }, lvlEpi: { x: 1.1, y: -0.8 },
  lviEndo: { x: 0.35, y: -1.1 }, lviEpi: { x: 0.35, y: -1.35 }, lvbEndo: { x: 0.55, y: -0.25 }, lvbEpi: { x: 0.8, y: -0.2 },
};
const LINES: [string, string][] = [
  ["saNode", "atrialPathways"], ["atrialPathways", "avNode"], ["avNode", "hisBundle"], ["hisBundle", "rightBundle"], ["hisBundle", "leftBundle"],
  ["leftBundle", "leftAnteriorFascicle"], ["leftBundle", "leftPosteriorFascicle"], ["rightBundle", "purkinje"], ["leftAnteriorFascicle", "purkinje"], ["leftPosteriorFascicle", "purkinje"], ["saNode", "bachmann"], ["bachmann", "leftAtrium"],
];
const VENTRICLE_PATH = "M -1.25 0.45 C -1.35 0.05 -0.7 -0.05 0.0 0.0 C 0.7 -0.05 1.5 0.0 1.45 0.55 C 1.4 1.3 1.0 1.7 0.55 1.98 C 0.0 1.75 -1.2 1.3 -1.25 0.45 Z";
const CHAMBERS: { id: string; cx: number; cy: number; rx: number; ry: number }[] = [
  { id: "rightAtrium", cx: -0.75, cy: 0.8, rx: 0.5, ry: 0.5 },
  { id: "leftAtrium", cx: 0.55, cy: 0.9, rx: 0.52, ry: 0.42 },
  { id: "rightVentricle", cx: 0, cy: 0, rx: 0, ry: 0 },
  { id: "leftVentricle", cx: 0, cy: 0, rx: 0, ry: 0 },
];
const WAVE_OF: Record<string, WaveKind | null> = Object.fromEntries(HEART_STRUCTURES.map((s) => [s.id, s.producesWave === "none" ? null : (s.producesWave as WaveKind)]));
const CONDUCTION = new Set(["saNode", "avNode", "hisBundle", "rightBundle", "leftBundle", "leftAnteriorFascicle", "leftPosteriorFascicle", "purkinje", "bachmann", "atrialPathways"]);
const LEFT_LABEL = new Set(["saNode", "rightBundle", "leftPosteriorFascicle", "purkinje"]);
const SHORT: Record<string, string> = { saNode: "SA", avNode: "AV", hisBundle: "His", rightBundle: "RBB", leftBundle: "LBB", leftAnteriorFascicle: "LAF", leftPosteriorFascicle: "LPF", purkinje: "Purkinje" };

type Frame = { act: Record<string, StructureActivity>; transits: { x: number; y: number }[]; blocked: { x: number; y: number }[] };

export function Heart2D() {
  const [frame, setFrame] = useState<Frame | null>(null);
  const { selectedStructure, selectStructure } = useEcgStore();
  const acc = useRef(0);
  useEffect(() => {
    return subscribeFrame((_, dt) => {
      acc.current += dt;
      if (acc.current < 33) return; // ~30 fps for the SVG
      acc.current = 0;
      const eng = getEngine(), t = getRunner().timeMs;
      const act = structureActivity(eng, t);
      const transits: { x: number; y: number }[] = [];
      for (const tr of activeTransits(eng, t)) {
        const a = NODE_POS[tr.from], b = NODE_POS[tr.to];
        if (!a || !b) continue;
        transits.push({ x: a.x + (b.x - a.x) * tr.progress, y: a.y + (b.y - a.y) * tr.progress });
      }
      const blocked: { x: number; y: number }[] = [];
      for (const id of blockedEdges(eng, t)) {
        const [f, to] = id.split("->");
        const a = NODE_POS[f], b = NODE_POS[to];
        if (a && b) blocked.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      setFrame({ act, transits, blocked });
    });
  }, []);

  const color = (id: string) => HEART_STRUCTURES.find((s) => s.id === id)!.color;
  const act = frame?.act ?? {};
  return (
    <svg className="heart2d" viewBox="-1.6 -1.7 3.2 3.75" role="group" aria-label="Interactive conduction system diagram" data-testid="heart-2d">
      {/* chambers: tinted by electrical activation, scaled by contraction */}
      <defs>
        <clipPath id="clipRV"><rect x={-2} y={0} width={2.02} height={3} /></clipPath>
        <clipPath id="clipLV"><rect x={0.02} y={0} width={2} height={3} /></clipPath>
      </defs>
      {CHAMBERS.map((c) => {
        const a = act[c.id];
        const sel = selectedStructure === c.id;
        const k = 1 - 0.1 * (a?.contraction ?? 0);
        const fill = color(c.id), fo = 0.08 + 0.6 * (a?.activation ?? 0);
        const common = { role: "button", tabIndex: 0, "aria-label": HEART_STRUCTURES.find((s) => s.id === c.id)!.label, className: "node", "data-testid": `structure-${c.id}`, fill, fillOpacity: fo, stroke: sel ? "#fff" : fill, strokeOpacity: sel ? 1 : 0.55, strokeWidth: sel ? 0.04 : 0.022, onClick: () => selectStructure(c.id, WAH(c.id)), onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && selectStructure(c.id, WAH(c.id)) };
        if (c.id === "rightAtrium" || c.id === "leftAtrium") {
          return <g key={c.id} transform={`translate(${c.cx} ${-c.cy}) scale(${k})`}><ellipse {...common} rx={c.rx} ry={c.ry} /></g>;
        }
        const left = c.id === "rightVentricle";
        return (
          <g key={c.id} transform={`translate(0.1 0.95) scale(${k}) translate(-0.1 -0.95)`}>
            <g clipPath={`url(#${left ? "clipRV" : "clipLV"})`}><path {...common} d={VENTRICLE_PATH} /></g>
          </g>
        );
      })}
      <line x1={0.02} y1={0.2} x2={0.02} y2={1.6} stroke="rgba(255,255,255,.18)" strokeWidth={0.03} strokeDasharray="0.06 0.05" />
      {/* conduction pathways */}
      {LINES.map(([a, b], i) => {
        const pa = P[a], pb = P[b];
        const live = Math.max(act[a]?.activation ?? 0, act[b]?.activation ?? 0);
        return <line key={i} x1={pa.x} y1={-pa.y} x2={pb.x} y2={-pb.y} stroke={live > 0.2 ? "#fbbf24" : "rgba(255,255,255,.28)"} strokeWidth={live > 0.2 ? 0.045 : 0.025} strokeLinecap="round" />;
      })}
      {/* structure nodes */}
      {HEART_STRUCTURES.map((s) => {
        const a = act[s.id];
        const sel = selectedStructure === s.id;
        const isChamber = CHAMBERS.some((c) => c.id === s.id);
        if (isChamber) return null;
        const r = CONDUCTION.has(s.id) ? 0.085 : 0.065;
        const live = a?.activation ?? 0;
        return (
          <g key={s.id} className="node" role="button" tabIndex={0} aria-label={s.label} data-testid={`structure-${s.id}`}
            onClick={() => selectStructure(s.id, WAH(s.id))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectStructure(s.id, WAH(s.id))}>
            <circle cx={P[s.id].x} cy={-P[s.id].y} r={0.19} fill="transparent" stroke="none" />
            {live > 0.05 ? <circle cx={P[s.id].x} cy={-P[s.id].y} r={r * 2.3} fill={s.color} fillOpacity={0.28 * live} stroke="none" /> : null}
            <circle cx={P[s.id].x} cy={-P[s.id].y} r={r + live * 0.04} fill={s.color} fillOpacity={0.35 + 0.65 * live} stroke={sel ? "#fff" : "rgba(255,255,255,.55)"} strokeWidth={sel ? 0.04 : 0.015} />
            {SHORT[s.id] ? <text x={P[s.id].x + (LEFT_LABEL.has(s.id) ? -0.15 : 0.15)} y={-P[s.id].y + 0.035} fontSize={0.1} fill="#dbe6f5" textAnchor={LEFT_LABEL.has(s.id) ? "end" : "start"} style={{ pointerEvents: "none", fontWeight: 600 }}>{SHORT[s.id]}</text> : null}
          </g>
        );
      })}
      {/* impulse in motion */}
      {frame?.transits.map((p, i) => <g key={i}><circle cx={p.x} cy={-p.y} r={0.13} fill="#fff" fillOpacity={0.22} /><circle cx={p.x} cy={-p.y} r={0.06} fill="#fff" opacity={0.95} /></g>)}
      {/* conduction block markers */}
      {frame?.blocked.map((p, i) => (
        <g key={i} stroke="#ff6b5e" strokeWidth={0.05} strokeLinecap="round"><line x1={p.x - 0.07} y1={-p.y - 0.07} x2={p.x + 0.07} y2={-p.y + 0.07} /><line x1={p.x - 0.07} y1={-p.y + 0.07} x2={p.x + 0.07} y2={-p.y - 0.07} /></g>
      ))}
    </svg>
  );
}
function WAH(id: string): WaveKind | null { return WAVE_OF[id] ?? null; }
