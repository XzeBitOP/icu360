import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BAKE_VERSION, loadBake } from "../bakeLoader";
import { createStage, type Stage } from "../stage";
import { makePin, makeTooltip, mergedTubes, tubeGeometry, type PartInfo } from "../shared";
import { LOBES, LOBE_HILUM, LOBE_NAMES, LOBE_TITLES, type LobeId } from "./anatomy";
import { ETT_PATH, LOBAR_ORIGIN, MAIN_BRONCHI, MAX_GEN, TRACHEA, airwayRadius, generateAirways } from "./airways";
import { LUNG_INFO } from "./info";
import type { LungVisual } from "@/sim/vent";

export type LungSceneOptions = {
  container: HTMLElement;
  /** Display state read from the simulation engine every frame. */
  getVisual: () => LungVisual;
  /** Current ventilator settings (FiO2 brightens the alveoli; PEEP is read for the label only). */
  getSettings: () => { fio2: number; peepCmH2O: number };
  low?: boolean;
  onSelect?: (info: PartInfo | null) => void;
};

const V3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const lobeIdByName = Object.fromEntries(LOBES.map((l) => [LOBE_NAMES[l], l])) as Record<string, LobeId>;

type LobeObj = { id: LobeId; group: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; alv: THREE.InstancedMesh; alvMat: THREE.MeshStandardMaterial; uOpen: { value: number }; uAer: { value: number }; scale: number; open: number; tree: THREE.Mesh[] };

export class LungScene {
  readonly stage: Stage;
  readonly ready: Promise<void>;
  private root = new THREE.Group();
  private lobes = new Map<LobeId, LobeObj>();
  private hitMeshes: THREE.Mesh[] = [];
  private pins: CSS2DObject[] = [];
  private labelsOn = true;
  private diaphragm!: THREE.Mesh;
  private ettMat!: THREE.MeshPhysicalMaterial;
  private particles!: THREE.Points;
  private pData: { path: THREE.Vector3[]; lobe: LobeId; s: number; v: number }[] = [];
  private paths = new Map<LobeId, THREE.Vector3[]>();
  private pMat!: THREE.PointsMaterial;
  private hovered: string | null = null;
  private selected: string | null = null;
  private tip: ReturnType<typeof makeTooltip>;
  private raycaster = new THREE.Raycaster();
  private unsub: () => void;
  private disposed = false;
  private lastRay = 0;
  private ptr = { x: 0, y: 0, down: false, sx: 0, sy: 0 };
  private o: LungSceneOptions;
  private lastFlowSign = 0;
  private diaY = -3.3;

  constructor(o: LungSceneOptions) {
    this.o = o;
    const w = o.container.clientWidth || 360, h = o.container.clientHeight || 480;
    const aspect = w / h;
    const dist = Math.min(28, Math.max(12.8, 11.4 / Math.max(aspect, 0.45)));
    this.stage = createStage(o.container, { camera: [0, 2.2, dist], target: [0, 0.3, 0], low: o.low, minDistance: 5, maxDistance: 26 });
    this.stage.scene.add(this.root);
    this.root.name = "lungGroup";
    this.tip = makeTooltip(o.container);
    this.ready = this.build();
    this.unsub = this.stage.onFrame((dt) => this.frame(dt));
    const dom = this.stage.domElement;
    dom.addEventListener("pointermove", this.onMove);
    dom.addEventListener("pointerleave", this.onLeave);
    dom.addEventListener("pointerdown", this.onDown);
    dom.addEventListener("pointerup", this.onUp);
  }

  private info(id: string): PartInfo {
    const base = LUNG_INFO[id];
    if (!base) return { id, name: id, physiology: "" };
    if ((LOBES as string[]).includes(id)) {
      const l = this.lobes.get(id as LobeId);
      const v = this.o.getVisual().lobes.find((x) => x.id === id);
      if (l && v) {
        const state = v.excluded ? "excluded from ventilation (isolated)" : v.aeration < 0.95 ? `partly collapsed (aeration ${Math.round(v.aeration * 100)}%)` : v.open ? "open" : "closed (derecruited)";
        return { ...base, physiology: `${base.physiology} Now: ${state}; ${Math.round(v.volumeMl)} mL above relaxed volume.` };
      }
    }
    return base;
  }

