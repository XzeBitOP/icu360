"use client";
import { useEffect } from "react";
import "@/components/sim3d/sim3d.css";
import { SimulationRunner } from "@/sim/core";
import { VentilatorEngine, lungModeInputs, lungVisual, type LungModeId, type VentInput, type VentSnapshot } from "@/sim/vent";
import { LungScene } from "@/components/sim3d/lung/LungScene";

export default function Dbg() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const host = document.createElement("div");
    const w = Number(q.get("w") ?? 0), h = Number(q.get("h") ?? 0);
    host.style.cssText = `position:fixed;z-index:99999;${w ? `left:0;top:0;width:${w}px;height:${h}px` : "inset:0"};background:radial-gradient(circle at 50% 40%, #1a2540, #070b14)`;
    document.body.appendChild(host);
    const runner = new SimulationRunner<VentSnapshot, VentInput>(new VentilatorEngine({}));
    for (const i of lungModeInputs((q.get("mode") ?? "vc") as LungModeId)) runner.dispatch(i);
    runner.stepForward(4000);
    runner.play();
    const eng = () => runner.engine as VentilatorEngine;
    const scene = new LungScene({ container: host, getVisual: () => lungVisual(eng()), getSettings: () => ({ fio2: eng().settings.fio2, peepCmH2O: eng().settings.peepCmH2O }) });
    const [cx, cy, cz] = (q.get("cam") ?? "").split(",").map(Number);
    if (cz) { scene.stage.camera.position.set(cx, cy, cz); scene.stage.controls.update(); }
    if (q.get("labels") === "0") scene.setLabels(false);
    const win = window as unknown as Record<string, unknown>;
    win.__scene = scene; win.__runner = runner;
    scene.ready.then(() => { win.__ready = true; });
    return () => { scene.dispose(); host.remove(); };
  }, []);
  return <div />;
}
