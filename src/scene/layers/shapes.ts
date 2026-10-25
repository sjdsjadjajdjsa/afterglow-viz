import {
  bandAverage,
  clearance,
  createRingGeometry,
  createSpectrumGeometry,
  ringGeometry,
  spectrumGeometry,
} from "../shapes/geometry";
import type { DrawInfo, Layer } from "../types";

const STEPS = 160;
const TAU = Math.PI * 2;

export function createShapesLayer(): Layer {
  const rings = createRingGeometry();
  const spectrum = createSpectrumGeometry();
  const cos = new Float32Array(STEPS);
  const sin = new Float32Array(STEPS);
  for (let k = 0; k < STEPS; k++) {
    cos[k] = Math.cos((k / STEPS) * TAU);
    sin[k] = Math.sin((k / STEPS) * TAU);
  }

  function drawRings(d: DrawInfo) {
    const { ctx, frame, size } = d;
    const g = ringGeometry(d.settings, size, d.dpr, rings);
    const drift = d.time * d.settings.color.speed * 0.1;
    const bands = frame.bands;
    const clear = clearance(d.settings, size);
    ctx.lineJoin = "round";
    for (let i = 0; i < g.count; i++) {
      const start = g.bandStart[i];
      const end = g.bandEnd[i];
      const mid = (start + end) >> 1;
      const e = bandAverage(bands, start, end);
      const depth = g.count > 1 ? i / (g.count - 1) : 0;
      // scaling with the radius keeps rings in order, inner rings still kick a bit harder
      const r = g.radius[i] * (1 + 0.05 * frame.level + 0.08 * (1 - 0.5 * depth) * frame.beat) + g.gap * 0.4 * e;
      const amp = (size * 0.014 + g.gap * 0.35) * (0.4 + e);
      const lobes = 2 + (i % 4);
      const dir = i % 2 ? -1 : 1;
      const p0 = d.time * 0.35 * dir + i * 1.7;
      const p1 = -d.time * 0.23 * dir + i * 0.9;
      const p2 = d.time * 0.51 * dir + i * 2.3;
      let a0 = amp * Math.sqrt(bands[start]);
      let a1 = amp * 0.6 * Math.sqrt(bands[mid]);
      let a2 = amp * 0.35 * Math.sqrt(bands[end - 1]);
      // never dip into the centerpiece
      const room = r - clear;
      const total = a0 + a1 + a2;
      if (total > room) {
        const k = room > 0 ? room / total : 0;
        a0 *= k;
        a1 *= k;
        a2 *= k;
      }

      ctx.beginPath();
      for (let k = 0; k < STEPS; k++) {
        const th = (k / STEPS) * TAU;
        const rr =
          r + a0 * Math.sin(lobes * th + p0) + a1 * Math.sin((lobes + 2) * th + p1) + a2 * Math.sin((2 * lobes + 1) * th + p2);
        const x = d.cx + rr * cos[k];
        const y = d.cy + rr * sin[k];
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const t = i / g.count + drift;
      const w = g.lineWidth * (1 + 0.6 * e + 0.4 * frame.beat * (1 - depth));
      ctx.lineWidth = w * 2.5 + size * 0.012;
      ctx.strokeStyle = d.css(t, 0.05 + 0.08 * e);
      ctx.stroke();
      ctx.lineWidth = w * 1.6;
      ctx.strokeStyle = d.css(t, 0.14 + 0.18 * e);
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = d.css(t, 0.6 + 0.4 * e);
      ctx.stroke();
    }
  }

  // per bar, filled in a first pass so the halo can go down before the bars
  const barHalf = new Float32Array(64);
  const barLevel = new Float32Array(64);
  let glowA: HTMLCanvasElement | null = null;
  let glowB: HTMLCanvasElement | null = null;

  function drawSpectrum(d: DrawInfo) {
    const { ctx, frame, size, cx, cy } = d;
    const g = spectrumGeometry(d.settings, d.width, size, d.dpr, spectrum);
    const drift = d.time * d.settings.color.speed * 0.1;
    const bands = frame.bands;
    const boost = 0.85 + 0.15 * frame.beat;
    const n = Math.min(g.bars, barHalf.length);
    for (let j = 0; j < n; j++) {
      // a gentle curve so quiet bands still read
      const v = Math.pow(Math.min(1, bands[j] * boost), 0.7);
      barLevel[j] = v;
      // round caps add half a width at each end, take it back so tiny bars stay tiny
      barHalf[j] = Math.max(0, g.minHalf + g.maxHalf * v - g.barWidth / 2);
    }
    const fadeAt = (j: number) => 1 - 0.45 * (j / g.bars) * (j / g.bars);
    const hueAt = (j: number) => (j / g.bars) * 0.6 + drift;
    const path = (c: CanvasRenderingContext2D, j: number) => {
      const x = g.inner + g.slot * j;
      const half = barHalf[j];
      c.beginPath();
      c.moveTo(cx - x, cy - half);
      c.lineTo(cx - x, cy + half);
      c.moveTo(cx + x, cy - half);
      c.lineTo(cx + x, cy + half);
    };

    // soft halo like the rings have: the bars drawn small, blurred, and laid
    // underneath scaled back up. blur spreads the same way on every side, so
    // the ends look like the sides
    if (typeof document !== "undefined") {
      const gw = Math.max(1, Math.ceil(d.width / 4));
      const gh = Math.max(1, Math.ceil(d.height / 4));
      glowA ??= document.createElement("canvas");
      glowB ??= document.createElement("canvas");
      for (const c of [glowA, glowB]) {
        if (c.width !== gw || c.height !== gh) {
          c.width = gw;
          c.height = gh;
        }
      }
      const a = glowA.getContext("2d");
      const b = glowB.getContext("2d");
      if (a && b) {
        a.setTransform(1, 0, 0, 1, 0, 0);
        a.clearRect(0, 0, gw, gh);
        a.setTransform(gw / d.width, 0, 0, gh / d.height, 0, 0);
        a.lineCap = "round";
        a.lineWidth = g.barWidth * 1.4 + size * 0.004;
        for (let j = 0; j < n; j++) {
          path(a, j);
          a.strokeStyle = d.css(hueAt(j), (0.3 + 0.4 * barLevel[j]) * fadeAt(j));
          a.stroke();
        }
        b.clearRect(0, 0, gw, gh);
        b.filter = `blur(${Math.max(1, (size / 4) * 0.012)}px)`;
        b.drawImage(glowA, 0, 0);
        b.filter = "none";
        ctx.drawImage(glowB, 0, 0, d.width, d.height);
      }
    }

    ctx.lineCap = "round";
    for (let j = 0; j < n; j++) {
      const v = barLevel[j];
      const fade = fadeAt(j);
      const t = hueAt(j);
      path(ctx, j);
      ctx.lineWidth = Math.min(g.barWidth * 1.6, g.slot * 0.85);
      ctx.strokeStyle = d.css(t, (0.14 + 0.18 * v) * fade);
      ctx.stroke();
      ctx.lineWidth = g.barWidth;
      ctx.strokeStyle = d.css(t, (0.6 + 0.4 * v) * fade);
      ctx.stroke();
    }
  }

  return {
    draw(d: DrawInfo) {
      const shape = d.settings.shape;
      if (shape === "rings" || shape === "both") drawRings(d);
      if (shape === "spectrum" || shape === "both") drawSpectrum(d);
    },
  };
}
