"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, Disclaimer, Field, GlassCard, Segmented, Stat } from "@/components/sim/ui";
import { subscribeFrame } from "@/components/sim/waveform";
import { SIMULATION_SPEEDS, type SimulationSpeed } from "@/sim/core";
import { HEART_STRUCTURES, STRUCTURE_EDGES } from "@/sim/cardiac-ep";
import { describeAt, frontalQrsAxisDeg, measurementsAt } from "@/sim/ecg";
import { ECG_CONDITIONS } from "@/sim/content";
import { ECG_LEADS } from "@/sim/types";
import { getEngine, getRunner, useEcgStore, HEART_RHYTHMS, type WaveKind } from "./store";
import { installHeartSim } from "./heartApi";
import { useWebgl } from "@/components/sim3d/useWebgl";
import type { HeartScene } from "@/components/sim3d/heart/HeartScene";
import { heartVisual } from "@/sim/ecg";
import { RhythmStrip, TwelveLead } from "./Strips";
import { Heart2D } from "./Heart2D";
import { WAVE_COLORS } from "./waves";

const HeartView = dynamic(() => import("@/components/sim3d/HeartView"), { ssr: false, loading: () => <div className="sim3d-frame" data-testid="heart-3d" data-state="loading" /> });

function Ticker() {
  useEffect(() => {
    useEcgStore.getState().init();
    let acc = 0;
    return subscribeFrame((_, dt) => {
      getRunner().tick(dt);
      acc += dt;
      if (acc > 90) { acc = 0; useEcgStore.getState().syncUi(); }
    });
  }, []);
  return null;
}

const fmtTime = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

function Transport() {
  const { isPlaying, speed, uiTimeMs, horizonMs, toggle, stepBy, seek, setSpeed, restart } = useEcgStore();
  return (
    <GlassCard className="transport" blur>
      <button className="btn primary" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} data-testid="play-pause">{isPlaying ? "❚❚ Pause" : "▶ Play"}</button>
      <button className="btn" onClick={() => stepBy(-1)} aria-label="Step back 5 ms" title="Step back one 5 ms simulation step" data-testid="step-back">⏮</button>
      <button className="btn" onClick={() => stepBy(1)} aria-label="Step forward 5 ms" title="Step forward one 5 ms simulation step" data-testid="step-fwd">⏭</button>
      <button className="btn hide-sm" onClick={() => stepBy(20)} aria-label="Step forward 100 ms" title="+100 ms">+100 ms</button>
      <select className="btn" aria-label="Simulation speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value) as SimulationSpeed)} data-testid="speed">
        {SIMULATION_SPEEDS.map((s) => <option key={s} value={s} style={{ color: "#000" }}>{s}×</option>)}
      </select>
      <input className="scrub" type="range" min={0} max={Math.max(horizonMs, uiTimeMs, 1000)} step={5} value={uiTimeMs} aria-label="Scrub simulation time" data-testid="scrub" onChange={(e) => seek(Number(e.target.value))} />
      <span className="time tnum" data-testid="sim-time">{fmtTime(uiTimeMs)}</span>
      <button className="btn" onClick={restart} title="Reset to normal sinus rhythm">↺ Reset</button>
    </GlassCard>
  );
}

