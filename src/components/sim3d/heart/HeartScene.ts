import * as THREE from "three";
import { BAKE_VERSION, loadBake, type BakedMesh } from "../bakeLoader";
import { createStage, type Stage } from "../stage";
import { TRACT_FRAG, TRACT_VERT, makePin, makeTooltip, mergedTubes, tubeGeometry, type PartInfo } from "../shared";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CHAMBERS, HEART_REGION_NAMES } from "./anatomy";
import { HEART_INFO } from "./info";
import { VALVE_DEFS, buildLayout, purkinjeNetwork, valveRing, LUMEN_LV, LUMEN_RV, type ValveId } from "./layout";
import { gradient, snapToSurface, type V3 } from "../sdf";
import type { HeartVisual } from "@/sim/ecg";

export type ChamberOverride = Partial<Record<"ra" | "la" | "rv" | "lv", number>>;

export type HeartSceneOptions = {
  container: HTMLElement;
  /** Reads the current state from the simulation engine. Called every frame. */
  getVisual: () => HeartVisual;
  /** Manual chamber override (HeartSim.setChamberState); null = follow the simulation. */
  getManual?: () => ChamberOverride | null;
  low?: boolean;
  onSelect?: (info: PartInfo | null) => void;
};

const MAX_TWIST = THREE.MathUtils.degToRad(10);
const f3 = (v: number[]) => v.map((x) => x.toFixed(4)).join(",");

/** GLSL: contraction field applied in world (heart) space to every vertex, plus an apical twist. Chambers shrink toward their centres. */
function deformGLSL(): string {
  const vec = (a: number[]) => `vec3(${f3(a)})`;
  const c = CHAMBERS;
  return /* glsl */ `
uniform vec4 uC;
uniform float uTwist;
vec3 hdef(vec3 p){
  vec3 o = p;
  float w;
  w = smoothstep(1.3, 0.55, length((o - ${vec(c.ra.c)}) / ${vec(c.ra.r)})); p -= (o - ${vec(c.ra.c)}) * 0.18 * uC.x * w;
  w = smoothstep(1.3, 0.55, length((o - ${vec(c.la.c)}) / ${vec(c.la.r)})); p -= (o - ${vec(c.la.c)}) * 0.18 * uC.y * w;
  w = smoothstep(1.25, 0.5, length((o - ${vec(c.rv.c)}) / ${vec(c.rv.r)})); p -= (o - ${vec(c.rv.c)}) * 0.17 * uC.z * w;
  w = smoothstep(1.25, 0.5, length((o - ${vec(c.lv.c)}) / ${vec(c.lv.r)})); p -= (o - ${vec(c.lv.c)}) * 0.24 * uC.w * w;
  float a = uTwist * ${MAX_TWIST.toFixed(5)} * smoothstep(0.15, -1.7, o.y);
  vec2 q = p.xz - vec2(0.85, -0.12);
  float cs = cos(a), sn = sin(a);
  p.xz = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y) + vec2(0.85, -0.12);
  return p;
}
`;
}

type Deform = { uC: { value: THREE.Vector4 }; uTwist: { value: number } };

function patchDeform(mat: THREE.Material, d: Deform, glsl: string) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uC = d.uC;
    sh.uniforms.uTwist = d.uTwist;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${glsl}`)
      .replace("#include <project_vertex>", `vec4 hW = modelMatrix * vec4(transformed, 1.0);\nhW.xyz = hdef(hW.xyz);\nvec4 mvPosition = viewMatrix * hW;\ngl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => "heart-deform";
}

