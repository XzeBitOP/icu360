"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, Disclaimer, Field, GlassCard, Segmented, Stat } from "@/components/sim/ui";
import { subscribeFrame } from "@/components/sim/waveform";
import { SIMULATION_SPEEDS, type SimulationSpeed } from "@/sim/core";
import { MODE_DEFINITIONS, type BreathPhase, type BreathRecord } from "@/sim/vent";
import { computeGasExchange } from "@/sim/gas";
import { VENTILATOR_PRESETS } from "@/sim/content";
import { getEngine, getRunner, mechanicsEpoch, useVentStore } from "./store";
import { installLungSim } from "./lungApi";
import { useWebgl } from "@/components/sim3d/useWebgl";
import type { LungScene } from "@/components/sim3d/lung/LungScene";
import { LUNG_MODES, apiSettingsPatch, lungVisual } from "@/sim/vent";
import { LOBE_KEYS } from "@/sim/resp";
import { Loops, Waveforms } from "./Waves";
import { AlveolusView, LungView } from "./LungView";

const LungView3D = dynamic(() => import("@/components/sim3d/LungView3D"), { ssr: false, loading: () => <div className="sim3d-frame" data-testid="lung-3d" data-state="loading" /> });

function Ticker() {
  useEffect(() => {
    useVentStore.getState().init();
    let acc = 0;
    return subscribeFrame((_, dt) => {
      getRunner().tick(dt);
      acc += dt;
      if (acc > 90) { acc = 0; useVentStore.getState().syncUi(); }
    });
  }, []);
  return null;
}

const fmtTime = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const f = (v: number | null | undefined, d = 0) => { if (v === null || v === undefined || Number.isNaN(v)) return "—"; const x = Number(v.toFixed(d)); return (x === 0 ? 0 : x).toFixed(d); };

function Transport() {
  const { isPlaying, speed, uiTimeMs, horizonMs, toggle, stepBy, seek, setSpeed, restart } = useVentStore();
  return (
    <GlassCard className="transport" blur>
      <button className="btn primary" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} data-testid="play-pause">{isPlaying ? "❚❚ Pause" : "▶ Play"}</button>
      <button className="btn" onClick={() => stepBy(-1)} aria-label="Step back 5 ms" title="Step back one 5 ms step" data-testid="step-back">⏮</button>
      <button className="btn" onClick={() => stepBy(1)} aria-label="Step forward 5 ms" title="Step forward one 5 ms step" data-testid="step-fwd">⏭</button>
      <button className="btn hide-sm" onClick={() => stepBy(40)} title="+200 ms">+200 ms</button>
      <select className="btn" aria-label="Simulation speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value) as SimulationSpeed)} data-testid="speed">
        {SIMULATION_SPEEDS.map((s) => <option key={s} value={s} style={{ color: "#000" }}>{s}×</option>)}
      </select>
      <input className="scrub" type="range" min={0} max={Math.max(horizonMs, uiTimeMs, 1000)} step={5} value={uiTimeMs} aria-label="Scrub simulation time" data-testid="scrub" onChange={(e) => seek(Number(e.target.value))} />
      <span className="time tnum" data-testid="sim-time">{fmtTime(uiTimeMs)}</span>
      <button className="btn" onClick={restart} title="Reset to healthy adult, VC-A/C">↺ Reset</button>
    </GlassCard>
  );
}

const PHASE_TEXT: Record<BreathPhase, string> = {
  baseline: "Baseline at set PEEP.",
  trigger_detected: "A patient effort crossed the trigger threshold.",
  inspiration: "",
  inspiratory_hold: "Inspiratory hold: the valves are closed and flow is zero. Pressure falls from peak to the plateau, which reflects the elastic recoil of the lungs and chest wall at end-inspiration (valid only in a passive patient).",
  expiration: "Expiration is passive: the exhalation valve opens to PEEP and the elastic recoil drives gas out. Flow decays exponentially with time constant τ = R × C.",
  expiratory_pause: "Expiratory hold: flow is zero, so airway pressure equilibrates with alveolar pressure. If it rises above set PEEP the difference is auto-PEEP.",
  apnea_backup: "Apnoea backup breath.",
};