function ConditionPanel() {
  const { conditionId, custom, rate, avDelay, selectCondition, setRate, setAvDelay, rhythmId } = useEcgStore();
  const cond = ECG_CONDITIONS.find((c) => c.id === conditionId)!;
  const rhythm = rhythmId ? HEART_RHYTHMS.find((r) => r.id === rhythmId) : null;
  return (
    <GlassCard title="Condition">
      <div className="chips scroll" role="group" aria-label="Condition" style={{ marginBottom: 10 }}>
        {ECG_CONDITIONS.map((c) => <Chip key={c.id} pressed={conditionId === c.id && !custom && !rhythm} onClick={() => selectCondition(c.id)}>{c.name}</Chip>)}
      </div>
      <h3 data-testid="condition-name">{rhythm ? rhythm.label : custom ? `${cond.name} (modified)` : cond.name}</h3>
      <p className="cond-desc">{rhythm ? rhythm.note : cond.abnormalPhysiology === "None: this is the reference rhythm." ? cond.normalPhysiology : cond.abnormalPhysiology}</p>
      <Field id="rate" label="Sinus rate" value={rate} min={40} max={180} step={1} unit="/min" onChange={setRate} />
      <Field id="av" label="AV nodal delay" value={avDelay} min={40} max={320} step={2} unit="ms" onChange={setAvDelay} hint="Lengthening the AV delay lengthens the PR interval (first-degree block above ~108 ms of nodal delay in this model)." />
      <details>
        <summary>Expected findings, criteria and pitfalls</summary>
        <dl className="kv" style={{ marginTop: 6 }}>
          <dt>P</dt><dd>{cond.expectedWaveChanges.p}</dd><dt>PR</dt><dd>{cond.expectedWaveChanges.pr}</dd><dt>QRS</dt><dd>{cond.expectedWaveChanges.qrs}</dd>
          <dt>ST</dt><dd>{cond.expectedWaveChanges.st}</dd><dt>T</dt><dd>{cond.expectedWaveChanges.t}</dd>
        </dl>
        <p className="muted" style={{ marginTop: 8 }}>Criteria: {cond.diagnosticCriteria.join(" · ")}</p>
        <p className="muted">Pitfalls: {cond.commonPitfalls.join(" · ")}</p>
        <table className="table" aria-label="Lead-by-lead findings"><thead><tr><th>Lead</th><th>QRS</th><th>T</th><th>Note</th></tr></thead>
          <tbody>{cond.leadFindings.map((l) => <tr key={l.lead}><td>{l.lead}</td><td>{l.qrs ?? "—"}</td><td>{l.tWave ?? "—"}</td><td>{l.explanation}</td></tr>)}</tbody></table>
        <p className="faint" style={{ fontSize: 11.5 }}>Content status: {cond.validation.status}: not yet reviewed by a clinician.</p>
      </details>
    </GlassCard>
  );
}

function Measurements() {
  const t = useEcgStore((s) => s.uiTimeMs);
  const m = useMemo(() => {
    const eng = getEngine();
    const mm = measurementsAt(eng, t);
    if (!mm) return null;
    const axis = frontalQrsAxisDeg(eng, eng.beats[mm.beatIndex].ep);
    return { mm, axis };
  }, [t]);
  const f = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : v.toFixed(d));
  return (
    <GlassCard title="Measurements (computed from the simulated beat)">
      <div className="stats" data-testid="measurements">
        <Stat label="Heart rate" value={f(m?.mm.heartRateBpm)} unit="/min" testId="m-hr" />
        <Stat label="PR" value={f(m?.mm.prMs)} unit="ms" testId="m-pr" />
        <Stat label="QRS" value={f(m?.mm.qrsMs)} unit="ms" testId="m-qrs" />
        <Stat label="QT" value={f(m?.mm.qtMs)} unit="ms" testId="m-qt" />
        <Stat label="QTc Bazett" value={f(m?.mm.qtcBazettMs)} unit="ms" testId="m-qtc" />
        <Stat label="QRS axis" value={f(m?.axis)} unit="°" testId="m-axis" />
      </div>
      <p className="faint" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Intervals come from the model&apos;s activation events; the axis is the net QRS vector in leads I and aVF. QTc Fridericia: {f(m?.mm.qtcFridericiaMs)} ms.</p>
    </GlassCard>
  );
}