function tractMaterial(color: string, d: Deform, glsl: string, width = 0.16, base = 0.12): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uProg: { value: 0 }, uBase: { value: base }, uBoost: { value: 0 }, uWidth: { value: width }, uC: d.uC, uTwist: d.uTwist },
    vertexShader: `uniform vec4 uC; uniform float uTwist;\n${glsl.replace(/uniform vec4 uC;\s*uniform float uTwist;/, "")}\n${TRACT_VERT.replace("vec3 hdef(vec3 p);", "")}`,
    fragmentShader: TRACT_FRAG,
  });
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Encode the wavefront of a set of conduction edges as one scalar: 0 idle, (0,1) head position, [1,2) trailing glow. */
export function edgeProgress(edge: Record<string, number>, ids: string[]): number {
  let head = 0, trail = Infinity;
  for (const id of ids) {
    const v = edge[id];
    if (v === undefined) continue;
    if (v < 1) head = Math.max(head, v); else trail = Math.min(trail, v);
  }
  if (head > 0) return head;
  return Number.isFinite(trail) ? trail : 0;
}
/** Piecewise mapping of consecutive edges to positions along one tract. */
export function chainProgress(edge: Record<string, number>, segs: [string, number, number][]): number {
  let trail = Infinity, best = 0;
  for (const [id, a, b] of segs) {
    const v = edge[id];
    if (v === undefined) continue;
    if (v < 1) best = Math.max(best, a + (b - a) * v); else trail = Math.min(trail, v);
  }
  if (best > 0) return Math.min(0.999, best);
  return Number.isFinite(trail) ? trail : 0;
}

type Leaflet = { group: THREE.Group; mesh: THREE.Mesh; valve: ValveId; kind: "av" | "semilunar"; chordaeAnchors: THREE.Vector3[] };

