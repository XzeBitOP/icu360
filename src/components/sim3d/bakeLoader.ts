import * as THREE from "three";

type Header = { bounds: { lo: number[]; hi: number[] }; meshes: { name: string; region: string; nv: number; ni: number; big: boolean; pos: number; nor: number; col: number; idx: number }[] };

/** Bump when public/sim/*.bin is re-baked (cache key; the service worker ignores the query string when offline). */
export const BAKE_VERSION = "1";

export type BakedMesh = { name: string; region: string; geometry: THREE.BufferGeometry };

/** Parse a bake produced by scripts/bake-sim-meshes.ts into BufferGeometries (positions, normals and vertex colours already baked). */
export async function loadBake(url: string): Promise<BakedMesh[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mesh bake ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const jsonLen = new DataView(buf).getUint32(0, true);
  const header: Header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLen)));
  const base = 4 + jsonLen;
  const { lo, hi } = header.bounds;
  return header.meshes.map((m) => {
    const posQ = new Int16Array(buf, base + m.pos, m.nv * 3);
    const positions = new Float32Array(m.nv * 3);
    for (let i = 0; i < m.nv; i++) for (let k = 0; k < 3; k++) positions[i * 3 + k] = lo[k] + ((posQ[i * 3 + k] + 32767) / 65534) * (hi[k] - lo[k]);
    const nq = new Int8Array(buf, base + m.nor, m.nv * 3);
    const normals = new Float32Array(m.nv * 3);
    for (let i = 0; i < normals.length; i += 3) {
      const x = nq[i] / 127, y = nq[i + 1] / 127, z = nq[i + 2] / 127;
      const l = Math.hypot(x, y, z) || 1;
      normals[i] = x / l; normals[i + 1] = y / l; normals[i + 2] = z / l;
    }
    const cq = new Uint8Array(buf, base + m.col, m.nv * 3);
    const colors = new Float32Array(m.nv * 3);
    for (let i = 0; i < colors.length; i++) colors[i] = Math.pow(cq[i] / 255, 2.2); // sRGB → linear
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(m.big ? new Uint32Array(buf.slice(base + m.idx, base + m.idx + m.ni * 4)) : new Uint16Array(buf.slice(base + m.idx, base + m.idx + m.ni * 2)), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return { name: m.name, region: m.region, geometry: g };
  });
}