function Explain() {
  const t = useEcgStore((s) => s.uiTimeMs);
  const d = useMemo(() => describeAt(getEngine(), t), [t]);
  const color = d.segment === "P" ? WAVE_COLORS.P : d.segment === "PR segment" ? WAVE_COLORS["PR segment"] : d.segment === "QRS" ? WAVE_COLORS.QRS : d.segment === "T" ? WAVE_COLORS.T : "#9aa8bf";
  return (
    <GlassCard title="What is happening now">
      <div className="explain" data-testid="explain">
        <span className="seg-title" style={{ background: color + "26", color }} data-testid="explain-segment">{d.title}</span>
        <p><b>Electrical:</b> {d.electrical}</p>
        <p style={{ marginBottom: 0 }}><b>Mechanical:</b> {d.mechanical}</p>
      </div>
    </GlassCard>
  );
}

const WAVES: WaveKind[] = ["P", "PR segment", "QRS", "T"];
const WAVE_SOURCE: Record<WaveKind, string> = {
  P: "Atrial depolarisation: SA node → right atrium → Bachmann bundle → left atrium",
  "PR segment": "AV node delay and His–bundle conduction: too little tissue to show on the surface ECG",
  QRS: "Ventricular depolarisation: septum (left → right), then the free walls via Purkinje fibres, basal regions last",
  T: "Ventricular repolarisation: spreads epicardium → endocardium in this model",
};

const SCENE_TO_STRUCTURE: Record<string, string> = {
  SANode: "saNode", AVNode: "avNode", BundleOfHis: "hisBundle", RightBundleBranch: "rightBundle", LeftBundleBranch: "leftBundle",
  PurkinjeFibers: "purkinje", PurkinjeFibersRV: "purkinje", PurkinjeFibersLV: "purkinje", BachmannsBundle: "bachmann",
  InternodalTractAnterior: "atrialPathways", InternodalTractMiddle: "atrialPathways", InternodalTractPosterior: "atrialPathways",
  RightAtrium: "rightAtrium", LeftAtrium: "leftAtrium", RightVentricle: "rightVentricle", LeftVentricle: "leftVentricle",
};

function HeartControls({ scene }: { scene: HeartScene | null }) {
  const { rate, setRate, rhythmId, conditionId, custom, conduction3d, setConduction3d, labels3d, setLabels3d, isPlaying, toggle, manual, setManual, notice } = useEcgStore();
  const rhythmValue = rhythmId ?? (!custom && ["nsr", "lbbb", "rbbb"].includes(conditionId) ? conditionId : "nsr");
  const set = (k: "ra" | "la" | "rv" | "lv", v: number) => setManual({ ...(manual ?? { ra: 0, la: 0, rv: 0, lv: 0 }), [k]: v });
  return (
    <div className="heart-controls" data-testid="heart-controls">
      <div className="hc-row">
        <button className="btn primary" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} data-testid="heart-play">{isPlaying ? "❚❚ Pause" : "▶ Play"}</button>
        <label className="hc-select">Rhythm
          <select className="btn" value={rhythmValue} onChange={(e) => useEcgStore.getState().selectRhythm(e.target.value)} data-testid="heart-rhythm" aria-label="Rhythm">
            {HEART_RHYTHMS.map((r) => <option key={r.id} value={r.id} disabled={!r.supported} style={{ color: "#000" }}>{r.label}</option>)}
          </select>
        </label>
        <Chip pressed={conduction3d} onClick={() => setConduction3d(!conduction3d)} title="Show the conduction system overlay">Conduction</Chip>
        <Chip pressed={labels3d} onClick={() => setLabels3d(!labels3d)} title="Show labelled leader-line pins">Labels</Chip>
        <button className="btn" onClick={() => scene?.stage.controls.reset()} title="Reset camera">Reset view</button>
      </div>
      <Field id="hr" label="Heart rate (sinus)" value={rate} min={40} max={180} step={1} unit="bpm" onChange={setRate} />
      {notice ? <div className="info" role="status" data-testid="heart-notice">{notice}</div> : null}
      <details>
        <summary>Manual chamber override {manual ? <Chip tone="warn">active</Chip> : null}</summary>
        <p className="muted" style={{ margin: "4px 0 6px" }}>Sets chamber contraction by hand (0 = relaxed, 1 = fully contracted). While active the chambers do <b>not</b> follow the simulation; the ECG and conduction still do.</p>
        <div className="ctrl-grid">
          {(["ra", "la", "rv", "lv"] as const).map((k) => <Field key={k} id={`ov-${k}`} label={{ ra: "Right atrium", la: "Left atrium", rv: "Right ventricle", lv: "Left ventricle" }[k]} value={manual?.[k] ?? 0} min={0} max={1} step={0.05} onChange={(v) => set(k, v)} format={(v) => v.toFixed(2)} />)}
        </div>
        {manual ? <button className="btn" onClick={() => setManual(null)} data-testid="override-clear">Return to simulation</button> : null}
      </details>
    </div>
  );
}

