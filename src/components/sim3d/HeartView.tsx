"use client";
import { useEffect, useRef, useState } from "react";
import "./sim3d.css";
import type { HeartScene, ChamberOverride } from "./heart/HeartScene";
import type { HeartVisual } from "@/sim/ecg";
import type { PartInfo } from "./shared";
import { webglSupport } from "./stage";

export type HeartViewProps = {
  getVisual: () => HeartVisual;
  getManual?: () => ChamberOverride | null;
  conduction: boolean;
  labels: boolean;
  low?: boolean;
  onPick?: (info: PartInfo | null) => void;
  onUnavailable?: () => void;
  onScene?: (s: HeartScene | null) => void;
};

/** Lazy-loaded three.js heart. This module is only imported when the 3D view is shown, so three.js never reaches other pages. */
export default function HeartView(p: HeartViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeartScene | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const props = useRef(p);
  useEffect(() => { props.current = p; });

  useEffect(() => {
    let dead = false;
    if (!webglSupport().ok) { props.current.onUnavailable?.(); return; }
    (async () => {
      try {
        const { HeartScene } = await import("./heart/HeartScene");
        if (dead || !host.current) return;
        const s = new HeartScene({
          container: host.current,
          getVisual: () => props.current.getVisual(),
          getManual: () => props.current.getManual?.() ?? null,
          low: props.current.low,
          onSelect: (i) => props.current.onPick?.(i),
        });
        sceneRef.current = s;
        s.setConduction(props.current.conduction);
        s.setLabels(props.current.labels);
        props.current.onScene?.(s);
        await s.ready;
        if (!dead) setState("ready");
      } catch (e) {
        console.error("3D heart unavailable", e);
        if (!dead) props.current.onUnavailable?.();
      }
    })();
    return () => { dead = true; props.current.onScene?.(null); sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setConduction(p.conduction); }, [p.conduction]);
  useEffect(() => { sceneRef.current?.setLabels(p.labels); }, [p.labels]);

  return (
    <div ref={host} className="sim3d-host sim3d-frame" data-testid="heart-3d" data-state={state} role="img" aria-label="Interactive 3D cutaway heart. Drag to rotate, pinch or scroll to zoom, tap a structure for details.">
      {state === "loading" ? <div className="sim3d-loading">Loading 3D heart…</div> : null}
    </div>
  );
}