function leafletGeometry(L: number, W: number, belly: number): THREE.BufferGeometry {
  const nu = 10, nv = 9;
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, e = 1 - (2 * u - 1) ** 2;
      const x = L * v * (1 - 0.1 * v) + 0.05 * L * e * v * v;
      const y = -belly * Math.sin(Math.PI * v) * (0.4 + 0.6 * e);
      const z = W * (1 - 0.45 * v) * (u - 0.5);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class HeartScene {
  readonly stage: Stage;
  readonly parts: Record<string, THREE.Object3D> = {};
  readonly ready: Promise<void>;
  private root = new THREE.Group();
  private deform: Deform = { uC: { value: new THREE.Vector4() }, uTwist: { value: 0 } };
  private glsl = deformGLSL();
  private leaflets: Leaflet[] = [];
  private tracts: { id: string; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; progress: (v: HeartVisual) => number }[] = [];
  private nodes: { id: string; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; glow: (v: HeartVisual) => number }[] = [];
  private bodyMats = new Map<string, THREE.MeshPhysicalMaterial>();
  private hitMeshes: THREE.Mesh[] = [];
  private conduction = new THREE.Group();
  private pinGroup = new THREE.Group();
  private chordae!: THREE.LineSegments;
  private chordaePairs: { tip: THREE.Vector3; leaflet: Leaflet; local: THREE.Vector3 }[] = [];
  private blockMarkers: { sprite: THREE.Sprite; edge: string }[] = [];
  private manual: ChamberOverride | null = null;
  private hovered: string | null = null;
  private selected: string | null = null;
  private tip: ReturnType<typeof makeTooltip>;
  private raycaster = new THREE.Raycaster();
  private unsub: () => void;
  private lastRay = 0;
  private disposed = false;
  private o: HeartSceneOptions;
  public paused = false;

  constructor(o: HeartSceneOptions) {
    this.o = o;
    const w = o.container.clientWidth || 360, h = o.container.clientHeight || 360;
    const aspect = w / h;
    const dist = Math.min(24, Math.max(10.4, 9.4 / Math.max(aspect, 0.45)));
    this.stage = createStage(o.container, { camera: [0.7, 2.0, dist], target: [0.05, 0.8, -0.3], low: o.low, minDistance: 4, maxDistance: 20 });
    this.stage.scene.add(this.root);
    this.root.name = "heartGroup";
    this.tip = makeTooltip(o.container);
    this.ready = this.build();
    this.unsub = this.stage.onFrame(() => this.frame());
    const dom = this.stage.domElement;
    dom.addEventListener("pointermove", this.onMove);
    dom.addEventListener("pointerleave", this.onLeave);
    dom.addEventListener("pointerdown", this.onDown);
    dom.addEventListener("pointerup", this.onUp);
  }

  // ---------------------------------------------------------------- construction
  private tissueMaterial(): THREE.MeshPhysicalMaterial {
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, sheen: 0.25, sheenColor: new THREE.Color("#ff9aa8"), sheenRoughness: 0.6, emissive: new THREE.Color("#000000"), envMapIntensity: 0.7 });
    patchDeform(m, this.deform, this.glsl);
    return m;
  }

  private async build() {
    const [bodies, hits] = await Promise.all([loadBake(`/sim/heart.bin?v=${BAKE_VERSION}`), loadBake(`/sim/heart-hit.bin?v=${BAKE_VERSION}`)]);
    if (this.disposed) return;
    this.addBodies(bodies, hits);
    this.addValves();
    this.addConduction();
    this.addPins();
    this.conduction.visible = this.conductionOn;
    this.refreshPins();
  }

  private info(name: string): PartInfo {
    return HEART_INFO[name] ?? { id: name, name, physiology: "" };
  }

  private addBodies(bodies: BakedMesh[], hits: BakedMesh[]) {
    for (const b of bodies) {
      const mat = this.tissueMaterial();
      this.bodyMats.set(b.name, mat);
      const mesh = new THREE.Mesh(b.geometry, mat);
      mesh.name = b.name;
      mesh.userData = { ...this.info(b.name) };
      this.root.add(mesh);
      this.parts[b.name] = mesh;
    }
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const h of hits) {
      const mesh = new THREE.Mesh(h.geometry, hitMat);
      mesh.name = h.name;
      mesh.userData = { hitFor: h.name, ...this.info(h.name) };
      this.root.add(mesh);
      this.hitMeshes.push(mesh);
    }
  }

  private addValves() {
    const matLeaf = new THREE.MeshPhysicalMaterial({ color: "#e2bfae", roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide, emissive: new THREE.Color("#000000"), sheen: 0.4, sheenColor: new THREE.Color("#ffd7e0") });
    patchDeform(matLeaf, this.deform, this.glsl);
    const pairs: { tipAt: V3; ids: ValveId }[] = [];
    void pairs;
    const chordaPos: number[] = [];
    for (const id of Object.keys(VALVE_DEFS) as ValveId[]) {
      const def = VALVE_DEFS[id];
      const ring = valveRing(id);
      const a = ring.axis;
      const X: V3 = [1, 0, 0];
      const e1 = unit(sub(X, a.map((x) => x * dot(X, a)) as V3));
      let b = unit(cross(a, e1));
      if (b[2] > 0) b = [-b[0], -b[1], -b[2]];
      const group = new THREE.Group();
      group.name = def.name.replace(/\s/g, "");
      const info: PartInfo = { id: group.name, name: def.name, physiology: def.physiology };
      group.userData = info;
      const R = ring.radius;
      const L = R * (def.kind === "av" ? 1.0 : 0.95);
      const W = R * (def.leaflets === 2 ? 1.7 : 1.15);
      const belly = R * (def.kind === "av" ? 0.1 : 0.2);
      def.angles.forEach((deg, i) => {
        const th = THREE.MathUtils.degToRad(deg);
        const u: V3 = [Math.cos(th) * e1[0] + Math.sin(th) * b[0], Math.cos(th) * e1[1] + Math.sin(th) * b[1], Math.cos(th) * e1[2] + Math.sin(th) * b[2]];
        const H: V3 = [ring.center[0] + u[0] * R, ring.center[1] + u[1] * R, ring.center[2] + u[2] * R];
        const xAxis = new THREE.Vector3(-u[0], -u[1], -u[2]);
        const yAxis = new THREE.Vector3(a[0], a[1], a[2]);
        const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
        const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        const hinge = new THREE.Group();
        hinge.position.set(...H);
        hinge.quaternion.setFromRotationMatrix(m);
        const mesh = new THREE.Mesh(leafletGeometry(L, W, belly), matLeaf);
        mesh.name = `${group.name}Leaflet${i + 1}`;
        mesh.userData = info;
        hinge.add(mesh);
        group.add(hinge);
        const anchors = def.kind === "av" ? [0.2, 0.5, 0.8].map((uu) => new THREE.Vector3(L * 0.97, 0, W * (1 - 0.45) * (uu - 0.5))) : [];
        this.leaflets.push({ group: hinge, mesh, valve: id, kind: def.kind, chordaeAnchors: anchors });
      });
      this.root.add(group);
      this.parts[group.name] = group;
    }
    // papillary muscles + chordae tendineae for the AV valves
    const papMat = new THREE.MeshPhysicalMaterial({ color: "#a8434f", roughness: 0.5, clearcoat: 0.4, emissive: new THREE.Color("#000000") });
    patchDeform(papMat, this.deform, this.glsl);
    const papillary: Record<"tricuspid" | "mitral", V3[]> = {
      tricuspid: [[-0.55, -0.75, -0.32], [-0.62, -0.5, -0.08]],
      mitral: [[0.95, -0.85, -0.4], [1.3, -0.55, -0.12]],
    };
    const tips: Record<string, THREE.Vector3[]> = { tricuspid: [], mitral: [] };
    (Object.keys(papillary) as ("tricuspid" | "mitral")[]).forEach((valve) => {
      const lum = valve === "tricuspid" ? LUMEN_RV : LUMEN_LV;
      for (const p0 of papillary[valve]) {
        const base = snapToSurface(lum, p0, 0.0);
        const n = gradient(lum, base);
        const inward: V3 = [-n[0], -n[1], -n[2]]; // gradient points out of the lumen (towards the wall): inward = into the cavity
        const heightPap = 0.34;
        const prof: THREE.Vector2[] = [];
        for (let k = 0; k <= 8; k++) { const t = k / 8; prof.push(new THREE.Vector2(0.085 * (1 - t * 0.7) * (1 - t ** 4) + 0.012, t * heightPap)); }
        const lathe = new THREE.LatheGeometry(prof, 12);
        const mesh = new THREE.Mesh(lathe, papMat);
        mesh.position.set(base[0] - inward[0] * 0.03, base[1] - inward[1] * 0.03, base[2] - inward[2] * 0.03);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...inward).negate().negate());
        mesh.name = "PapillaryMuscle";
        mesh.userData = { id: "PapillaryMuscle", name: "Papillary muscle", physiology: "Contracts with the ventricle to tension the chordae tendineae so the AV valve leaflets do not prolapse into the atrium." } satisfies PartInfo;
        this.root.add(mesh);
        const tip = new THREE.Vector3(...base).addScaledVector(new THREE.Vector3(...inward), heightPap);
        tips[valve].push(tip);
      }
    });
    for (const lf of this.leaflets) {
      if (lf.kind !== "av") continue;
      const list = tips[lf.valve as "tricuspid" | "mitral"];
      lf.chordaeAnchors.forEach((loc, i) => { const tip = list[(i + (lf.group.id % 2)) % list.length]; this.chordaePairs.push({ tip, leaflet: lf, local: loc }); chordaPos.push(0, 0, 0, 0, 0, 0); });
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(chordaPos, 3));
    const cm = new THREE.LineBasicMaterial({ color: "#f2e6dc", transparent: true, opacity: 0.85 });
    patchDeform(cm, this.deform, this.glsl);
    this.chordae = new THREE.LineSegments(cg, cm);
    this.chordae.frustumCulled = false;
    this.chordae.name = "ChordaeTendineae";
    this.root.add(this.chordae);
  }

  private addConduction() {
    const layout = buildLayout();
    this.root.add(this.conduction);
    const d = this.deform, glsl = this.glsl;
    const nodeMat = (c: string) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 0.5, roughness: 0.3 }); patchDeform(m, d, glsl); return m; };
    const mkNode = (id: "SANode" | "AVNode", p: V3, r: number, glow: (v: HeartVisual) => number) => {
      const mat = nodeMat("#facc15");
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
      mesh.position.set(...p);
      mesh.name = id; mesh.userData = { ...HEART_INFO[id] };
      this.conduction.add(mesh);
      this.nodes.push({ id, mesh, mat, glow });
      this.parts[id] = mesh;
      // generous invisible hit target
      const hit = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(mesh.position); hit.userData = { hitFor: id, ...HEART_INFO[id] }; hit.name = id;
      this.conduction.add(hit); this.hitMeshes.push(hit);
    };
    mkNode("SANode", layout.sa, 0.085, (v) => v.node.saNode);
    mkNode("AVNode", layout.av, 0.075, (v) => Math.max(v.node.avNode, (v.edge["avNode->hisBundle"] ?? 0) > 0 && (v.edge["avNode->hisBundle"] ?? 0) < 1 ? 0.8 : 0));

    const inter = (v: HeartVisual) => chainProgress(v.edge, [["saNode->raHigh", 0, 0.1], ["raHigh->raLow", 0.1, 0.72], ["raLow->avNode", 0.72, 1]]);
    const progress: Record<string, (v: HeartVisual) => number> = {
      InternodalTractAnterior: inter, InternodalTractMiddle: inter, InternodalTractPosterior: inter,
      BachmannsBundle: (v) => chainProgress(v.edge, [["saNode->raHigh", 0, 0.12], ["raHigh->laHigh", 0.12, 1]]),
      BundleOfHis: (v) => edgeProgress(v.edge, ["hisBundle->rightBundle", "hisBundle->leftBundle"]),
      RightBundleBranch: (v) => edgeProgress(v.edge, ["hisBundle->rightBundle"]),
      LeftBundleBranch: (v) => edgeProgress(v.edge, ["hisBundle->leftBundle"]),
    };
    for (const t of layout.tracts) {
      const pts = t.pts.map((p) => new THREE.Vector3(...p));
      const mat = tractMaterial(t.color, d, glsl, t.id === "BundleOfHis" ? 0.25 : 0.14, 0.1);
      if (t.id === "BachmannsBundle") { mat.depthTest = false; mat.transparent = true; }
      const mesh = new THREE.Mesh(tubeGeometry(pts, t.radius, t.phase, 6), mat);
      mesh.name = t.id; mesh.userData = { id: t.id, name: t.name, physiology: t.physiology };
      if (t.id === "BachmannsBundle") mesh.renderOrder = 5;
      this.conduction.add(mesh);
      this.parts[t.id] = mesh;
      this.tracts.push({ id: t.id, mesh, mat, progress: progress[t.id] });
      const hit = new THREE.Mesh(tubeGeometry(pts, Math.max(0.07, t.radius * 2.2), t.phase, 4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { hitFor: t.id, id: t.id, name: t.name, physiology: t.physiology }; hit.name = t.id;
      this.conduction.add(hit); this.hitMeshes.push(hit);
    }
    // Purkinje networks on both endocardial surfaces
    const nets: [string, (p: V3) => number, V3, V3, number, string[]][] = [
      ["PurkinjeFibersRV", LUMEN_RV, [-0.3, -1.3, -0.1], [-0.35, 1, 0.1], 7, ["rightBundle->rvEndo", "rightBundle->rvoEndo", "rightBundle->sepR"]],
      ["PurkinjeFibersLV", LUMEN_LV, [0.98, -1.35, -0.12], [0.3, 1, 0.05], 11, ["leftBundle->sepL", "leftAnteriorFascicle->lvaEndo", "leftAnteriorFascicle->lvlEndo", "leftPosteriorFascicle->lviEndo", "leftPosteriorFascicle->lvbEndo", "leftPosteriorFascicle->lvlEndo"]],
    ];
    for (const [id, lum, root, up, seed, edges] of nets) {
      const branches = purkinjeNetwork(lum, root, up, seed, 170);
      const mat = tractMaterial("#e879f9", d, glsl, 0.2, 0.18);
      const mesh = new THREE.Mesh(mergedTubes(branches, 0.011, 4), mat);
      mesh.name = id; mesh.userData = { ...HEART_INFO.PurkinjeFibers, id };
      this.conduction.add(mesh);
      this.parts[id] = mesh;
      this.tracts.push({ id, mesh, mat, progress: (v) => edgeProgress(v.edge, edges) });
      const hitGeo = mergedTubes(branches, 0.06, 3);
      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { hitFor: id, ...HEART_INFO.PurkinjeFibers, id }; hit.name = id;
      this.conduction.add(hit); this.hitMeshes.push(hit);
    }
    // block markers
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const cx = cv.getContext("2d")!;
    cx.strokeStyle = "#ff4d4d"; cx.lineWidth = 9; cx.lineCap = "round"; cx.shadowColor = "#ff4d4d"; cx.shadowBlur = 8;
    cx.beginPath(); cx.moveTo(14, 14); cx.lineTo(50, 50); cx.moveTo(50, 14); cx.lineTo(14, 50); cx.stroke();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const marks: [string, V3][] = [["avNode->hisBundle", [layout.av[0] + 0.18, layout.av[1] - 0.08, layout.av[2] + 0.1]], ["hisBundle->rightBundle", [layout.tracts.find((t) => t.id === "RightBundleBranch")!.pts[6][0], layout.tracts.find((t) => t.id === "RightBundleBranch")!.pts[6][1], 0.05]], ["hisBundle->leftBundle", [layout.tracts.find((t) => t.id === "LeftBundleBranch")!.pts[6][0], layout.tracts.find((t) => t.id === "LeftBundleBranch")!.pts[6][1], 0.05]]];
    for (const [edge, p] of marks) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.position.set(...p); s.scale.setScalar(0.3); s.visible = false; s.renderOrder = 10;
      this.conduction.add(s);
      this.blockMarkers.push({ sprite: s, edge });
    }
    this.layout = layout;
  }
  private layout!: ReturnType<typeof buildLayout>;

  private pins: CSS2DObject[] = [];
  private addPins() {
    const L = this.layout;
    const add = (label: string, p: V3, dx: number, dy: number, kind: "cond" | "valve" | "chamber", testId: string) => {
      const o = new CSS2DObject(makePin(label, dx, dy, kind, testId));
      o.position.set(...p);
      this.pinGroup.add(o);
      this.pins.push(o);
    };
    const rbb = L.tracts.find((t) => t.id === "RightBundleBranch")!.pts, lbb = L.tracts.find((t) => t.id === "LeftBundleBranch")!.pts;
    add("SA node", L.sa, -46, -30, "cond", "pin-sa");
    add("AV node", L.av, -58, 38, "cond", "pin-av");
    add("Bundle of His", L.hisEnd, 30, -46, "cond", "pin-his");
    add("Right bundle", rbb[18], -52, 8, "cond", "pin-rbb");
    add("Left bundle", lbb[18], 54, -6, "cond", "pin-lbb");
    add("Purkinje fibres", [-0.28, -1.15, -0.1], -62, 40, "cond", "pin-purkinje");
    for (const [id, label, dx, dy] of [["tricuspid", "Tricuspid", -64, 30], ["mitral", "Mitral", 58, 4], ["aortic", "Aortic", 52, -34], ["pulmonary", "Pulmonary", -60, -34]] as [ValveId, string, number, number][]) add(`${label} valve`, valveRing(id).center, dx, dy, "valve", `pin-${id}`);
    add("Right atrium", [-1.55, 0.6, -0.55], -50, -6, "chamber", "pin-ra");
    add("Left atrium", [1.0, 1.3, -0.7], 48, -16, "chamber", "pin-la");
    add("Right ventricle", [-0.6, -0.9, -0.5], -68, 24, "chamber", "pin-rv");
    add("Left ventricle", [1.1, -0.7, -0.5], 58, 22, "chamber", "pin-lv");
    this.root.add(this.pinGroup);
  }

  // ---------------------------------------------------------------- public controls
  setConduction(on: boolean) { this.updateConductionVisibility(on); }
  private conductionOn = true;
  private labelsOn = true;
  private updateConductionVisibility(on: boolean) {
    this.conductionOn = on;
    this.conduction.visible = on;
    this.refreshPins();
  }
  setLabels(on: boolean) { this.labelsOn = on; this.refreshPins(); }
  private refreshPins() {
    for (const p of this.pins) {
      const kind = p.element.className;
      p.visible = this.labelsOn && (!kind.includes("cond") || this.conductionOn); // CSS2DRenderer owns element.style.display
    }
  }
  /** Manual override of chamber contraction (HeartSim.setChamberState). `null` returns control to the simulation. */
  setManual(o: ChamberOverride | null) { this.manual = o; }
  getManual() { return this.manual; }
  select(name: string | null) {
    this.selected = name;
    this.applyHighlight();
    this.o.onSelect?.(name ? this.info(name) : null);
  }

  // ---------------------------------------------------------------- interaction
  private ptr = { x: 0, y: 0, down: false, sx: 0, sy: 0 };
  private pick(clientX: number, clientY: number): PartInfo | null {
    const r = this.stage.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const targets: THREE.Object3D[] = [...this.hitMeshes, ...this.leaflets.map((l) => l.mesh), ...this.root.children.filter((c) => c.name === "PapillaryMuscle")];
    const hits = this.raycaster.intersectObjects(targets, false).filter((h) => h.object.visible && !(this.isConductionHit(h.object) && !this.conductionOn));
    if (!hits.length) return null;
    // prefer small structures (valves, conduction) over big chamber hits when they're within a short distance
    const first = hits[0];
    const small = hits.find((h) => (h.object.userData.hitFor && /Node|Tract|Bundle|Purkinje|Bachmann/.test(String(h.object.userData.hitFor))) || /Leaflet/.test(h.object.name));
    const chosen = small && small.distance < first.distance + 0.9 ? small : first;
    const ud = chosen.object.userData as PartInfo & { hitFor?: string };
    return { id: ud.hitFor ?? ud.id, name: ud.name, physiology: ud.physiology };
  }
  private isConductionHit(o: THREE.Object3D) { return o.parent === this.conduction; }

  private onMove = (e: PointerEvent) => {
    const r = this.stage.domElement.getBoundingClientRect();
    this.ptr.x = e.clientX - r.left; this.ptr.y = e.clientY - r.top;
    if (e.pointerType === "touch") return;
    const now = performance.now();
    if (now - this.lastRay < 60) return;
    this.lastRay = now;
    const p = this.pick(e.clientX, e.clientY);
    this.setHover(p);
  };
  private onLeave = () => this.setHover(null);
  private onDown = (e: PointerEvent) => { this.ptr.down = true; this.ptr.sx = e.clientX; this.ptr.sy = e.clientY; };
  private onUp = (e: PointerEvent) => {
    if (!this.ptr.down) return;
    this.ptr.down = false;
    if (Math.hypot(e.clientX - this.ptr.sx, e.clientY - this.ptr.sy) > 6) return;
    const r = this.stage.domElement.getBoundingClientRect();
    const p = this.pick(e.clientX, e.clientY);
    this.select(p ? p.id : null);
    if (p) { this.hovered = p.id; this.tip.show(p, e.clientX - r.left, e.clientY - r.top); this.applyHighlight(); if (e.pointerType === "touch") window.setTimeout(() => { if (!this.disposed) this.tip.hide(); }, 3500); }
  };
  private setHover(p: PartInfo | null) {
    const id = p?.id ?? null;
    if (id === this.hovered && p) { this.tip.show(p, this.ptr.x, this.ptr.y); return; }
    this.hovered = id;
    if (p) this.tip.show(p, this.ptr.x, this.ptr.y); else this.tip.hide();
    this.stage.domElement.style.cursor = p ? "pointer" : "grab";
    this.applyHighlight();
  }
  private applyHighlight() {
    const boost = (name: string) => (name === this.hovered ? 0.55 : 0) + (name === this.selected ? 0.4 : 0);
    for (const [name, mat] of this.bodyMats) { mat.emissive.set("#ff8a9a"); mat.emissiveIntensity = boost(name); }
    for (const t of this.tracts) t.mat.uniforms.uBoost.value = boost(t.id) || (t.id.startsWith("PurkinjeFibers") ? boost("PurkinjeFibers") : 0);
  }

  // ---------------------------------------------------------------- per-frame update
  private frame() {
    if (!this.layout) return;
    const v = this.o.getVisual();
    const m = this.o.getManual?.() ?? this.manual;
    const ra = m?.ra ?? v.ra, la = m?.la ?? v.la, rv = m?.rv ?? v.rv, lv = m?.lv ?? v.lv;
    this.deform.uC.value.set(ra, la, rv, lv);
    this.deform.uTwist.value = m?.lv !== undefined ? m.lv : v.twist;
    const open = { tricuspid: v.valves.tricuspid, mitral: v.valves.mitral, pulmonary: v.valves.pulmonary, aortic: v.valves.aortic };
    for (const lf of this.leaflets) {
      const o = open[lf.valve];
      const closedAngle = lf.kind === "av" ? -0.05 : 0.0;
      lf.mesh.rotation.z = closedAngle + o * (Math.PI / 2 * 0.95 - closedAngle);
    }
    // chordae follow the leaflets
    if (this.chordaePairs.length) {
      const pos = this.chordae.geometry.attributes.position as THREE.BufferAttribute;
      const tmp = new THREE.Vector3();
      this.root.updateMatrixWorld(true);
      this.chordaePairs.forEach((c, i) => {
        tmp.copy(c.local); c.leaflet.mesh.localToWorld(tmp);
        pos.setXYZ(i * 2, c.tip.x, c.tip.y, c.tip.z);
        pos.setXYZ(i * 2 + 1, tmp.x, tmp.y, tmp.z);
      });
      pos.needsUpdate = true;
    }
    if (this.conductionOn) {
      for (const n of this.nodes) { const g = n.glow(v); n.mat.emissiveIntensity = 0.35 + 2.4 * g + (n.id === this.hovered ? 0.8 : 0) + (n.id === this.selected ? 0.8 : 0); n.mesh.scale.setScalar(1 + 0.35 * g); }
      for (const t of this.tracts) t.mat.uniforms.uProg.value = t.progress(v);
      const now = performance.now() / 1000;
      for (const b of this.blockMarkers) { const on = v.blocked.includes(b.edge); b.sprite.visible = on; if (on) b.sprite.scale.setScalar(0.28 + 0.05 * Math.sin(now * 6)); }
    }
  }

  dispose() {
    this.disposed = true;
    this.unsub();
    const dom = this.stage.domElement;
    dom.removeEventListener("pointermove", this.onMove);
    dom.removeEventListener("pointerleave", this.onLeave);
    dom.removeEventListener("pointerdown", this.onDown);
    dom.removeEventListener("pointerup", this.onUp);
    this.tip.el.remove();
    this.stage.dispose();
  }
}
export { HEART_REGION_NAMES };
