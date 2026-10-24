import type { Settings } from "../settings";

export type RGB = [number, number, number];

export interface ColorTrack {
  artPalette: RGB[] | null;
  centerPalette: RGB[] | null;
}

const TAU = Math.PI * 2;

// every color mode goes through here, every frame. t is a position along
// the palette, 0..1, wrapping. no state, so switching modes can't go stale
export function getColor(settings: Settings, track: ColorTrack, t: number): RGB {
  const { mode, single, saturation } = settings.color;
  const u = Number.isFinite(t) ? t - Math.floor(t) : 0;
  let rgb: RGB;
  if (mode === "single") rgb = singleColor(hexToRgb(single), u);
  else if (mode === "album" && track.artPalette?.length) rgb = samplePalette(track.artPalette, u);
  else if (mode === "centerpiece" && track.centerPalette?.length) rgb = samplePalette(track.centerPalette, u);
  else if (mode === "centerpiece" && track.artPalette?.length) rgb = samplePalette(track.artPalette, u);
  else rgb = rainbow(u);
  return saturate(rgb, Number.isFinite(saturation) ? saturation : 1);
}

// blue and violet look much darker than yellow at the same hsl lightness,
// so lift them a little
export function rainbow(u: number): RGB {
  return hslToRgb(u, 1, 0.61 + 0.07 * Math.cos(TAU * (u - 0.68)));
}

// the chosen color with a gentle brightness swell along t, so it still moves
export function singleColor([r, g, b]: RGB, u: number): RGB {
  const w = 0.5 - 0.5 * Math.cos(TAU * u);
  const k = 0.88 + 0.12 * (1 - w);
  const lift = 40 * w * w;
  return [r * k + lift, g * k + lift, b * k + lift];
}

// eased blend between neighbors in hsl, the short way around the hue
// circle, so two distant hues don't pass through gray halfway
export function samplePalette(palette: RGB[], t: number): RGB {
  const n = palette.length;
  const p = (t - Math.floor(t)) * n;
  const i = Math.floor(p) % n;
  const a = palette[i];
  const b = palette[(i + 1) % n];
  const x = p - Math.floor(p);
  if (x === 0 || a === b) return [clamp255(a[0]), clamp255(a[1]), clamp255(a[2])];
  const f = x * x * (3 - 2 * x);
  const [ha, sa, la] = rgbToHsl(a[0], a[1], a[2]);
  const [hb, sb, lb] = rgbToHsl(b[0], b[1], b[2]);
  // a gray end has no hue of its own, so it borrows the other one's
  const h0 = sa < 0.02 && sb >= 0.02 ? hb : ha;
  const h1 = sb < 0.02 ? h0 : hb;
  let dh = h1 - h0;
  if (dh > 0.5) dh -= 1;
  else if (dh < -0.5) dh += 1;
  let h = h0 + dh * f;
  if (h < 0) h += 1;
  else if (h >= 1) h -= 1;
  return hslToRgb(h, sa + (sb - sa) * f, la + (lb - la) * f);
}

export function saturate([r, g, b]: RGB, amount: number): RGB {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clamp255(gray + (r - gray) * amount),
    clamp255(gray + (g - gray) * amount),
    clamp255(gray + (b - gray) * amount),
  ];
}

function clamp255(x: number): number {
  return x < 0 ? 0 : x > 255 ? 255 : x;
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

// h, s, l in 0..1
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  if (h < 0) h += 1;
  return [h, Math.min(1, s), l];
}

export function toCss([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}
