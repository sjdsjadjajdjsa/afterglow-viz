import { hslToRgb, rgbToHsl, type RGB } from "./getColor";

const SIZE = 48;
const MAX_COLORS = 5;
// max - min of a pixel, 0..255. below this it counts as gray, black or white
const MIN_CHROMA = 36;
// share of opaque pixels that must be colorful before gray ones are ignored
const MIN_COLORFUL = 0.03;
const MIN_DISTANCE = 80;
const HUES = 24;
const BINS = 512;
const NEUTRAL: RGB[] = [
  [168, 170, 182],
  [214, 216, 226],
];

// a few dominant colors from an image, or null if it can't be read
// (not loaded yet, or tainted by cors)
export function extractPalette(image: HTMLImageElement): RGB[] | null {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null;
  }
  return paletteFromPixels(data);
}

interface Bin {
  count: number;
  rgb: RGB;
  score: number;
}

// rgba bytes in, up to five colors out that read well as glowing lines on a
// dark background, ordered by hue so neighbors blend smoothly
export function paletteFromPixels(data: ArrayLike<number>): RGB[] | null {
  const pixels = Math.floor(data.length / 4);
  if (!pixels) return null;

  // colorful pixels group by hue and lightness band, the rest by 3 bits per channel
  const colorful = new Float64Array(BINS * 4);
  const muted = new Float64Array(BINS * 4);
  let opaque = 0;
  let colorfulCount = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    opaque++;
    const c = Math.max(r, g, b) - Math.min(r, g, b);
    let bins = muted;
    let k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    if (c >= MIN_CHROMA) {
      const [h, , l] = rgbToHsl(r, g, b);
      bins = colorful;
      k = Math.min(HUES - 1, Math.floor(h * HUES)) * 3 + (l < 0.35 ? 0 : l < 0.65 ? 1 : 2);
      colorfulCount++;
    }
    bins[k * 4] += 1;
    bins[k * 4 + 1] += r;
    bins[k * 4 + 2] += g;
    bins[k * 4 + 3] += b;
  }
  if (!opaque) return NEUTRAL.map((c) => [...c] as RGB);

  if (colorfulCount >= Math.max(1, opaque * MIN_COLORFUL)) {
    const minCount = Math.max(1, colorfulCount * 0.004);
    const picks = pick(collect(colorful, minCount, vividScore), lift);
    if (picks.length) return finish(picks);
  }
  const picks = pick(collect(muted, Math.max(1, opaque * 0.01), (b) => b.count), liftMuted);
  return finish(picks.length ? picks : NEUTRAL.map((c) => ({ count: 1, rgb: [...c] as RGB, score: 1 })));
}

function collect(bins: Float64Array, minCount: number, score: (b: Bin) => number): Bin[] {
  const out: Bin[] = [];
  for (let k = 0; k < BINS; k++) {
    const n = bins[k * 4];
    if (n < minCount) continue;
    const bin: Bin = { count: n, rgb: [bins[k * 4 + 1] / n, bins[k * 4 + 2] / n, bins[k * 4 + 3] / n], score: 0 };
    bin.score = score(bin);
    out.push(bin);
  }
  return out.sort((a, b) => b.score - a.score);
}

// favors vivid and bright, while still caring how much of the image it covers
function vividScore({ count, rgb: [r, g, b] }: Bin): number {
  const c = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  const v = Math.max(r, g, b) / 255;
  return count * (c + 0.15) * (c + 0.15) * (0.35 + v);
}

// greedy: best scoring first, skipping anything too close to a color already
// taken. distance is checked after lifting, since lifting can merge colors
function pick(bins: Bin[], adjust: (rgb: RGB) => RGB): Bin[] {
  const out: Bin[] = [];
  for (const bin of bins) {
    const rgb = adjust(bin.rgb);
    if (out.some((p) => distance(p.rgb, rgb) < MIN_DISTANCE)) continue;
    out.push({ ...bin, rgb });
    if (out.length === MAX_COLORS) break;
  }
  return out;
}

// dark picks come up to a usable brightness, very light ones come down a bit
function lift([r, g, b]: RGB): RGB {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h, Math.max(s, 0.35), Math.min(0.78, Math.max(l, 0.45 + 0.2 * l)));
}

function liftMuted([r, g, b]: RGB): RGB {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h, Math.min(s, 0.3), 0.5 + 0.3 * l);
}

function finish(picks: Bin[]): RGB[] {
  // one color gives nothing to blend toward, so add a lighter take on it
  if (picks.length === 1) {
    const [h, s, l] = rgbToHsl(...picks[0].rgb);
    picks.push({ count: 0, score: 0, rgb: hslToRgb(h, s * 0.8, Math.min(0.85, l + 0.15)) });
  }
  const hues = picks.map((p) => ({ rgb: p.rgb.map(Math.round) as RGB, hue: rgbToHsl(...p.rgb)[0], score: p.score }));
  hues.sort((a, b) => a.hue - b.hue);
  // start at the strongest color, the order around the hue circle stays the same
  let top = 0;
  for (let i = 1; i < hues.length; i++) if (hues[i].score > hues[top].score) top = i;
  return [...hues.slice(top), ...hues.slice(0, top)].map((h) => h.rgb);
}

// "redmean" weighted rgb distance, close enough to perceptual for this
function distance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