function Live() {
  const t = useVentStore((s) => s.uiTimeMs);
  const { settings } = useVentStore();
  const last = getEngine().samples.last(); // eslint-disable-line react-hooks/exhaustive-deps -- re-read on every UI tick (t)
  void t;
  const phase = last?.phase ?? "baseline";
  return (
    <div className="live" data-testid="live" aria-live="off">
      <div><b className="tnum" style={{ color: "#fbbf24" }}>{f(last?.paw, 1)}</b><span>Paw cmH₂O</span></div>
      <div><b className="tnum" style={{ color: "#7dd3fc" }}>{f(last ? last.flow * 60 : undefined, 0)}</b><span>Flow L/min</span></div>
      <div><b className="tnum" style={{ color: "#c4b5fd" }}>{f(last ? last.volume * 1000 : undefined, 0)}</b><span>Vol mL</span></div>
      <div><b style={{ fontSize: 12, lineHeight: "22px" }} data-testid="phase">{phase.replace("_", " ")}</b><span>{settings.mode}</span></div>
    </div>
  );
}

function Explain() {
  const t = useVentStore((s) => s.uiTimeMs);
  const tq100 = Math.floor(t / 100);
  const { settings } = useVentStore();
  const text = useMemo(() => {
    const e = getEngine();
    const phase = e.samples.last()?.phase ?? "baseline";
    if (phase === "inspiration") {
      return settings.mode === "VC-A/C"
        ? `Volume control: the ventilator delivers a set flow (${settings.flowPattern === "square" ? "constant" : "decelerating"}, ${settings.inspFlowLpm} L/min) until ${settings.vtMl} mL has been delivered. Volume is the target; pressure is the consequence: a resistive step at the start of flow plus a ramp as the lungs fill (V/C).`
        : `Pressure control: the ventilator holds airway pressure at PEEP + ${settings.pInspCmH2O} cmH₂O for ${settings.tiSec.toFixed(1)} s. Pressure is the target; flow starts high and decays as the lungs fill, so the delivered volume depends on compliance and resistance.`;
    }
    return PHASE_TEXT[phase];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tq100, settings.mode, settings.vtMl, settings.flowPattern, settings.inspFlowLpm, settings.pInspCmH2O, settings.tiSec]);
  const m = MODE_DEFINITIONS[settings.mode];
  return (
    <GlassCard title="What is happening now">
      <div className="explain" data-testid="explain"><p style={{ marginBottom: 6 }}>{text}</p></div>
      <dl className="kv" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 12.5, margin: 0 }}>
        <dt className="faint">Trigger</dt><dd style={{ margin: 0 }}>{m.trigger.description}</dd>
        <dt className="faint">Control</dt><dd style={{ margin: 0 }}>{m.control.description}</dd>
        <dt className="faint">Limit</dt><dd style={{ margin: 0 }}>{m.limit.description}</dd>
        <dt className="faint">Cycle</dt><dd style={{ margin: 0 }}>{m.cycle.description}</dd>
      </dl>
    </GlassCard>
  );
}

