/** Naive surface nets on a regular grid: smooth, watertight meshes from a signed-distance function (negative inside). */
import type { V3 } from "../../src/components/sim3d/sdf.ts";

export type NetsMesh = { positions: Float32Array; indices: Uint32Array };

export function surfaceNets(field: (p: V3) => number, lo: V3, hi: V3, h: number): NetsMesh {
  const nx = Math.ceil((hi[0] - lo[0]) / h), ny = Math.ceil((hi[1] - lo[1]) / h), nz = Math.ceil((hi[2] - lo[2]) / h);
  const sx = nx + 1, sy = ny + 1, sz = nz + 1;
  const val = new Float32Array(sx * sy * sz);
  const at = (i: number, j: number, k: number) => i + sx * (j + sy * k);
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) val[at(i, j, k)] = field([lo[0] + i * h, lo[1] + j * h, lo[2] + k * h]);

  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const cid = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v: number[] = [];
    let mask = 0;
    for (let c = 0; c < 8; c++) { const d = val[at(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; v.push(d); if (d < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const [a, b] of edges) {
      const da = v[a], db = v[b];
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      cx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      cy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      cz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + cx / n) * h, lo[1] + (j + cy / n) * h, lo[2] + (k + cz / n) * h);
  }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (!flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
    const d0 = val[at(i, j, k)] < 0;
    if (i < nx && j > 0 && k > 0 && d0 !== val[at(i + 1, j, k)] < 0) quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], d0);
    if (j < ny && i > 0 && k > 0 && d0 !== val[at(i, j + 1, k)] < 0) quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i - 1, j, k)], cellVert[cid(i, j, k)], cellVert[cid(i, j, k - 1)], d0);
    if (k < nz && i > 0 && j > 0 && d0 !== val[at(i, j, k + 1)] < 0) quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], d0);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Laplacian smoothing of a few iterations (keeps boundary mostly in place) to remove grid stair-stepping. */
export function relax(m: NetsMesh, iters = 2, amount = 0.4): void {
  const nv = m.positions.length / 3;
  const nb: Set<number>[] = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < m.indices.length; t += 3) for (let a = 0; a < 3; a++) { const u = m.indices[t + a], w = m.indices[t + (a + 1) % 3]; nb[u].add(w); nb[w].add(u); }
  const tmp = new Float32Array(m.positions.length);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < nv; i++) {
      let x = 0, y = 0, z = 0;
      for (const j of nb[i]) { x += m.positions[3 * j]; y += m.positions[3 * j + 1]; z += m.positions[3 * j + 2]; }
      const c = nb[i].size || 1;
      tmp[3 * i] = m.positions[3 * i] + (x / c - m.positions[3 * i]) * amount;
      tmp[3 * i + 1] = m.positions[3 * i + 1] + (y / c - m.positions[3 * i + 1]) * amount;
      tmp[3 * i + 2] = m.positions[3 * i + 2] + (z / c - m.positions[3 * i + 2]) * amount;
    }
    m.positions.set(tmp);
  }
}
