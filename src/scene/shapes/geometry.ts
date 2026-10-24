import { BAND_COUNT } from "../../reactivity/types";
import type { Settings } from "../../settings";

export const MAX_RINGS = 12;

export interface RingGeometry {
  count: number;
  // resting radius of each ring, innermost first
  radius: Float32Array;
  gap: number;
  lineWidth: number;
  // bands [bandStart, bandEnd) drive each ring, inner rings get the lows
  bandStart: Uint8Array;
  bandEnd: Uint8Array;
}

export interface SpectrumGeometry {
  bars: number;
  // distance from the center to the first bar's center, and between bar centers
  inner: number;
  slot: number;
  barWidth: number;
  // half height of a bar at rest and at full band level
  minHalf: number;
  maxHalf: number;
}

export function createRingGeometry(): RingGeometry {
  return {
    count: 0,
    radius: new Float32Array(MAX_RINGS),
    gap: 0,
    lineWidth: 0,
    bandStart: new Uint8Array(MAX_RINGS),
    bandEnd: new Uint8Array(MAX_RINGS),
  };
}

export function createSpectrumGeometry(): SpectrumGeometry {
  return { bars: BAND_COUNT, inner: 0, slot: 0, barWidth: 0, minHalf: 0, maxHalf: 0 };
}

// radius the shapes keep clear for the centerpiece, with room for its pulse
export function clearance(settings: Settings, size: number): number {
  const c = settings.centerpiece;
  if (c.kind === "none") return size * 0.05;
  return size * ((0.06 + 0.16 * c.size) * (1 + 0.12 * c.pulse) + 0.025);
}

export function ringGeometry(settings: Settings, size: number, dpr: number, out: RingGeometry): RingGeometry {
  const { count, size: inner, spread, thickness } = settings.rings;
  const n = Math.max(1, Math.min(MAX_RINGS, Math.round(count) || 1));
  const gap = size * (0.012 + 0.05 * spread);
  const first = clearance(settings, size) + size * 0.22 * inner;
  out.count = n;
  out.gap = gap;
  out.lineWidth = Math.max(dpr, size * (0.0012 + 0.011 * thickness));
  for (let i = 0; i < MAX_RINGS; i++) {
    out.radius[i] = i < n ? first + gap * i : 0;
    const start = Math.floor((i * BAND_COUNT) / n);
    const end = Math.floor(((i + 1) * BAND_COUNT) / n);
    out.bandStart[i] = i < n ? start : 0;
    out.bandEnd[i] = i < n ? Math.max(start + 1, end) : 0;
  }
  return out;
}

export function spectrumGeometry(settings: Settings, width: number, size: number, dpr: number, out: SpectrumGeometry): SpectrumGeometry {
  const { size: height, spread, thickness } = settings.spectrum;
  const start = clearance(settings, size);
  const narrow = start + size * 0.2;
  const wide = Math.max(narrow, width * 0.48);
  const end = narrow + (wide - narrow) * spread;
  const slot = (end - start) / BAND_COUNT;
  out.bars = BAND_COUNT;
  out.inner = start + slot / 2;
  out.slot = slot;
  out.barWidth = Math.max(dpr, slot * (0.12 + 0.83 * thickness));
  out.minHalf = Math.max(dpr, size * 0.004);
  out.maxHalf = size * (0.04 + 0.36 * height);
  return out;
}

// average of bands [start, end)
export function bandAverage(bands: ArrayLike<number>, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += bands[i];
  return end > start ? sum / (end - start) : 0;
}
