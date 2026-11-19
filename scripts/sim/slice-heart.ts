// Quick 2-D preview of the heart field at the cut plane and at z offsets: node scripts/sim/slice-heart.ts out.png [z]
import sharp from "sharp";
import { heartField, lumen, solidOuter, lumenLeft, regionAt, HEART_BOUNDS } from "../../src/components/sim3d/heart/anatomy.ts";
const out = process.argv[2] ?? "/tmp/heart-slice.png";
const zs = (process.argv[3] ?? "-0.001,-0.2,-0.4,-0.7").split(",").map(Number);
const W = 380, H = 480;
const { lo, hi } = HEART_BOUNDS;
const buf = Buffer.alloc(W * H * zs.length * 3);
const PAL: Record<string, [number, number, number]> = { LV: [200, 40, 60], RV: [60, 90, 220], RA: [90, 120, 235], LA: [230, 80, 100], SEPTUM: [170, 70, 120], SVC: [110, 140, 255], IVC: [80, 100, 200], PT: [100, 160, 255], AO: [255, 90, 70], PV: [255, 130, 130] };
zs.forEach((z, zi) => {
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = lo[0] + (i / (W - 1)) * (hi[0] - lo[0]);
    const y = hi[1] - (j / (H - 1)) * (hi[1] - lo[1]);
    const p: [number, number, number] = [x, y, z];
    const f = heartField([x, y, Math.min(z, 0) - 0.0] as [number, number, number]);
    const lum = lumen(p), sol = solidOuter(p);
    let c: [number, number, number] = [10, 12, 22];
    if (f < 0) { c = PAL[regionAt(p)]; } else if (lum < 0) { c = lumenLeft(p) < 0 ? [60, 20, 28] : [18, 26, 60]; }
    const o = ((zi * H + j) * W + i) * 3;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
    void sol;
  }
});
await sharp(buf, { raw: { width: W, height: H * zs.length, channels: 3 } }).resize(W * 2, H * zs.length * 2, { kernel: "nearest" }).png().toFile(out);
console.log("wrote", out);
