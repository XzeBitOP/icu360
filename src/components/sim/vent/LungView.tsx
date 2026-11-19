"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeFrame } from "@/components/sim/waveform";
import { OVERDISTENSION_PTP_CMH2O } from "@/sim/resp";
import { getEngine, useVentStore } from "./store";

const SHAPES: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  RUL: { cx: 115, cy: 150, rx: 74, ry: 58 }, RML: { cx: 132, cy: 236, rx: 58, ry: 38 }, RLL: { cx: 112, cy: 335, rx: 76, ry: 72 },
  LUL: { cx: 285, cy: 185, rx: 72, ry: 92 }, LLL: { cx: 288, cy: 342, rx: 72, ry: 66 },
};
const BRONCH: Record<string, [number, number]> = { RUL: [150, 120], RML: [165, 215], RLL: [160, 300], LUL: [250, 150], LLL: [240, 300] };

export type LobeView = { id: string; label: string; expansion: number; open: boolean; volMl: number; ptp: number; palv: number; conductance: number; over: boolean; excluded: boolean; aeration: number };

export function readLobes(): LobeView[] {
  const e = getEngine();
  const last = e.samples.last();
  const pmus = last?.pmus ?? 0;
  return e.compartments.map((c, i) => {
    const st = e.sys.state[i];
    const ptp = st.v / Math.max(e.sys.cL(i), 1e-6);
    return { id: c.id, label: c.label, expansion: e.sys.expansion(i), open: st.open, volMl: st.v * 1000, ptp, palv: e.sys.pAlv(i, pmus), conductance: c.conductanceFraction, over: ptp > OVERDISTENSION_PTP_CMH2O, excluded: !!c.excluded, aeration: e.sys.aeration(i) };
  });
}

export function LungView() {
  const [lobes, setLobes] = useState<LobeView[]>([]);
  const acc = useRef(0);
  const { selectedLobe, selectLobe } = useVentStore();
  useEffect(() => subscribeFrame((_, dt) => { acc.current += dt; if (acc.current < 33) return; acc.current = 0; setLobes(readLobes()); }), []);
  return (
    <svg className="lung" viewBox="0 0 400 440" role="group" aria-label="Lung model with five lobes" data-testid="lung-2d">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(154,168,191,.5)" strokeWidth="2" /></pattern>
      </defs>
      {/* airway tree: width ∝ conductance */}
      <path d="M200 6 L200 70" stroke="#7dd3fc" strokeOpacity=".7" strokeWidth="12" strokeLinecap="round" />
      <path d="M200 70 L150 100 M200 70 L250 100" stroke="#7dd3fc" strokeOpacity=".6" strokeWidth="8" strokeLinecap="round" />
      {lobes.map((l) => {
        const [bx, by] = BRONCH[l.id] ?? [200, 200];
        const from = bx < 200 ? [150, 100] : [250, 100];
        return <path key={`b${l.id}`} d={`M${from[0]} ${from[1]} L${bx} ${by}`} stroke="#7dd3fc" strokeOpacity={l.open ? 0.55 : 0.2} strokeWidth={2 + 22 * l.conductance} strokeLinecap="round" />;
      })}
      {lobes.map((l) => {
        const s = SHAPES[l.id]; if (!s) return null;
        const k = l.excluded ? 0.5 : l.open ? 0.45 + 0.95 * Math.min(l.expansion, 1.2) : 0.5;
        const sel = selectedLobe >= 0 && lobes[selectedLobe]?.id === l.id;
        const fill = !l.open || l.excluded ? "url(#hatch)" : l.over ? "#fb923c" : "#2dd4bf";
        const fo = !l.open ? 1 : 0.22 + 0.5 * Math.min(l.expansion, 1);
        return (
          <g key={l.id} transform={`translate(${s.cx} ${s.cy}) scale(${k}) translate(${-s.cx} ${-s.cy})`}>
            <ellipse className="lobe" role="button" tabIndex={0} aria-label={`${l.label} lobe, ${l.excluded ? "excluded from ventilation" : l.open ? "open" : "collapsed"}`} data-testid={`lobe-${l.id}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
              fill={fill} fillOpacity={fo} stroke={sel ? "#fff" : l.open ? "#5eead4" : "#9aa8bf"} strokeOpacity={sel ? 1 : 0.7} strokeWidth={sel ? 4 : 2} strokeDasharray={l.open ? undefined : "6 5"}
              onClick={() => selectLobe(lobes.indexOf(l))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectLobe(lobes.indexOf(l))} />
          </g>
        );
      })}
      {lobes.map((l) => { const s = SHAPES[l.id]; return s ? <text key={`t${l.id}`} x={s.cx} y={s.cy + 4} textAnchor="middle" fontSize="13" fontWeight="650" fill="#eaf2ff" style={{ pointerEvents: "none" }}>{l.id}</text> : null; })}
      <text x="10" y="430" fontSize="11" fill="#6b7890">Viewer’s left = patient’s right. Size follows regional volume; hatched = collapsed; orange = high transpulmonary pressure.</text>
    </svg>
  );
}

export function AlveolusView() {
  const [lobe, setLobe] = useState<LobeView | null>(null);
  const acc = useRef(0);
  const sel = useVentStore((s) => s.selectedLobe);
  useEffect(() => subscribeFrame((_, dt) => { acc.current += dt; if (acc.current < 50) return; acc.current = 0; setLobe(readLobes()[sel] ?? null); }), [sel]);
  if (!lobe) return null;
  const r = lobe.open ? 11 + 20 * Math.min(lobe.expansion, 1.25) : 6;
  const pts = [[0, 0], [1, 0], [-1, 0], [0.5, 0.87], [-0.5, 0.87], [0.5, -0.87], [-0.5, -0.87]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center" }} data-testid="alveolus-view">
      <svg viewBox="-75 -75 150 150" width="150" height="150" role="img" aria-label={`Alveoli of ${lobe.label}`}>
        {pts.map(([x, y], i) => (
          <ellipse key={i} cx={x * (r * 1.8)} cy={y * (r * 1.8)} rx={lobe.open ? r : r * 1.1} ry={lobe.open ? r : r * 0.45} fill={lobe.over ? "#fb923c" : lobe.open ? "#2dd4bf" : "#6b7890"} fillOpacity={lobe.open ? 0.4 : 0.6} stroke={lobe.over ? "#fdba74" : lobe.open ? "#5eead4" : "#9aa8bf"} strokeWidth="2" />
        ))}
      </svg>
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <b>{lobe.label}</b> {lobe.open ? "" : <span className="chip crit" style={{ padding: "2px 8px" }}>collapsed / closed</span>}
        <div className="muted mono">V above relaxed: {lobe.volMl.toFixed(0)} mL</div>
        <div className="muted mono">P alveolar: {lobe.palv.toFixed(1)} cmH₂O</div>
        <div className="muted mono">Transpulm. P: {lobe.ptp.toFixed(1)} cmH₂O</div>
        <div className="faint" style={{ fontSize: 11 }}>{lobe.over ? "Above the model’s overdistension flag (25 cmH₂O transpulmonary: educational threshold)." : "Click a region to inspect it."}</div>
      </div>
    </div>
  );
}
