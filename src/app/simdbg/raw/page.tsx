"use client";
import { useEffect } from "react";
import * as THREE from "three";
import { createStage } from "@/components/sim3d/stage";
import { loadBake } from "@/components/sim3d/bakeLoader";

export default function Dbg() {
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const which = q.get("m") ?? "lung";
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:99999;inset:0;background:radial-gradient(circle at 50% 40%, #1a2540, #070b14)";
    document.body.appendChild(host);
    const st = createStage(host, { camera: [0, 0.3, 13], target: [0, 0.2, 0] });
    const [cx, cy, cz] = (q.get("cam") ?? "").split(",").map(Number);
    if (cz) { st.camera.position.set(cx, cy, cz); st.controls.update(); }
    let live = true;
    loadBake(`/sim/${which}.bin?t=${Date.now()}`).then((ms) => {
      if (!live) return;
      const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });
      for (const m of ms) { const mesh = new THREE.Mesh(m.geometry, mat); mesh.name = m.name; st.scene.add(mesh); }
      (window as unknown as { __ready: boolean }).__ready = true;
    });
    return () => { live = false; st.dispose(); host.remove(); };
  }, []);
  return <div />;
}
