"use client";
import { useEffect, useRef, useState } from "react";
import "./sim3d.css";
import type { LungScene } from "./lung/LungScene";
import type { LungVisual } from "@/sim/vent";
import type { PartInfo } from "./shared";
import { webglSupport } from "./stage";

export type LungViewProps = {
  getVisual: () => LungVisual;
  getSettings: () => { fio2: number; peepCmH2O: number };
  labels: boolean;
  low?: boolean;
  onPick?: (info: PartInfo | null) => void;
  onUnavailable?: () => void;
  onScene?: (s: LungScene | null) => void;
};

/** Lazy-loaded three.js lungs (see HeartView). */
export default function LungView3D(p: LungViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LungScene | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const props = useRef(p);
  useEffect(() => { props.current = p; });

  useEffect(() => {
    let dead = false;
    if (!webglSupport().ok) { props.current.onUnavailable?.(); return; }
    (async () => {
      try {
        const { LungScene } = await import("./lung/LungScene");
        if (dead || !host.current) return;
        const s = new LungScene({
          container: host.current,
          getVisual: () => props.current.getVisual(),
          getSettings: () => props.current.getSettings(),
          low: props.current.low,
          onSelect: (i) => props.current.onPick?.(i),
        });
        sceneRef.current = s;
        s.setLabels(props.current.labels);
        props.current.onScene?.(s);
        await s.ready;
        s.setLabels(props.current.labels);
        if (!dead) setState("ready");
      } catch (e) {
        console.error("3D lungs unavailable", e);
        if (!dead) props.current.onUnavailable?.();
      }
    })();
    return () => { dead = true; props.current.onScene?.(null); sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setLabels(p.labels); }, [p.labels]);

  return (
    <div ref={host} className="sim3d-host sim3d-frame" data-testid="lung-3d" data-state={state} role="img" aria-label="Interactive 3D lungs with airway tree, five lobes and diaphragm. Drag to rotate, pinch or scroll to zoom, tap a structure for details.">
      {state === "loading" ? <div className="sim3d-loading">Loading 3D lungs…</div> : null}
    </div>
  );
}