function Controls() {
  const { settings, patient, caseId, setSettings, setPatient, loadCase } = useVentStore();
  const preset = VENTILATOR_PRESETS[caseId];
  const vc = settings.mode === "VC-A/C";
  return (
    <GlassCard title="Ventilator and patient">
      <div className="chips scroll" role="group" aria-label="Patient case" style={{ marginBottom: 10 }}>
        {Object.values(VENTILATOR_PRESETS).map((p) => <Chip key={p.case.id} pressed={caseId === p.case.id} onClick={() => loadCase(p.case.id)} title={p.case.diagnosis}>{p.case.name.replace(/ \(.*\)/, "")}</Chip>)}
      </div>
      <p className="sub" style={{ marginTop: 0, marginBottom: 8 }}>{preset.changedParameters[0]}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Segmented label="Mode" value={settings.mode} options={[{ value: "VC-A/C", label: "VC-A/C" }, { value: "PC-A/C", label: "PC-A/C" }]} onChange={(mode) => useVentStore.getState().setMode(mode)} />
        {vc ? <Segmented label="Flow pattern" value={settings.flowPattern} options={[{ value: "square", label: "Square" }, { value: "decelerating", label: "Decelerating" }]} onChange={(flowPattern) => setSettings({ flowPattern })} /> : null}
      </div>
      <div className="ctrl-grid">
        {vc ? <Field id="vt" label="Tidal volume" value={settings.vtMl} min={200} max={800} step={10} unit="mL" onChange={(v) => setSettings({ vtMl: v })} hint={`${(settings.vtMl / patient.predictedBodyWeightKg).toFixed(1)} mL/kg predicted body weight (${patient.predictedBodyWeightKg.toFixed(0)} kg)`} /> : <Field id="pinsp" label="Inspiratory pressure above PEEP" value={settings.pInspCmH2O} min={4} max={30} step={1} unit="cmH₂O" onChange={(v) => setSettings({ pInspCmH2O: v })} />}
        <Field id="rr" label="Set rate" value={settings.rr} min={6} max={35} step={1} unit="/min" onChange={(v) => setSettings({ rr: v })} />
        <Field id="peep" label="PEEP" value={settings.peepCmH2O} min={0} max={20} step={1} unit="cmH₂O" onChange={(v) => setSettings({ peepCmH2O: v })} />
        <Field id="fio2" label="FiO₂" value={settings.fio2} min={0.21} max={1} step={0.01} onChange={(v) => setSettings({ fio2: v })} format={(v) => v.toFixed(2)} />
        {vc ? <Field id="flow" label="Inspiratory flow" value={settings.inspFlowLpm} min={30} max={120} step={5} unit="L/min" onChange={(v) => setSettings({ inspFlowLpm: v })} hint={`Ti ≈ ${(settings.vtMl / 1000 / (settings.inspFlowLpm / 60) * (settings.flowPattern === "decelerating" ? 2 : 1)).toFixed(2)} s`} /> : <Field id="ti" label="Inspiratory time" value={settings.tiSec} min={0.3} max={2.5} step={0.1} unit="s" onChange={(v) => setSettings({ tiSec: v })} />}
        <Field id="limit" label="High-pressure limit" value={settings.pressureLimitCmH2O} min={15} max={60} step={1} unit="cmH₂O" onChange={(v) => setSettings({ pressureLimitCmH2O: v })} />
      </div>
      <details style={{ marginTop: 6 }} open>
        <summary>Patient mechanics</summary>
        <div className="ctrl-grid">
          <Field id="cl" label="Lung compliance" value={patient.complianceLPerCmH2O} min={0.03} max={0.3} step={0.005} unit="L/cmH₂O" format={(v) => v.toFixed(3)} onChange={(v) => setPatient({ complianceLPerCmH2O: v })} hint="Whole respiratory system C is lower because the chest wall is in series." />
          <Field id="raw" label="Airway resistance (central + tube)" value={patient.airwayResistanceCmH2OPerLPerSec} min={2} max={30} step={0.5} unit="cmH₂O/L/s" onChange={(v) => setPatient({ airwayResistanceCmH2OPerLPerSec: v })} />
          <Field id="pmus" label="Patient inspiratory effort" value={patient.musclePressureAmplitudeCmH2O} min={0} max={15} step={0.5} unit="cmH₂O" onChange={(v) => setPatient({ musclePressureAmplitudeCmH2O: v })} hint="0 = passive, sedated. Effort is added to the equation of motion." />
          <Field id="srate" label="Spontaneous effort rate" value={patient.spontaneousRateBpm} min={8} max={35} step={1} unit="/min" onChange={(v) => setPatient({ spontaneousRateBpm: v })} />
        </div>
      </details>
      <details style={{ marginTop: 6 }}>
        <summary>Trigger and pause</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0" }}>
          <Segmented label="Trigger type" value={settings.triggerType} options={[{ value: "flow", label: "Flow" }, { value: "pressure", label: "Pressure" }]} onChange={(triggerType) => setSettings({ triggerType })} />
          <Chip pressed={settings.inspPauseSec > 0} onClick={() => setSettings({ inspPauseSec: settings.inspPauseSec > 0 ? 0 : 0.5 })}>Routine insp. pause 0.5 s</Chip>
        </div>
        <div className="ctrl-grid">
          {settings.triggerType === "flow" ? <Field id="ftrig" label="Flow trigger" value={settings.flowTriggerLpm} min={1} max={30} step={0.5} unit="L/min" onChange={(v) => setSettings({ flowTriggerLpm: v })} /> : <Field id="ptrig" label="Pressure trigger" value={settings.pressureTriggerCmH2O} min={0.5} max={10} step={0.5} unit="cmH₂O" onChange={(v) => setSettings({ pressureTriggerCmH2O: v })} />}
        </div>
      </details>
      <div className="holds">
        <button className="btn" onClick={() => useVentStore.getState().hold("insp")} data-testid="hold-insp" title="Closes the valves for 0.5 s at the end of the next inspiration">Inspiratory hold</button>
        <button className="btn" onClick={() => useVentStore.getState().hold("exp")} data-testid="hold-exp" title="Delays the next breath for 2 s at end-expiration">Expiratory hold</button>
        <button className="btn" onClick={() => useVentStore.getState().manualBreath()}>Manual breath</button>
      </div>
    </GlassCard>
  );
}

