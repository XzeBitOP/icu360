"use client";
import "@/components/sim3d/sim3d.css";
import { useEffect } from "react";
import { SimulationRunner } from "@/sim/core";
import { EcgEngine, heartVisual, type EcgInput, type EcgSnapshot } from "@/sim/ecg";
import { HeartScene } from "@/components/sim3d/heart/HeartScene";

export default function Dbg() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const host = document.createElement("div");
    const w = Number(q.get("w") ?? 0), h = Number(q.get("h") ?? 0);
    host.style.cssText = `position:fixed;z-index:99999;${w ? `left:0;top:0;width:${w}px;height:${h}px` : "inset:0"};background:radial-gradient(circle at 50% 40%, #1a2540, #070b14)`;
    document.body.appendChild(host);
    const runner = new SimulationRunner<EcgSnapshot, EcgInput>(new EcgEngine({}));
    runner.stepForward(1600);
    runner.play();
    const scene = new HeartScene({ container: host, getVisual: () => heartVisual(runner.engine as EcgEngine, runner.timeMs) });
    const [cx, cy, cz] = (q.get("cam") ?? "").split(",").map(Number);
    if (cz) { scene.stage.camera.position.set(cx, cy, cz); scene.stage.controls.update(); }
    if (q.get("cond") === "0") scene.setConduction(false);
    if (q.get("labels") === "0") scene.setLabels(false);
    const win = window as unknown as Record<string, unknown>;
    win.__scene = scene; win.__runner = runner;
    scene.ready.then(() => { win.__ready = true; });
    return () => { scene.dispose(); host.remove(); };
  }, []);
  return <div />;
}