  // ------------------------------------------------------------------ build
  private async build() {
    const [bakes, hits] = await Promise.all([loadBake(`/sim/lung.bin?v=${BAKE_VERSION}`), loadBake(`/sim/lung-hit.bin?v=${BAKE_VERSION}`)]);
    if (this.disposed) return;
    this.buildAirway();
    this.buildLobes(bakes, hits);
    this.buildDiaphragm();
    this.buildParticles();
    this.buildPins();
  }

  private buildAirway() {
    const cartilage = new THREE.MeshPhysicalMaterial({ color: "#f3e7da", roughness: 0.45, clearcoat: 0.4, transparent: true, opacity: 0.95 });
    const wall = new THREE.MeshPhysicalMaterial({ color: "#f0b9b0", roughness: 0.5, clearcoat: 0.3, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    const cap = (info: PartInfo, mesh: THREE.Object3D) => { mesh.userData = info; mesh.name = info.id; };
    // trachea: translucent membranous tube + 16 C-shaped cartilage rings (open posteriorly, towards -z)
    const top = V3(TRACHEA.top), car = V3(TRACHEA.carina);
    const trach = new THREE.Group();
    const length = top.y - car.y;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(TRACHEA.radius, TRACHEA.radius * 0.98, length, 28, 1, true), wall);
    tube.position.set(0, (top.y + car.y) / 2, TRACHEA.top[2]);
    cap(LUNG_INFO.Trachea, tube);
    trach.add(tube);
    const ringGeo = new THREE.TorusGeometry(TRACHEA.radius + 0.01, 0.032, 8, 26, Math.PI * 1.62);
    ringGeo.rotateZ(Math.PI / 2 - (Math.PI * 1.62) / 2 + Math.PI / 2); // centre the C so the gap faces -z after the x-rotation below
    ringGeo.rotateX(Math.PI / 2);
    const nRings = 16;
    for (let i = 0; i < nRings; i++) {
      const ring = new THREE.Mesh(ringGeo, cartilage);
      ring.position.set(0, car.y + 0.12 + (i / (nRings - 1)) * (length - 0.24), TRACHEA.top[2]);
      cap(LUNG_INFO.Trachea, ring);
      trach.add(ring);
    }
    this.root.add(trach);
    this.addHit("Trachea", new THREE.CylinderGeometry(TRACHEA.radius + 0.05, TRACHEA.radius + 0.05, length, 10, 1, true), tube.position);
    // carina: a smooth ridge
    const carinaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshPhysicalMaterial({ color: "#e8a8a0", roughness: 0.35, clearcoat: 0.6, emissive: new THREE.Color("#000000") }));
    carinaMesh.scale.set(1, 0.6, 1.4);
    carinaMesh.position.set(0, TRACHEA.carina[1] - 0.04, TRACHEA.carina[2]);
    cap(LUNG_INFO.Carina, carinaMesh);
    this.root.add(carinaMesh);
    this.addHit("Carina", new THREE.SphereGeometry(0.3, 8, 6), carinaMesh.position);
    this.carina = carinaMesh;

    // main bronchi (+ lobar bronchi up to each hilum), each as a tube with a few cartilage arcs
    const mainMat = new THREE.MeshPhysicalMaterial({ color: "#f0c8bd", roughness: 0.45, clearcoat: 0.4, emissive: new THREE.Color("#000000") });
    this.mainMat = mainMat;
    for (const side of ["R", "L"] as const) {
      const id = side === "R" ? "RightMainstemBronchus" : "LeftMainstemBronchus";
      const pts = MAIN_BRONCHI[side].map(V3);
      const geo = tubeGeometry(pts, 0.19, pts.map((_, i) => i / (pts.length - 1)), 14);
      const mesh = new THREE.Mesh(geo, mainMat.clone());
      cap(LUNG_INFO[id], mesh);
      mesh.userData = LUNG_INFO[id];
      this.root.add(mesh);
      this.hitMeshes.push(Object.assign(new THREE.Mesh(tubeGeometry(pts, 0.28, pts.map((_, i) => i / (pts.length - 1)), 6), new THREE.MeshBasicMaterial({ visible: false })), { userData: { hitFor: id, ...LUNG_INFO[id] }, name: id }));
      this.root.add(this.hitMeshes[this.hitMeshes.length - 1]);
      this.parts[id] = mesh;
    }

    // ETT
    const ettPts = ETT_PATH.map(V3);
    this.ettMat = new THREE.MeshPhysicalMaterial({ color: "#5aa7ff", roughness: 0.18, clearcoat: 1, transparent: true, opacity: 0.55, emissive: new THREE.Color("#0b3a7a"), emissiveIntensity: 0.25, depthWrite: false });
    const ett = new THREE.Mesh(tubeGeometry(ettPts, 0.145, ettPts.map((_, i) => i / (ettPts.length - 1)), 16), this.ettMat);
    cap(LUNG_INFO.EndotrachealTube, ett);
    this.root.add(ett);
    const cuff = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: "#8fcbff", roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.75, emissive: new THREE.Color("#2b7fd8"), emissiveIntensity: 0.45, depthWrite: false }));
    cuff.scale.set(TRACHEA.radius * 0.97, 0.3, TRACHEA.radius * 0.97);
    cuff.position.set(0, 2.5, TRACHEA.top[2]);
    cap(LUNG_INFO.EndotrachealTube, cuff);
    this.root.add(cuff);
    const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 20), new THREE.MeshPhysicalMaterial({ color: "#2e6fd1", roughness: 0.3, clearcoat: 0.8 }));
    conn.position.copy(ettPts[ettPts.length - 1]);
    conn.rotation.z = -Math.PI / 2 + 0.2;
    cap(LUNG_INFO.EndotrachealTube, conn);
    this.root.add(conn);
    this.parts.EndotrachealTube = ett;
    this.addHit("EndotrachealTube", tubeGeometry(ettPts, 0.3, ettPts.map((_, i) => i / (ettPts.length - 1)), 6), new THREE.Vector3());
    // world-space paths used by the airflow particles
    const trunk = [V3(ETT_PATH[0]), V3([0, 1.5, -0.08]), car];
    for (const id of LOBES) {
      const side = id.startsWith("R") ? "R" : "L";
      const mainPts = MAIN_BRONCHI[side].map(V3);
      this.paths.set(id, [...trunk, ...mainPts.slice(1), V3(LOBAR_ORIGIN[id]), V3(LOBE_HILUM[id])]);
    }
    // lobar bronchi (main bronchus → hilum), unscaled
    for (const id of LOBES) {
      const a = V3(LOBAR_ORIGIN[id]), b = V3(LOBE_HILUM[id]);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0, 0));
      const g = tubeGeometry([a, mid, b], airwayRadius(0) * 1.15, [0, 0.5, 1], 10);
      const m = new THREE.Mesh(g, mainMat);
      m.name = "LobarBronchus";
      m.userData = LUNG_INFO.BronchialTree;
      this.root.add(m);
    }
  }
  private carina!: THREE.Mesh;
  private mainMat!: THREE.MeshPhysicalMaterial;
  readonly parts: Record<string, THREE.Object3D> = {};

  private addHit(id: string, geo: THREE.BufferGeometry, pos: THREE.Vector3) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(pos);
    m.name = id;
    m.userData = { hitFor: id, ...LUNG_INFO[id] };
    this.root.add(m);
    this.hitMeshes.push(m);
  }

  private buildLobes(bakes: Awaited<ReturnType<typeof loadBake>>, hits: Awaited<ReturnType<typeof loadBake>>) {
    const low = !!this.o.low;
    const clusterGeo = (() => {
      const geos: THREE.BufferGeometry[] = [];
      const offs: [number, number, number, number][] = [[0, 0, 0, 1], [0.8, 0.2, 0.1, 0.78], [-0.6, 0.5, -0.3, 0.74], [0.1, -0.7, 0.4, 0.8], [-0.2, 0.15, 0.85, 0.7]];
      const pos: number[] = [], nor: number[] = [], idx: number[] = [];
      let base = 0;
      for (const [x, y, z, r] of offs) {
        const g = new THREE.IcosahedronGeometry(0.075 * r, low ? 0 : 1);
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i) + x * 0.075, p.getY(i) + y * 0.075, p.getZ(i) + z * 0.075); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
        const ix = g.index;
        if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
        base += p.count; geos.push(g);
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      out.setIndex(idx);
      geos.forEach((g) => g.dispose());
      return out;
    })();
    const treeMat = new THREE.MeshPhysicalMaterial({ color: "#f4d9c9", roughness: 0.4, clearcoat: 0.5, emissive: new THREE.Color("#000000") });
    const clusterTarget = low ? 20 : 34;
    for (const b of bakes) {
      const id = lobeIdByName[b.name];
      if (!id) continue;
      const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color("#000000"), sheen: 0.4, sheenColor: new THREE.Color("#ffc1cc") });
      const mesh = new THREE.Mesh(b.geometry, mat);
      mesh.name = b.name; mesh.renderOrder = 3;
      mesh.userData = { ...LUNG_INFO[id] };
      const group = new THREE.Group();
      group.name = `${id}Group`;
      group.add(mesh);
      // bronchial tree inside the lobe (one merged mesh per generation)
      const air = generateAirways(id);
      const tree: THREE.Mesh[] = [];
      for (let gen = 0; gen <= MAX_GEN; gen++) {
        const segs = air.segments.filter((s) => s.gen === gen).map((s) => ({ pts: [s.a, s.b] as [number, number, number][], s: [0, 1] }));
        if (!segs.length) continue;
        const m = new THREE.Mesh(mergedTubes(segs, airwayRadius(gen), gen < 3 ? 8 : 5), treeMat);
        m.name = `${id}Bronchi${gen}`; m.userData = LUNG_INFO.BronchialTree; m.renderOrder = 1;
        group.add(m); tree.push(m);
      }
      // alveolar clusters at terminal bronchioles
      const terms = air.terminals.slice(0, clusterTarget);
      const alvMat = new THREE.MeshStandardMaterial({ color: "#ff7684", roughness: 0.35, metalness: 0, emissive: new THREE.Color("#ff2d4a"), emissiveIntensity: 0.5, transparent: true, opacity: 0.95 });
      const uOpen = { value: 1 }, uAer = { value: 1 };
      alvMat.onBeforeCompile = (sh) => {
        sh.uniforms.uOpen = uOpen; sh.uniforms.uAer = uAer;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uOpen; uniform float uAer; attribute float aIdx;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat vis = 1.0 - smoothstep(uAer - 0.02, uAer + 0.06, aIdx);\ntransformed *= mix(0.42, 1.0, uOpen) * vis;");
      };
      alvMat.customProgramCacheKey = () => "alv";
      const alv = new THREE.InstancedMesh(clusterGeo, alvMat, terms.length);
      const idxAttr = new Float32Array(terms.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      terms.forEach((t, i) => {
        e.set(i * 1.3, i * 2.1, i * 0.7); q.setFromEuler(e);
        const s = 1.1 + 0.5 * ((i * 37) % 10) / 10;
        m4.compose(new THREE.Vector3(t[0], t[1], t[2]), q, new THREE.Vector3(s, s, s));
        alv.setMatrixAt(i, m4);
        idxAttr[i] = terms.length > 1 ? ((i * 7919) % terms.length) / (terms.length - 1) : 0;
      });
      clusterGeoAttr(alv, idxAttr);
      alv.name = `${id}Alveoli`; alv.renderOrder = 2; alv.frustumCulled = false;
      alv.userData = { ...LUNG_INFO.AlveolarClusters };
      group.add(alv);
      this.root.add(group);
      this.lobes.set(id, { id, group, mesh, mat, alv, alvMat, uOpen, uAer, scale: 1, open: 1, tree });
      this.parts[b.name] = mesh;
    }
    for (const h of hits) {
      const id = lobeIdByName[h.name];
      if (!id) continue;
      const m = new THREE.Mesh(h.geometry, new THREE.MeshBasicMaterial({ visible: false }));
      m.name = id; m.userData = { hitFor: id, ...LUNG_INFO[id] };
      this.lobes.get(id)?.group.add(m);
      this.hitMeshes.push(m);
    }
  }

  private buildDiaphragm() {
    const geo = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#8c2f3c", roughness: 0.6, clearcoat: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: new THREE.Color("#000000") }));
    m.scale.set(3.3, 1.25, 1.95);
    m.position.set(0, -3.3, 0);
    m.name = "Diaphragm"; m.userData = LUNG_INFO.Diaphragm;
    this.diaphragm = m;
    this.root.add(m);
    this.parts.Diaphragm = m;
    this.hitMeshes.push(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false })), { name: "Diaphragm", userData: { hitFor: "Diaphragm", ...LUNG_INFO.Diaphragm } }));
    const hit = this.hitMeshes[this.hitMeshes.length - 1];
    hit.scale.copy(m.scale); hit.position.copy(m.position); hit.visible = true;
    this.hitDia = hit;
    this.root.add(hit);
  }
  private hitDia!: THREE.Mesh;

  private buildParticles() {
    const n = this.o.low ? 70 : 150;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const lobe = LOBES[i % LOBES.length];
      this.pData.push({ path: this.paths.get(lobe)!, lobe, s: Math.random(), v: 0.75 + Math.random() * 0.5 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.pMat = new THREE.PointsMaterial({ size: 0.11, color: "#a9e0ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.particles = new THREE.Points(g, this.pMat);
    this.particles.frustumCulled = false; this.particles.renderOrder = 6; this.particles.name = "AirflowParticles";
    this.root.add(this.particles);
    // cumulative arc lengths per path
    this.arc = new Map();
    for (const [lobe, path] of this.paths) {
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
      this.arc.set(lobe, cum);
    }
  }
  private arc = new Map<LobeId, number[]>();

  private buildPins() {
    const add = (label: string, p: THREE.Vector3 | number[], dx: number, dy: number, kind: string, id: string) => {
      const o = new CSS2DObject(makePin(label, dx, dy, kind, `pin-${id}`));
      o.position.copy(Array.isArray(p) ? V3(p) : p);
      this.root.add(o);
      this.pins.push(o);
    };
    add("Endotracheal tube", [0.05, 3.45, -0.08], 64, -22, "lung", "ett");
    add("Cuff", [0.0, 2.5, -0.08], -52, -14, "lung", "cuff");
    add("Trachea", [0, 1.6, -0.08], -52, 4, "lung", "trachea");
    add("Carina", [0, 0.9, -0.08], 4, -46, "lung", "carina");
    add("Right main bronchus", [-0.45, 0.6, -0.1], -92, -34, "lung", "rmb");
    add("Left main bronchus", [0.7, 0.62, -0.1], 92, -34, "lung", "lmb");
    add("Bronchial tree", [-1.55, 0.25, -0.1], -42, -12, "lung", "tree");
    add("Alveoli", [1.9, 0.3, -0.1], 42, -22, "lung", "alveoli");
    add("Diaphragm", [2.3, -2.25, 0.4], 42, 24, "lung", "diaphragm");
    add("RUL", [-1.7, 1.55, 0.5], -40, -16, "lung", "rul");
    add("RML", [-2.0, -0.45, 0.8], -42, 10, "lung", "rml");
    add("RLL", [-1.9, -1.45, 0.7], -40, 20, "lung", "rll");
    add("LUL", [1.8, 1.55, 0.5], 40, -16, "lung", "lul");
    add("LLL", [1.9, -1.45, 0.7], 40, 20, "lung", "lll");
    this.refreshPins();
  }

  setLabels(on: boolean) { this.labelsOn = on; this.refreshPins(); }
  private refreshPins() { for (const p of this.pins) p.element.style.display = this.labelsOn ? "" : "none"; }

  // ------------------------------------------------------------------ interaction
  private pick(clientX: number, clientY: number): PartInfo | null {
    const r = this.stage.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const alv = [...this.lobes.values()].map((l) => l.alv);
    const tubes = this.root.children.filter((c) => c.userData && ["EndotrachealTube", "Carina"].includes((c.userData as PartInfo).id) && (c as THREE.Mesh).isMesh && (c as THREE.Mesh).material && ((c as THREE.Mesh).material as THREE.Material).visible !== false);
    const targets: THREE.Object3D[] = [...this.hitMeshes.filter((h) => h !== this.hitDia), ...alv, this.diaphragm, ...tubes];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    const first = hits[0];
    const small = hits.find((h) => !!h.object.userData.hitFor && !(LOBES as string[]).includes(h.object.userData.hitFor) && h.object.userData.hitFor !== "Diaphragm") ?? hits.find((h) => h.object instanceof THREE.InstancedMesh);
    const chosen = small && small.distance < first.distance + 2.5 ? small : first;
    const ud = chosen.object.userData as PartInfo & { hitFor?: string };
    const id = ud.hitFor ?? ud.id;
    return this.info(id === "AlveolarClusters" ? "AlveolarClusters" : id);
  }
  private onMove = (e: PointerEvent) => {
    const r = this.stage.domElement.getBoundingClientRect();
    this.ptr.x = e.clientX - r.left; this.ptr.y = e.clientY - r.top;
    if (e.pointerType === "touch") return;
    const now = performance.now();
    if (now - this.lastRay < 60) return;
    this.lastRay = now;
    this.setHover(this.pick(e.clientX, e.clientY));
  };
  private onLeave = () => this.setHover(null);
  private onDown = (e: PointerEvent) => { this.ptr.down = true; this.ptr.sx = e.clientX; this.ptr.sy = e.clientY; };
  private onUp = (e: PointerEvent) => {
    if (!this.ptr.down) return;
    this.ptr.down = false;
    if (Math.hypot(e.clientX - this.ptr.sx, e.clientY - this.ptr.sy) > 6) return;
    const r = this.stage.domElement.getBoundingClientRect();
    const p = this.pick(e.clientX, e.clientY);
    this.selected = p?.id ?? null;
    this.o.onSelect?.(p);
    if (p) { this.hovered = p.id; this.tip.show(p, e.clientX - r.left, e.clientY - r.top); if (e.pointerType === "touch") window.setTimeout(() => { if (!this.disposed) this.tip.hide(); }, 3500); }
    this.applyHighlight();
  };
  private setHover(p: PartInfo | null) {
    const id = p?.id ?? null;
    if (p) this.tip.show(p, this.ptr.x, this.ptr.y); else this.tip.hide();
    if (id === this.hovered) return;
    this.hovered = id;
    this.stage.domElement.style.cursor = p ? "pointer" : "grab";
    this.applyHighlight();
  }
  private applyHighlight() {
    const boost = (id: string) => (id === this.hovered ? 0.45 : 0) + (id === this.selected ? 0.3 : 0);
    for (const l of this.lobes.values()) { l.mat.emissive.set("#ff9aa8"); l.mat.emissiveIntensity = boost(l.id); }
    const set = (m: THREE.Mesh | undefined, v: number) => { const mat = m?.material as THREE.MeshPhysicalMaterial | undefined; if (mat?.emissive) { mat.emissive.set("#9fd0ff"); mat.emissiveIntensity = v; } };
    set(this.parts.RightMainstemBronchus as THREE.Mesh, boost("RightMainstemBronchus"));
    set(this.parts.LeftMainstemBronchus as THREE.Mesh, boost("LeftMainstemBronchus"));
    set(this.carina, boost("Carina"));
    set(this.diaphragm, boost("Diaphragm"));
    if (this.ettMat) this.ettMat.emissiveIntensity = 0.25 + boost("EndotrachealTube");
    const tb = boost("BronchialTree");
    for (const l of this.lobes.values()) for (const m of l.tree) { const mat = m.material as THREE.MeshPhysicalMaterial; mat.emissive.set("#ffd9a0"); mat.emissiveIntensity = tb; }
  }

  // ------------------------------------------------------------------ per-frame
  private frame(dtMs: number) {
    if (this.lobes.size === 0 || !this.particles) return;
    const dt = Math.min(dtMs, 80) / 1000;
    const v = this.o.getVisual();
    const { fio2 } = this.o.getSettings();
    const tmp = new THREE.Color();
    let vtRef = 0.5;
    for (const lv of v.lobes) {
      const l = this.lobes.get(lv.id);
      if (!l) continue;
      // lobe size from the engine's lobe volume; ×~3 exaggeration so the breathing is visible (labelled in the UI)
      const collapse = lv.excluded ? 0.76 : 0.72 + 0.28 * Math.min(1, lv.aeration);
      const target = collapse * (0.95 + 0.9 * lv.volumeMl / 1000);
      l.scale += (target - l.scale) * Math.min(1, dt * 14);
      l.group.scale.setScalar(l.scale);
      const h = LOBE_HILUM[lv.id];
      l.group.position.set(h[0] * (1 - l.scale), h[1] * (1 - l.scale), h[2] * (1 - l.scale));
      // tint: atelectatic / consolidated lobes go dusky blue-violet, excluded ones greyer
      const dusk = lv.excluded ? 0.8 : 1 - Math.min(1, lv.aeration);
      tmp.set("#ffffff").lerp(new THREE.Color("#7a6fb3"), dusk * 0.85);
      l.mat.color.copy(tmp);
      l.mat.opacity = 0.58 + 0.2 * dusk;
      // alveoli: recruited (open) vs derecruited, aeration decides how many clusters are ventilated; FiO2 sets brightness
      l.open += ((lv.open && !lv.excluded ? 1 : 0) - l.open) * Math.min(1, dt * 4);
      l.uOpen.value = l.open;
      l.uAer.value = lv.excluded ? 0 : Math.min(1, lv.aeration) * 1.02;
      const f = Math.min(1, Math.max(0, (fio2 - 0.21) / 0.79));
      l.alvMat.emissiveIntensity = 0.12 + 1.0 * f;
      l.alvMat.color.set("#9a3a55").lerp(tmp.set("#ff8392"), f);
      vtRef = Math.max(vtRef, v.volumeL);
    }
    // diaphragm descends with inspired volume
    const dTarget = -3.3 - 0.34 * Math.min(1.4, v.volumeL / Math.max(0.35, this.vtGuess(v)));
    this.diaY += (dTarget - this.diaY) * Math.min(1, dt * 14);
    this.diaphragm.position.y = this.diaY;
    this.hitDia.position.y = this.diaY;
    // airflow particles: advance along the airway paths with the engine flow
    const flow = v.flowLps;
    const mag = Math.abs(flow);
    const sign = flow > 0.01 ? 1 : flow < -0.01 ? -1 : 0;
    if (sign !== 0 && sign !== this.lastFlowSign) this.pMat.color.set(sign > 0 ? "#a9e0ff" : "#ffbe85");
    if (sign !== 0) this.lastFlowSign = sign;
    this.pMat.opacity = Math.min(0.95, mag * 2.5);
    const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    const excluded = new Set(v.lobes.filter((l) => l.excluded).map((l) => l.id));
    for (let i = 0; i < this.pData.length; i++) {
      const p = this.pData[i];
      const cum = this.arc.get(p.lobe)!;
      p.s += (flow * 0.22 * p.v * dt) % 1;
      p.s = ((p.s % 1) + 1) % 1;
      if (excluded.has(p.lobe) || mag < 0.02) { pos.setXYZ(i, 0, 100, 0); continue; }
      const dist = p.s * cum[cum.length - 1];
      let k = 1;
      while (k < cum.length - 1 && cum[k] < dist) k++;
      const t = (dist - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
      const a = p.path[k - 1], b = p.path[k];
      const j = 0.04;
      pos.setXYZ(i, a.x + (b.x - a.x) * t + Math.sin(i * 12.9 + p.s * 40) * j, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t + Math.cos(i * 7.7 + p.s * 33) * j);
    }
    pos.needsUpdate = true;
  }
  private vtRef = 0.5;
  private vtGuess(v: LungVisual) { this.vtRef = Math.max(this.vtRef * 0.9995, v.volumeL); return Math.max(0.35, this.vtRef); }

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

function clusterGeoAttr(alv: InstancedMesh, idx: Float32Array) {
  alv.geometry = alv.geometry.clone();
  alv.geometry.setAttribute("aIdx", new THREE.InstancedBufferAttribute(idx, 1));
}
type InstancedMesh = THREE.InstancedMesh;
export { LOBE_TITLES };