function lastValidPlateau(breaths: BreathRecord[], epoch: number): { b: BreathRecord; ago: number } | null {
  for (let i = breaths.length - 1; i >= epoch && i >= breaths.length - 40; i--) if (breaths[i].pplat.valid) return { b: breaths[i], ago: breaths.length - 1 - i };
  return null;
}

function Measurements() {
  const t = useVentStore((s) => s.uiTimeMs);
  const tq250 = Math.floor(t / 250);
  const d = useMemo(() => {
    const e = getEngine();
    const b = e.breaths[e.breaths.length - 1];
    const ep = mechanicsEpoch();
    const fresh = e.breaths.slice(ep);
    const pv = lastValidPlateau(e.breaths, ep);
    const held = [...fresh].reverse().slice(0, 40).find((x) => x.peepTotal.valid);
    return { b, pv, held, alarm: e.alarm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tq250]);
  const { b, pv } = d;
  if (!b) return <GlassCard title="Measurements"><p className="muted">Waiting for the first completed breath…</p></GlassCard>;
  const vcMode = b.mode === "VC-A/C";
  const pp = pv?.b;
  const platNote = pv ? (pv.ago === 0 ? "this breath (valid hold)" : `breath #${pv.b.index} · ${pv.ago} breath${pv.ago === 1 ? "" : "s"} ago`) : (b.pplat.reason ?? "needs an inspiratory hold");
  const flags: string[] = [];
  if (pp?.pplat.value && pp.pplat.value > 30) flags.push(`Pplat ${pp.pplat.value.toFixed(0)} cmH₂O is above the commonly taught 30 cmH₂O limit.`);
  if (pp?.drivingPressure.value && pp.drivingPressure.value > 15) flags.push(`Driving pressure ${pp.drivingPressure.value.toFixed(0)} cmH₂O is above the commonly taught 15 cmH₂O.`);
  if (b.vtPerPbwMlPerKg > 8) flags.push(`VT ${b.vtPerPbwMlPerKg.toFixed(1)} mL/kg PBW is above the commonly taught 6–8 mL/kg.`);
  return (
    <GlassCard title={`Measurements · breath #${b.index} (${b.triggeredBy === "patient" ? "patient-triggered" : "time-triggered"})`}>
      <div className="stats" data-testid="measurements">
        <Stat label="Ppeak" value={f(b.ppeak, 1)} unit="cmH₂O" testId="m-ppeak" />
        <Stat label="Pplat" value={f(pp?.pplat.value, 1)} unit="cmH₂O" invalid={!pp} note={platNote} testId="m-pplat" />
        <Stat label="PEEP set / total" value={`${b.peepSet}${d.held?.peepTotal.valid ? " / " + f(d.held.peepTotal.value, 1) : ""}`} unit="cmH₂O" note={d.held ? `total from exp. hold, breath #${d.held.index}` : "total PEEP needs an exp. hold"} testId="m-peep" flag={!!d.held && (d.held.peepTotal.value ?? 0) > d.held.peepSet + 1} />
        <Stat label="Driving pressure" value={f(pp?.drivingPressure.value, 1)} unit="cmH₂O" invalid={!pp} note={pp?.drivingPressure.basis ?? "needs Pplat"} testId="m-dp" />
        <Stat label="C static" value={f(pp?.staticCompliance.value ? pp.staticCompliance.value * 1000 : null, 0)} unit="mL/cmH₂O" invalid={!pp} note={pp ? "VT / (Pplat − PEEP)" : "needs Pplat"} testId="m-cstat" />
        <Stat label="C dynamic" value={f(b.dynamicCompliance.value ? b.dynamicCompliance.value * 1000 : null, 0)} unit="mL/cmH₂O" invalid={!b.dynamicCompliance.valid} note="VT / (Ppeak − PEEP)" testId="m-cdyn" />
        <Stat label="Resistance" value={f(pp?.resistance.value, 1)} unit="cmH₂O/L/s" invalid={!pp?.resistance.valid} note={pp?.resistance.valid ? "square flow, from hold" : (pp?.resistance.reason ?? "needs hold + square flow")} testId="m-raw" />
        <Stat label="VTi / VTe" value={`${f(b.vtiL * 1000, 0)} / ${f(b.vteL * 1000, 0)}`} unit="mL" testId="m-vt" />
        <Stat label="VT / PBW" value={f(b.vtPerPbwMlPerKg, 1)} unit="mL/kg" testId="m-vtpbw" />
        <Stat label="Minute vent." value={f(b.mvLPerMin, 1)} unit="L/min" testId="m-mv" />
        <Stat label="Rate (measured)" value={f(b.rrMeasured, 0)} unit="/min" />
        <Stat label="I : E" value={`1 : ${f(b.ieRatio, 1)}`} note={`Ti ${b.tiSec.toFixed(2)} s · Te ${b.teSec.toFixed(2)} s`} />
        <Stat label="Exp. τ" value={f(b.expiratoryTimeConstantSec.value, 2)} unit="s" invalid={!b.expiratoryTimeConstantSec.valid} note={b.expiratoryTimeConstantSec.valid ? "from expiratory flow decay" : b.expiratoryTimeConstantSec.reason} testId="m-tau" />
        <Stat label="Mean Paw" value={f(b.meanPaw, 1)} unit="cmH₂O" />
        <Stat label="End-exp. flow" value={f(b.endExpFlowLps * 60, 0)} unit="L/min" flag={b.incompleteExpiration} note={b.incompleteExpiration ? "not zero: incomplete expiration" : "reached zero"} testId="m-eef" />
      </div>
      {b.incompleteExpiration ? <div className="info" data-testid="auto-peep-note">Expiratory flow had not returned to zero when the next breath started (gas trapping). {b.endExpVolumeL > 0.01 ? `Trapped volume ≈ ${(b.endExpVolumeL * 1000).toFixed(0)} mL above the set-PEEP baseline. ` : ""}Use an expiratory hold in a passive patient to measure total PEEP.</div> : null}
      {d.alarm ? <div className="alarm" role="alert">{d.alarm}</div> : null}
      {flags.map((x) => <div className="info" key={x} style={{ background: "rgba(253,176,34,.08)", borderColor: "rgba(253,176,34,.35)", color: "#f6d58c" }}>{x}</div>)}
      <p className="sub">{vcMode ? "VC" : "PC"} values are computed from the sampled waveforms of this breath. Values that need a hold are not shown without one, and a hold during patient effort is flagged as invalid. Thresholds are common teaching values, not validated limits.</p>
    </GlassCard>
  );
}

function Gas() {
  const t = useVentStore((s) => s.uiTimeMs);
  const tq1000 = Math.floor(t / 1000);
  const { settings, patient } = useVentStore();
  const g = useMemo(() => {
    const e = getEngine();
    const b = e.breaths[e.breaths.length - 1];
    return computeGasExchange({ fio2: settings.fio2, rr: b?.rrMeasured || settings.rr, vtL: b ? b.vteL : settings.vtMl / 1000, deadSpaceL: patient.deadSpaceL, shuntFraction: patient.shuntFraction });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tq1000, settings.fio2, settings.rr, settings.vtMl, patient.deadSpaceL, patient.shuntFraction]);
  return (
    <GlassCard title="Gas exchange (directional trend)">
      <div className="stats" data-testid="gas">
        <Stat label="PaCO₂" value={f(g.paco2MmHg, 0)} unit="mmHg" testId="g-paco2" />
        <Stat label="PaO₂" value={f(g.pao2MmHg, 0)} unit="mmHg" testId="g-pao2" />
        <Stat label="SpO₂" value={f(g.spo2Percent, 0)} unit="%" />
        <Stat label="pH" value={f(g.ph, 2)} />
        <Stat label="P/F ratio" value={f(g.pfRatio, 0)} />
        <Stat label="Dead space / VT" value={f(g.deadSpaceFraction * 100, 0)} unit="%" note={`shunt ${(g.shuntFraction * 100).toFixed(0)} %`} />
      </div>
      <p className="sub">Simple steady-state model (fixed VCO₂ and one shunt fraction); it shows direction, not a prediction. Halve ventilation and PaCO₂ rises; raise shunt and FiO₂ helps less.</p>
    </GlassCard>
  );
}

const IE_OPTIONS = ["1:1", "1:1.5", "1:2", "1:3", "1:4"];
const LOBE_LABELS: Record<string, string> = { RUL: "Right upper", RML: "Right middle", RLL: "Right lower", LUL: "Left upper", LLL: "Left lower" };

function ieOf(settings: { rr: number; tiSec: number }) {
  const te = 60 / settings.rr - settings.tiSec;
  return te > 0 ? settings.tiSec / te : 1;
}

function LungControls({ scene }: { scene: LungScene | null }) {
  const { lungMode, applyLungMode, labels3d, setLabels3d, settings, lobes, setLobeAeration, toggle, isPlaying } = useVentStore();
  const mode = LUNG_MODES.find((m) => m.id === lungMode);
  const ieNow = ieOf(settings);
  const nearest = IE_OPTIONS.reduce((best, o) => { const r = parseFloat(o.split(":")[1]); return Math.abs(1 / r - ieNow) < Math.abs(1 / parseFloat(best.split(":")[1]) - ieNow) ? o : best; }, IE_OPTIONS[0]);
  return (
    <div className="heart-controls" data-testid="lung-controls">
      <div className="hc-row">
        <button className="btn primary" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"} data-testid="lung-play">{isPlaying ? "❚❚ Pause" : "▶ Play"}</button>
        <label className="hc-select wide">Scenario
          <select className="btn" value={lungMode ?? ""} onChange={(e) => e.target.value && applyLungMode(e.target.value as never)} data-testid="lung-mode" aria-label="Lung scenario">
            {lungMode === null ? <option value="" style={{ color: "#000" }}>Custom</option> : null}
            {LUNG_MODES.map((m) => <option key={m.id} value={m.id} style={{ color: "#000" }}>{m.label}</option>)}
          </select>
        </label>
        <label className="hc-select">I:E
          <select className="btn" value={nearest} onChange={(e) => { const p = apiSettingsPatch({ ieRatio: e.target.value }, getEngine().settings); useVentStore.getState().setSettings(p); }} data-testid="lung-ie" aria-label="Inspiratory to expiratory ratio">
            {IE_OPTIONS.map((o) => <option key={o} value={o} style={{ color: "#000" }}>{o}</option>)}
          </select>
        </label>
        <Chip pressed={labels3d} onClick={() => setLabels3d(!labels3d)} title="Show labelled leader-line pins">Labels</Chip>
        <button className="btn" onClick={() => scene?.stage.controls.reset()} title="Reset camera">Reset view</button>
      </div>
      {mode ? <p className="sub" style={{ margin: 0 }} data-testid="lung-mode-note">{mode.note}</p> : <p className="sub" style={{ margin: 0 }}>Custom lobe aeration set by hand.</p>}
      <details>
        <summary>Lobe aeration (per-lobe collapse) {lobes.some((l) => l.aeration < 0.99 || l.excluded) ? <Chip tone="warn">modified</Chip> : null}</summary>
        <p className="muted" style={{ margin: "4px 0 6px" }}>1 = normal, lower = collapsed (less compliant, more shunt). Excluded lobes receive no ventilation (one-lung ventilation).</p>
        <div className="ctrl-grid">
          {lobes.map((l) => (
            <Field key={l.id} id={`aer-${l.id}`} label={`${LOBE_LABELS[l.id] ?? l.id}${l.excluded ? " (excluded)" : ""}`} value={l.aeration} min={0.05} max={1} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => setLobeAeration({ [LOBE_KEYS[l.id as keyof typeof LOBE_KEYS]]: v })} />
          ))}
        </div>
      </details>
    </div>
  );
}