function HeartPanel() {
  const { view, setView, selectedStructure, selectedWave, selectWave, toggleBlock, conduction3d, labels3d, manual } = useEcgStore();
  useEcgStore((st) => st.cfgVersion);
  const gl = useWebgl();
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<HeartScene | null>(null);
  const [scene, setScene] = useState<HeartScene | null>(null);
  const glOk = gl?.ok, glLow = gl?.low;
  useEffect(() => { if (glOk === false || glLow) useEcgStore.getState().setView("2d"); }, [glOk, glLow]);
  useEffect(() => installHeartSim(() => sceneRef.current), []);
  const s = HEART_STRUCTURES.find((x) => x.id === selectedStructure);
  const cfgBlocked = (() => {
    if (!s || !STRUCTURE_EDGES[s.id]) return false;
    const o = getEngine().config.edgeOverrides;
    return STRUCTURE_EDGES[s.id].every((e) => o[e]?.enabled === false);
  })();
  const can3d = !!gl?.ok && !failed;
  const show3d = view === "3d" && can3d;
  return (
    <GlassCard title="Heart and conduction system: tap a structure">
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Segmented label="Heart view" value={show3d ? "3d" : "2d"} options={[{ value: "2d", label: "2D schematic" }, ...(can3d ? [{ value: "3d" as const, label: "3D cutaway" }] : [])]} onChange={setView} />
        {manual ? <Chip tone="warn" title="Chamber contraction is user-set, not simulated">Manual override</Chip> : null}
      </div>
      {gl && !gl.ok ? <p className="faint" style={{ fontSize: 11.5, margin: "0 0 6px" }} data-testid="webgl-fallback">3D needs WebGL, which is not available here: showing the 2D schematic.</p> : null}
      {show3d ? (
        <>
          <HeartView
            getVisual={() => heartVisual(getEngine(), getRunner().timeMs)}
            getManual={() => useEcgStore.getState().manual}
            conduction={conduction3d}
            labels={labels3d}
            low={gl?.low}
            onUnavailable={() => setFailed(true)}
            onScene={(sc) => { sceneRef.current = sc; setScene(sc); }}
            onPick={(info) => { if (!info) { useEcgStore.getState().selectStructure(null); return; } const id = SCENE_TO_STRUCTURE[info.id]; const st = id ? HEART_STRUCTURES.find((x) => x.id === id) : undefined; useEcgStore.getState().selectStructure(id ?? null, st ? (st.producesWave === "none" ? null : (st.producesWave as WaveKind)) : null); }}
          />
          <HeartControls scene={scene} />
        </>
      ) : <Heart2D />}
      <p className="faint" style={{ fontSize: 11.5, margin: "6px 0 0" }}>{show3d ? "Schematic cutaway (anterior half removed), not to scale. Contraction, valves and the travelling conduction wave are driven by the simulated beat; contraction is exaggerated for visibility. Drag to rotate, scroll or pinch to zoom, tap a structure." : "Schematic, not to scale. Structures glow when activated; chambers shrink as they contract; the white dot is the impulse in motion; a red ✕ marks a blocked pathway."}</p>
      <div className="legend" role="group" aria-label="Wave legend: click to see which events produce each wave">
        {WAVES.map((w) => (
          <button key={w} type="button" className="wavechip" aria-pressed={selectedWave === w} onClick={() => selectWave(selectedWave === w ? null : w)} data-testid={`wave-${w === "PR segment" ? "PR" : w}`}>
            <i style={{ background: WAVE_COLORS[w] }} />{w === "PR segment" ? "PR" : w}
          </button>
        ))}
      </div>
      <div className="sel" style={{ marginTop: 8 }} data-testid="selection-info" aria-live="polite">
        {s ? (
          <>
            <b style={{ color: s.color }}>{s.label}</b>: {s.role}
            <div className="muted" style={{ marginTop: 4 }}>Produces on the ECG: <b>{s.producesWave === "none" ? "no visible wave (too little tissue)" : s.producesWave}</b></div>
            {STRUCTURE_EDGES[s.id] ? (
              <button className="btn" style={{ marginTop: 8 }} onClick={() => toggleBlock(s.id)} data-testid="toggle-block">{cfgBlocked ? "Restore conduction" : "Block conduction here"}</button>
            ) : null}
          </>
        ) : selectedWave ? (
          <><b style={{ color: WAVE_COLORS[selectedWave] }}>{selectedWave === "PR segment" ? "PR segment" : `${selectedWave} wave`}</b>: {WAVE_SOURCE[selectedWave]}. It is highlighted on the strips.</>
        ) : (
          <span className="muted">Tap the SA node, AV node, bundle branches, chambers… to see what each does and which wave it creates. Tap a wave chip to highlight it on the ECG.</span>
        )}
      </div>
    </GlassCard>
  );
}

