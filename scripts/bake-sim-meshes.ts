// Bakes the procedurally sculpted heart / lung meshes: node scripts/bake-sim-meshes.ts heart|lung [cellSize]
import { gradient, type V3 } from "../src/components/sim3d/sdf.ts";
import { surfaceNets, relax, type NetsMesh } from "./sim/surfaceNets.ts";
import { writeBake, type BakeMesh } from "./sim/bakeFormat.ts";
import { bakeHeart } from "./sim/bakeHeart.ts";
import { bakeLung } from "./sim/bakeLung.ts";

export type BakeSpec = {
  out: string;
  field: (p: V3) => number;
  lo: V3; hi: V3; h: number;
  region: (p: V3) => string;
  colour: (p: V3, region: string) => [number, number, number];
  names: Record<string, string>;
  /** extra smoothing passes */
  relax?: number;
};

const which = process.argv[2];
const hit = process.argv[4] === "hit";
const spec: BakeSpec = which === "lung" ? bakeLung(Number(process.argv[3])) : bakeHeart(Number(process.argv[3]));
if (hit) { spec.out = spec.out.replace(".bin", "-hit.bin"); spec.relax = 1; }
const t0 = Date.now();
const mesh: NetsMesh = surfaceNets(spec.field, spec.lo, spec.hi, spec.h);
relax(mesh, spec.relax ?? 2, 0.35);
const nv = mesh.positions.length / 3;
console.log(`${which}: ${nv} vertices, ${mesh.indices.length / 3} triangles (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

const P = (i: number): V3 => [mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2]];
const reg: string[] = new Array(nv);
for (let i = 0; i < nv; i++) reg[i] = spec.region(P(i));
const normals: V3[] = new Array(nv);
for (let i = 0; i < nv; i++) normals[i] = gradient(spec.field, P(i), spec.h * 0.5);
const colours: [number, number, number][] = new Array(nv);
for (let i = 0; i < nv; i++) colours[i] = spec.colour(P(i), reg[i]);
console.log(`labelled (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

// split triangles by the majority region of their vertices
const byRegion = new Map<string, number[]>();
for (let t = 0; t < mesh.indices.length; t += 3) {
  const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
  const r = reg[a] === reg[b] || reg[a] === reg[c] ? reg[a] : reg[b] === reg[c] ? reg[b] : reg[a];
  if (!byRegion.has(r)) byRegion.set(r, []);
  byRegion.get(r)!.push(a, b, c);
}
const out: BakeMesh[] = [];
for (const [r, tri] of byRegion) {
  const remap = new Map<number, number>();
  const pos: number[] = [], nor: V3[] = [], col: [number, number, number][] = [];
  const ind = new Uint32Array(tri.length);
  tri.forEach((v, i) => {
    let m = remap.get(v);
    if (m === undefined) { m = remap.size; remap.set(v, m); pos.push(...P(v)); nor.push(normals[v]); col.push(colours[v]); }
    ind[i] = m;
  });
  out.push({ name: spec.names[r] ?? r, region: r, mesh: { positions: new Float32Array(pos), indices: ind }, normals: nor, colors: col });
  console.log(`  ${spec.names[r] ?? r}: ${pos.length / 3} verts, ${tri.length / 3} tris`);
}
writeBake(spec.out, { lo: spec.lo, hi: spec.hi }, out);
console.log("wrote", spec.out);