function Lung3DReadout() {
  const t = useVentStore((s) => s.uiTimeMs);
  const d = lungVisual(getEngine()); // re-read on every UI tick (t)
  void t;
  return (
    <p className="faint mono" style={{ fontSize: 11.5, margin: "6px 0 0" }} data-testid="lung-readout">
      Paw {d.paw.toFixed(1)} cmH₂O · flow {(d.flowLps * 60).toFixed(0)} L/min · volume {(d.volumeL * 1000).toFixed(0)} mL · {d.phase.replace(/_/g, " ")} · recruited {(d.recruited * 100).toFixed(0)} %
    </p>
  );
}

function LungPanel() {
  const { lung3d, setLung3d, labels3d } = useVentStore();
  const gl = useWebgl();
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<LungScene | null>(null);
  const [scene, setScene] = useState<LungScene | null>(null);
  const [pick, setPick] = useState<{ name: string; physiology: string } | null>(null);
  const glOk = gl?.ok, glLow = gl?.low;
  useEffect(() => { if (glOk === false || glLow) useVentStore.getState().setLung3d(false); }, [glOk, glLow]);
  useEffect(() => installLungSim(() => sceneRef.current), []);
  const can3d = !!gl?.ok && !failed;
  const show3d = lung3d && can3d;
  return (
    <GlassCard title="Lungs: regional behaviour">
      <div style={{ marginBottom: 8 }}>
        <Segmented label="Lung view" value={show3d ? "3d" : "2d"} options={[{ value: "2d", label: "2D" }, ...(can3d ? [{ value: "3d" as const, label: "3D" }] : [])]} onChange={(v) => setLung3d(v === "3d")} />
      </div>
      {gl && !gl.ok ? <p className="faint" style={{ fontSize: 11.5, margin: "0 0 6px" }} data-testid="webgl-fallback">3D needs WebGL, which is not available here: showing the 2D lung model.</p> : null}
      {show3d ? (
        <>
          <LungView3D
            getVisual={() => lungVisual(getEngine())}
            getSettings={() => ({ fio2: getEngine().settings.fio2, peepCmH2O: getEngine().settings.peepCmH2O })}
            labels={labels3d}
            low={gl?.low}
            onUnavailable={() => setFailed(true)}
            onScene={(sc) => { sceneRef.current = sc; setScene(sc); }}
            onPick={(i) => setPick(i ? { name: i.name, physiology: i.physiology } : null)}
          />
          <Lung3DReadout />
          <LungControls scene={scene} />
          <div className="sel" style={{ marginTop: 8 }} data-testid="lung-selection" aria-live="polite">
            {pick ? <><b>{pick.name}</b>: {pick.physiology}</> : <span className="muted">Tap a lobe, the airway, alveoli or the diaphragm. Lung size and diaphragm motion are exaggerated about threefold so the breathing is visible; the volumes shown above are the real model values.</span>}
          </div>
        </>
      ) : <><LungView /><LungControls scene={null} /></>}
      <AlveolusView />
    </GlassCard>
  );
}