function Toolbar() {
  const { gain, setGain, showLabels, setShowLabels } = useEcgStore();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Segmented label="Gain" value={String(gain) as "5" | "10" | "20"} options={[{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "20", label: "20 mm/mV" }]} onChange={(v) => setGain(Number(v) as 5 | 10 | 20)} />
      <Chip pressed={showLabels} onClick={() => setShowLabels(!showLabels)}>Wave labels</Chip>
    </div>
  );
}

export function EcgApp() {
  return (
    <div className="simos" data-testid="ecg-os">
      <Ticker />
      <div className="layout-wrap">
        <div className="osbar">
          <Chip tone="warn" title="The model is simplified and has not been reviewed by a clinician">Simplified educational model · not clinically validated</Chip>
        </div>
        <div className="layout">
          <div className="col">
            <div style={{ order: 1 }}>
              <GlassCard title="Lead II rhythm strip: tap any point to explain that moment">
                <RhythmStrip />
                <div style={{ marginTop: 8 }}><Toolbar /></div>
              </GlassCard>
            </div>
            <div style={{ order: 2 }}><Transport /></div>
            <div style={{ order: 3 }}><ConditionPanel /></div>
            <div style={{ order: 7 }}>
              <GlassCard title="12-lead ECG (each lead computed from the same heart-vector model)">
                <TwelveLead />
                <p className="faint" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Leads: {ECG_LEADS.join(", ")}. Limb leads obey Einthoven&apos;s law (II = I + III) and aVR + aVL + aVF = 0 because they are calculated, not drawn.</p>
              </GlassCard>
            </div>
          </div>
          <div className="col">
            <div style={{ order: 4 }}><HeartPanel /></div>
            <div style={{ order: 5 }}><Explain /></div>
            <div style={{ order: 6 }}><Measurements /></div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Disclaimer>Simplified educational model. Not clinically validated, not diagnostic and not for patient care. Waveforms are generated from a simplified equivalent-dipole model, so real ECG morphology will differ. Atrial fibrillation and ventricular tachycardia are not simulated yet (phase 2).</Disclaimer></div>
      </div>
    </div>
  );
}
