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

  function drawSpectrum(d: DrawInfo) {
    const { ctx, frame, size, cx, cy } = d;
    const g = spectrumGeometry(d.settings, d.width, size, d.dpr, spectrum);
    const drift = d.time * d.settings.color.speed * 0.1;
    const bands = frame.bands;
    const boost = 0.85 + 0.15 * frame.beat;
    ctx.lineCap = "round";
    for (let j = 0; j < g.bars; j++) {
      // a gentle curve so quiet bands still read
      const v = Math.pow(Math.min(1, bands[j] * boost), 0.7);
      // outer bars fade a little so the ends taper off
      const fade = 1 - 0.45 * (j / g.bars) * (j / g.bars);
      // round caps add half a width at each end, take it back so tiny bars stay tiny
      const half = Math.max(0, g.minHalf + g.maxHalf * v - g.barWidth / 2);
      const x = g.inner + g.slot * j;
      ctx.beginPath();
      ctx.moveTo(cx - x, cy - half);
      ctx.lineTo(cx - x, cy + half);
      ctx.moveTo(cx + x, cy - half);
      ctx.lineTo(cx + x, cy + half);

      const t = (j / g.bars) * 0.6 + drift;
      ctx.lineWidth = g.barWidth + g.slot * 0.9 + size * 0.004;
      ctx.strokeStyle = d.css(t, (0.06 + 0.1 * v) * fade);
      ctx.stroke();
      ctx.lineWidth = g.barWidth;
      ctx.strokeStyle = d.css(t, (0.65 + 0.35 * v) * fade);
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
