"use client";
import { useMemo } from "react";
import { WaveCanvas, drawLoop, drawNowCursor, drawSignal, drawTimeGrid, type DrawFn } from "@/components/sim/waveform";
import type { VentSample } from "@/sim/vent";
import { getEngine, getRunner, useVentStore } from "./store";

const COLORS = { paw: "#fbbf24", flow: "#7dd3fc", vol: "#c4b5fd", pmus: "#f472b6" };
const windowMsFor = (w: number) => (w < 520 ? 8000 : 12000);

function samplesFor(t: number, windowMs: number): VentSample[] {
  return getEngine().window(t - windowMs - 20, t);
}

type Channel = { key: "paw" | "flow" | "vol"; label: string; unit: string; color: string; range: [number, number]; step: number; get: (s: VentSample) => number };
export const CHANNELS: Record<Channel["key"], Channel> = {
  paw: { key: "paw", label: "Paw", unit: "cmH₂O", color: COLORS.paw, range: [-5, 45], step: 10, get: (s) => s.paw },
  flow: { key: "flow", label: "Flow", unit: "L/min", color: COLORS.flow, range: [-120, 120], step: 40, get: (s) => s.flow * 60 },
  vol: { key: "vol", label: "Volume", unit: "mL", color: COLORS.vol, range: [-50, 800], step: 200, get: (s) => s.volume * 1000 },
};

function makeDraw(ch: Channel, withPmus: boolean): DrawFn {
  return (ctx, w, h) => {
    const t = getRunner().timeMs;
    const windowMs = windowMsFor(w);
    const [lo, hi0] = ch.range;
    const data = samplesFor(t, windowMs);
    // auto-extend range upward if the data exceed it (e.g. high pressures)
    let hi = hi0;
    for (const s of data) hi = Math.max(hi, ch.get(s) * 1.08);
    const lo2 = ch.key === "flow" ? Math.min(lo, ...data.map((s) => ch.get(s) * 1.08)) : lo;
    const yOf0 = drawTimeGrid(ctx, w, h, windowMs, t, lo2, hi, ch.step);
    const t0 = t - windowMs;
    // phase shading: holds (one rectangle per contiguous hold)
    let runStart: number | null = null, runPhase = "";
    const flush = (endMs: number) => {
      if (runStart === null) return;
      const x1 = ((runStart - 5 - t0) / windowMs) * w, x2 = ((endMs - t0) / windowMs) * w;
      ctx.fillStyle = runPhase === "inspiratory_hold" ? "rgba(251,191,36,.10)" : "rgba(244,114,182,.10)";
      ctx.fillRect(x1, 0, Math.max(1, x2 - x1), h);
      runStart = null;
    };
    for (const s of data) {
      const isHold = s.phase === "inspiratory_hold" || s.phase === "expiratory_pause";
      if (isHold && (runStart === null || runPhase !== s.phase)) { flush(s.timeMs - 5); runStart = s.timeMs; runPhase = s.phase; }
      else if (!isHold) flush(s.timeMs - 5);
    }
    if (data.length) flush(data[data.length - 1].timeMs);
    const idx = (tt: number) => { // nearest sample (data are on the 5 ms grid)
      const i = Math.min(data.length - 1, Math.max(0, Math.round((tt - data[0].timeMs) / 5)));
      return data[i];
    };
    if (data.length) {
      if (withPmus) {
        let any = false; for (const s of data) if (s.pmus > 0.05) { any = true; break; }
        if (any) drawSignal(ctx, w, windowMs, t, (tt) => (data.length ? -idx(tt).pmus + 0 : null), (v) => yOf0(v), COLORS.pmus, 1.2, 2);
      }
      drawSignal(ctx, w, windowMs, t, (tt) => (tt < data[0].timeMs || tt > data[data.length - 1].timeMs ? null : ch.get(idx(tt))), yOf0, ch.color, 2.2, 1.5);
      // trigger / limit markers on the pressure trace
      if (ch.key === "paw") {
        ctx.font = "600 10px ui-monospace, monospace"; ctx.textAlign = "center";
        for (const s of data) {
          if (s.trigger === "patient") { const x = ((s.timeMs - t0) / windowMs) * w; ctx.fillStyle = "#47cd89"; ctx.fillText("▲ trig", x, h - 6); }
          if (s.pressureLimited) { const x = ((s.timeMs - t0) / windowMs) * w; ctx.fillStyle = "#ff6b5e"; ctx.fillText("▮", x, 12); }
        }
      }
    }
    drawNowCursor(ctx, w, h);
  };
}

export function VentWave({ channel, height = 120 }: { channel: Channel["key"]; height?: number }) {
  const ch = CHANNELS[channel];
  const withPmus = channel === "paw";
  const draw = useMemo(() => makeDraw(ch, withPmus), [ch, withPmus]);
  return <WaveCanvas testId={`wave-${channel}`} draw={draw} height={height} ariaLabel={`${ch.label} waveform, computed by the ventilator simulation`} tag={`${ch.label}`} tagColor={ch.color} tagRight={ch.unit} />;
}

export function Waveforms() {
  return (
    <div className="waves" data-testid="waveforms">
      <VentWave channel="paw" height={140} />
      <VentWave channel="flow" height={120} />
      <VentWave channel="vol" height={110} />
    </div>
  );
}

function loopDraw(kind: "pv" | "fv"): DrawFn {
  return (ctx, w, h) => {
    const e = getEngine();
    const last = e.samples.last();
    if (!last) return;
    // last complete breath + the current one
    const b = e.breaths[e.breaths.length - 1];
    const from = b ? b.startMs : last.timeMs - 4000;
    const pts = e.window(from, last.timeMs).map((s) => (kind === "pv" ? { x: s.paw, y: s.volume * 1000 } : { x: s.volume * 1000, y: s.flow * 60 }));
    if (kind === "pv") drawLoop(ctx, w, h, pts, [0, 45], [-20, 800], "#fbbf24", { x: "Paw cmH₂O", y: "V mL" });
    else drawLoop(ctx, w, h, pts, [-20, 800], [-120, 120], "#7dd3fc", { x: "V mL", y: "Flow L/min" });
  };
}

export function Loops() {
  const pv = useMemo(() => loopDraw("pv"), []);
  const fv = useMemo(() => loopDraw("fv"), []);
  useVentStore((s) => s.caseId);
  return (
    <div className="loops">
      <WaveCanvas testId="loop-pv" draw={pv} height={190} ariaLabel="Pressure–volume loop" tag="P–V loop" tagColor="#fbbf24" />
      <WaveCanvas testId="loop-fv" draw={fv} height={190} ariaLabel="Flow–volume loop" tag="Flow–V loop" tagColor="#7dd3fc" />
    </div>
  );
}
