"use client";
import { useEffect, useRef, type ReactNode } from "react";

/* ───────── shared animation loop: one requestAnimationFrame for every canvas ───────── */
type FrameFn = (nowMs: number, dtMs: number) => void;
const subscribers = new Set<FrameFn>();
let rafId = 0;
let last = 0;
function loop(now: number) {
  const dt = last ? now - last : 16;
  last = now;
  for (const fn of subscribers) fn(now, dt);
  rafId = subscribers.size ? requestAnimationFrame(loop) : 0;
}
export function subscribeFrame(fn: FrameFn): () => void {
  subscribers.add(fn);
  if (!rafId) { last = 0; rafId = requestAnimationFrame(loop); }
  return () => { subscribers.delete(fn); };
}

/* ───────── canvas component ───────── */
export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function WaveCanvas({ draw, height, ariaLabel, tag, tagColor, tagRight, testId, onPick }: { draw: DrawFn; height: number; ariaLabel: string; tag?: string; tagColor?: string; tagRight?: ReactNode; testId?: string; onPick?: (xFraction: number, widthPx: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; });
  useEffect(() => {
    const c = canvas.current!, w = wrap.current!;
    let cw = 0, ch = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = w.getBoundingClientRect();
      cw = Math.max(1, Math.round(r.width)); ch = Math.max(1, Math.round(r.height));
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(w);
    const ctx = c.getContext("2d")!;
    const unsub = subscribeFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      drawRef.current(ctx, cw, ch);
    });
    return () => { unsub(); ro.disconnect(); };
  }, []);
  return (
    <div className="wave" ref={wrap} style={{ height, cursor: onPick ? "crosshair" : undefined }} data-testid={testId} onClick={onPick ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onPick((e.clientX - r.left) / r.width, r.width); } : undefined}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel} />
      {tag ? <span className="tag" style={{ color: tagColor }}>{tag}</span> : null}
      {tagRight ? <span className="tag r">{tagRight}</span> : null}
    </div>
  );
}

/* ───────── drawing helpers (pure canvas) ───────── */

/** Standard ECG paper: 1 mm = 40 ms at 25 mm/s; 1 mm = 0.1 mV at 10 mm/mV. Returns px per mm. */
export function drawEcgPaper(ctx: CanvasRenderingContext2D, w: number, h: number, windowMs: number, rightEdgeMs: number, speedMmPerS = 25) {
  const pxPerMs = w / windowMs;
  const pxPerMm = pxPerMs * (1000 / speedMmPerS);
  const msPerMm = 1000 / speedMmPerS;
  const first = Math.ceil((rightEdgeMs - windowMs) / msPerMm);
  ctx.lineWidth = 1;
  for (let k = first; ; k++) {
    const t = k * msPerMm;
    const x = (t - (rightEdgeMs - windowMs)) * pxPerMs;
    if (x > w) break;
    const major = ((k % 5) + 5) % 5 === 0;
    ctx.strokeStyle = major ? "rgba(255,120,120,.20)" : "rgba(255,120,120,.075)";
    ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); ctx.stroke();
  }
  const cy = h / 2;
  for (let j = -Math.ceil(cy / pxPerMm); j <= Math.ceil(cy / pxPerMm); j++) {
    const y = cy + j * pxPerMm;
    const major = ((j % 5) + 5) % 5 === 0;
    ctx.strokeStyle = major ? "rgba(255,120,120,.20)" : "rgba(255,120,120,.075)";
    ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); ctx.stroke();
  }
  return pxPerMm;
}

/** Time-axis grid for ventilator waveforms (vertical second lines + horizontal value lines). */
export function drawTimeGrid(ctx: CanvasRenderingContext2D, w: number, h: number, windowMs: number, rightEdgeMs: number, yMin: number, yMax: number, yStep: number, zeroLine = true) {
  const pxPerMs = w / windowMs;
  ctx.lineWidth = 1;
  const firstS = Math.ceil((rightEdgeMs - windowMs) / 1000);
  for (let s = firstS; s * 1000 <= rightEdgeMs; s++) {
    const x = (s * 1000 - (rightEdgeMs - windowMs)) * pxPerMs;
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); ctx.stroke();
  }
  const y2 = (v: number) => h - ((v - yMin) / (yMax - yMin)) * h;
  ctx.font = "10px ui-monospace, monospace"; ctx.fillStyle = "rgba(154,168,191,.75)"; ctx.textAlign = "right";
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) {
    const y = y2(v);
    ctx.strokeStyle = v === 0 && zeroLine ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)";
    ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); ctx.stroke();
    if (y > 26 && y < h - 3) ctx.fillText(String(Math.round(v * 100) / 100), w - 4, y - 2);
  }
  return y2;
}

/** Plot a sampled signal over [rightEdgeMs - windowMs, rightEdgeMs]. Draws only up to `nowMs` (data after it does not exist yet). */
export function drawSignal(ctx: CanvasRenderingContext2D, w: number, windowMs: number, rightEdgeMs: number, sample: (tMs: number) => number | null, yOf: (v: number) => number, color: string, lineWidth = 2, stepPx = 1.5) {
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  ctx.beginPath();
  let pen = false;
  const t0 = rightEdgeMs - windowMs;
  for (let x = 0; x <= w; x += stepPx) {
    const t = t0 + (x / w) * windowMs;
    const v = t < 0 ? null : sample(t);
    if (v === null || Number.isNaN(v)) { pen = false; continue; }
    const y = yOf(v);
    if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Vertical "now" cursor at the right edge. */
export function drawNowCursor(ctx: CanvasRenderingContext2D, x: number, h: number, color = "rgba(94,234,212,.7)") {
  const g = ctx.createLinearGradient(x - 26, 0, x, 0);
  g.addColorStop(0, "rgba(94,234,212,0)"); g.addColorStop(1, "rgba(94,234,212,.12)");
  ctx.fillStyle = g; ctx.fillRect(x - 26, 0, 26, h);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - .5, 0); ctx.lineTo(x - .5, h); ctx.stroke();
}

/** X-Y loop (pressure–volume or flow–volume), with a dot at the current point. */
export function drawLoop(ctx: CanvasRenderingContext2D, w: number, h: number, pts: { x: number; y: number }[], xr: [number, number], yr: [number, number], color: string, labels: { x: string; y: string }) {
  const X = (v: number) => 30 + ((v - xr[0]) / (xr[1] - xr[0])) * (w - 40);
  const Y = (v: number) => h - 18 - ((v - yr[0]) / (yr[1] - yr[0])) * (h - 30);
  ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(0), 6); ctx.lineTo(X(0), h - 14); ctx.moveTo(30, Y(0)); ctx.lineTo(w - 6, Y(0)); ctx.stroke();
  ctx.fillStyle = "rgba(154,168,191,.8)"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "right";
  ctx.fillText(labels.x, w - 6, h - 4); ctx.fillText(labels.y, w - 6, 14);
  if (pts.length < 2) return;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 6;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke(); ctx.shadowBlur = 0;
  const l = pts[pts.length - 1];
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(l.x), Y(l.y), 3.5, 0, Math.PI * 2); ctx.fill();
}
