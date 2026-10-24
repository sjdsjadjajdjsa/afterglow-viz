import type { Settings } from "../settings";

export type RGB = [number, number, number];

export interface ColorTrack {
  artPalette: RGB[] | null;
  centerPalette: RGB[] | null;
}

// every color mode goes through here, every frame. t is a position along
// the palette, 0..1, wrapping. no state, so switching modes can't go stale
export function getColor(settings: Settings, track: ColorTrack, t: number): RGB {
  const { mode, single, saturation } = settings.color;
  const u = t - Math.floor(t);
  let rgb: RGB;
  if (mode === "single") rgb = hexToRgb(single);
  else if (mode === "album" && track.artPalette?.length) rgb = samplePalette(track.artPalette, u);
  else if (mode === "centerpiece" && (track.centerPalette ?? track.artPalette)?.length)
    rgb = samplePalette((track.centerPalette ?? track.artPalette)!, u);
  else rgb = hslToRgb(u, 1, 0.6);
  return saturate(rgb, saturation);
}

export function samplePalette(palette: RGB[], t: number): RGB {
  const p = t * palette.length;
  const i = Math.floor(p) % palette.length;
  const a = palette[i];
  const b = palette[(i + 1) % palette.length];
  const f = p - Math.floor(p);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function saturate([r, g, b]: RGB, amount: number): RGB {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [gray + (r - gray) * amount, gray + (g - gray) * amount, gray + (b - gray) * amount];
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(/^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "ffffff", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// h, s, l in 0..1
export function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

export function toCss([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}
