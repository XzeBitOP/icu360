import fs from "node:fs";
import type { V3 } from "../../src/components/sim3d/sdf.ts";
import type { NetsMesh } from "./surfaceNets.ts";

export type BakeMesh = { name: string; region: string; mesh: NetsMesh; normals: V3[]; colors: [number, number, number][] };

/** Binary layout: u32 jsonLength, json header (padded to 4), then per mesh: int16 positions, int8 normals, uint8 colours, indices. */
export function writeBake(file: string, bounds: { lo: V3; hi: V3 }, meshes: BakeMesh[]): void {
  const chunks: Buffer[] = [];
  const info: Record<string, unknown>[] = [];
  let offset = 0;
  const push = (b: Buffer) => { const pad = (4 - (b.length % 4)) % 4; const out = Buffer.concat([b, Buffer.alloc(pad)]); chunks.push(out); const o = offset; offset += out.length; return o; };
  const { lo, hi } = bounds;
  for (const m of meshes) {
    const nv = m.mesh.positions.length / 3;
    const pos = Buffer.alloc(nv * 6);
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) pos.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(((m.mesh.positions[3 * i + k] - lo[k]) / (hi[k] - lo[k])) * 65534 - 32767))), (i * 3 + k) * 2);
    const nor = Buffer.alloc(nv * 3);
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) nor.writeInt8(Math.round(m.normals[i][k] * 127), i * 3 + k);
    const col = Buffer.alloc(nv * 3);
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] = m.colors[i][k];
    const big = nv > 65535;
    const ind = Buffer.alloc(m.mesh.indices.length * (big ? 4 : 2));
    for (let i = 0; i < m.mesh.indices.length; i++) big ? ind.writeUInt32LE(m.mesh.indices[i], i * 4) : ind.writeUInt16LE(m.mesh.indices[i], i * 2);
    info.push({ name: m.name, region: m.region, nv, ni: m.mesh.indices.length, big, pos: push(pos), nor: push(nor), col: push(col), idx: push(ind) });
  }
  let json = Buffer.from(JSON.stringify({ bounds, meshes: info }));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(4); head.writeUInt32LE(json.length);
  fs.mkdirSync(file.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, json, ...chunks]));
}
