"use client";
import { useMemo } from "react";
import { WaveCanvas, drawEcgPaper, drawNowCursor, drawSignal, type DrawFn } from "@/components/sim/waveform";
import { ECG_LEADS } from "@/sim/types";
import { getEngine, getRunner, useEcgStore } from "./store";
import { beatBands, WAVE_COLORS, WAVE_LABEL } from "./waves";

const ECG_COLOR = "#5eead4";

function makeDraw(leadIndex: number, targetPxPerMm: number, withLabels: boolean): DrawFn {
  return (ctx, w, h) => {
    const t = getRunner().timeMs;
    const eng = getEngine();
    const { gain, selectedWave, showLabels } = useEcgStore.getState();
    const windowMs = w / (targetPxPerMm * 0.025);
    const pxPerMm = drawEcgPaper(ctx, w, h, windowMs, t);
    const yOf = (v: number) => h / 2 - v * pxPerMm * gain;
    const t0 = t - windowMs;
    // wave bands from the engine's beats (newest first, stop when out of the window)
    if (selectedWave || (withLabels && showLabels)) {
      for (let i = eng.beats.length - 1; i >= 0; i--) {
        const ep = eng.beats[i].ep;
        if (ep.fiducials.pEndMs < t0 - 600) break;
        if (ep.fiducials.pOnsetMs > t) continue;
        for (const band of beatBands(ep)) {
          if (band.to < t0 || band.from > t) continue;
          const on = selectedWave === band.kind;
          if (selectedWave && !on) continue;
          const x1 = ((band.from - t0) / windowMs) * w, x2 = Math.min(((band.to - t0) / windowMs) * w, w);
          ctx.fillStyle = WAVE_COLORS[band.kind] + (on ? "44" : "16");
          ctx.fillRect(x1, 0, Math.max(1, x2 - x1), h);
          if (withLabels && (on || showLabels) && band.kind !== "PR segment" && x2 - x1 > 6) {
            ctx.fillStyle = WAVE_COLORS[band.kind]; ctx.font = "600 10px ui-monospace, monospace"; ctx.textAlign = "center";
            ctx.fillText(WAVE_LABEL[band.kind], (x1 + x2) / 2, h - 6);
          }
        }
      }
    }
    drawSignal(ctx, w, windowMs, t, (tt) => eng.leadAt(leadIndex, tt), yOf, ECG_COLOR, withLabels ? 2.2 : 1.6, 1.25);
    // 1 mV calibration pulse
    if (withLabels) {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.beginPath();
      const y0 = h / 2 + 0, y1 = yOf(1), x0 = 8;
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + 2, y0); ctx.lineTo(x0 + 2, y1); ctx.lineTo(x0 + 2 + pxPerMm * 5, y1); ctx.lineTo(x0 + 2 + pxPerMm * 5, y0); ctx.lineTo(x0 + 6 + pxPerMm * 5, y0); ctx.stroke();
      ctx.fillStyle = "rgba(154,168,191,.8)"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "left";
      ctx.fillText(`25 mm/s · ${gain} mm/mV`, 8, 14 + 14);
    }
    drawNowCursor(ctx, w, h);
  };
}

export function RhythmStrip() {
  const draw = useMemo(() => makeDraw(1, 4, true), []);
  // Milestone-1 criterion: selecting any ECG point explains the electrical event and the mechanical phase at that moment.
  const pick = (frac: number, w: number) => {
    const windowMs = w / (4 * 0.025);
    const t = Math.max(0, getRunner().timeMs - windowMs * (1 - frac));
    const st = useEcgStore.getState();
    st.pause();
    st.seek(t);
  };
  return <WaveCanvas testId="lead-ii-strip" draw={draw} onPick={pick} height={190} ariaLabel="Lead II rhythm strip, computed from the simulated cardiac conduction" tag="II  rhythm strip" tagColor={ECG_COLOR} />;
}

export function LeadTile({ index }: { index: number }) {
  const draw = useMemo(() => makeDraw(index, 2.6, false), [index]);
  return <WaveCanvas testId={`lead-${ECG_LEADS[index]}`} draw={draw} height={104} ariaLabel={`Lead ${ECG_LEADS[index]}`} tag={ECG_LEADS[index]} tagColor={ECG_COLOR} />;
}

export function TwelveLead() {
  return (
    <div className="leads" data-testid="twelve-lead">
      {ECG_LEADS.map((_, i) => <LeadTile key={i} index={i} />)}
    </div>
  );
}