export function VentApp() {
  const { settings } = useVentStore();
  return (
    <div className="simos" data-testid="ventilator-os">
      <Ticker />
      <div className="layout-wrap">
        <div className="osbar">
          <Chip>{settings.mode}</Chip>
          <Chip tone="warn" title="The model is simplified and has not been reviewed by a clinician">Simplified educational model · not clinically validated</Chip>
        </div>
        <div className="layout">
          <div className="col">
            <div style={{ order: 1 }}>
              <GlassCard title="Waveforms (computed from the lung model)">
                <Live />
                <div style={{ marginTop: 8 }}><Waveforms /></div>
                <p className="sub">Pink line on the pressure trace = patient effort (−Pmus). ▲ trig = patient-triggered breath. Shaded = hold.</p>
              </GlassCard>
            </div>
            <div style={{ order: 2 }}><Transport /></div>
            <div style={{ order: 5 }}><Controls /></div>
            <div style={{ order: 8 }}><GlassCard title="Loops (current breath)"><Loops /></GlassCard></div>
          </div>
          <div className="col">
            <div style={{ order: 3 }}><LungPanel /></div>
            <div style={{ order: 4 }}><Measurements /></div>
            <div style={{ order: 6 }}><Explain /></div>
            <div style={{ order: 7 }}><Gas /></div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Disclaimer>Simplified educational model. Not clinically validated, not for patient care or for setting a real ventilator. Presets are illustrative. Lung size and diaphragm movement in 3D are exaggerated for visibility.</Disclaimer></div>
      </div>
    </div>
  );
}
