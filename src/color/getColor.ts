import type { Settings } from "../settings";

export type RGB = [number, number, number];

export interface ColorTrack {
  artPalette: RGB[] | null;
  centerPalette: RGB[] | null;
}

const TAU = Math.PI * 2;
const HUE_OFFSETS = [0, 8, 4];

// every color mode goes through here, every frame. t is a position along
// the palette, 0..1, wrapping. no state, so switching modes can't go stale
export function getColor(settings: Settings, track: ColorTrack, t: number, out: RGB = [0, 0, 0]): RGB {
  const { mode, single, saturation } = settings.color;
  const u = Number.isFinite(t) ? t - Math.floor(t) : 0;
  if (mode === "single") singleColor(hexToRgb(single, out), u, out);
  else if (mode === "album" && track.artPalette?.length) samplePalette(track.artPalette, u, out);
  else if (mode === "centerpiece" && track.centerPalette?.length) samplePalette(track.centerPalette, u, out);
  else if (mode === "centerpiece" && track.artPalette?.length) samplePalette(track.artPalette, u, out);
  else rainbow(u, out);
  return saturate(out, Number.isFinite(saturation) ? saturation : 1, out);
}

// blue and violet look much darker than yellow at the same hsl lightness,
// so lift them a little
export function rainbow(u: number, out: RGB = [0, 0, 0]): RGB {
  return hslToRgb(u, 1, 0.61 + 0.07 * Math.cos(TAU * (u - 0.68)), out);
}

// the chosen color with a gentle brightness swell along t, so it still moves
export function singleColor([r, g, b]: RGB, u: number, out: RGB = [0, 0, 0]): RGB {
  const w = 0.5 - 0.5 * Math.cos(TAU * u);
  const k = 0.88 + 0.12 * (1 - w);
  const lift = 40 * w * w;
  out[0] = r * k + lift;
  out[1] = g * k + lift;
  out[2] = b * k + lift;
  return out;
}

// eased blend between neighbors in hsl, the short way around the hue
// circle, so two distant hues don't pass through gray halfway
export function samplePalette(palette: RGB[], t: number, out: RGB = [0, 0, 0]): RGB {
  const n = palette.length;
  const p = (t - Math.floor(t)) * n;
  const i = Math.floor(p) % n;
  const a = palette[i];
  const b = palette[(i + 1) % n];
  const x = p - Math.floor(p);
  if (x === 0 || a === b) {
    out[0] = clamp255(a[0]);
    out[1] = clamp255(a[1]);
    out[2] = clamp255(a[2]);
    return out;
  }
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
  return hslToRgb(h, sa + (sb - sa) * f, la + (lb - la) * f, out);
}

export function saturate([r, g, b]: RGB, amount: number, out: RGB = [0, 0, 0]): RGB {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  out[0] = clamp255(gray + (r - gray) * amount);
  out[1] = clamp255(gray + (g - gray) * amount);
  out[2] = clamp255(gray + (b - gray) * amount);
  return out;
}

function clamp255(x: number): number {
  return x < 0 ? 0 : x > 255 ? 255 : x;
}

export function hexToRgb(hex: string, out: RGB = [0, 0, 0]): RGB {
  const n = parseInt(/^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "ffffff", 16);
  out[0] = (n >> 16) & 255;
  out[1] = (n >> 8) & 255;
  out[2] = n & 255;
  return out;
}

// h, s, l in 0..1
export function hslToRgb(h: number, s: number, l: number, out: RGB = [0, 0, 0]): RGB {
  const a = s * Math.min(l, 1 - l);
  for (let i = 0; i < 3; i++) {
    const k = (HUE_OFFSETS[i] + h * 12) % 12;
    out[i] = 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  }
  return out;
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
