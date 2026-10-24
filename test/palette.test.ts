import { describe, expect, it } from "vitest";
import { rgbToHsl, type RGB } from "../src/color/getColor";
import { paletteFromPixels } from "../src/color/palette";
import { seededRandom } from "../src/util/math";

const N = 48 * 48;

function image(pixel: (i: number) => [number, number, number, number?]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const [r, g, b, a = 255] = pixel(i);
    data.set([r, g, b, a], i * 4);
  }
  return data;
}

const hue = (c: RGB) => rgbToHsl(...c)[0];
const light = (c: RGB) => rgbToHsl(...c)[2];
const chroma = (c: RGB) => Math.max(...c) - Math.min(...c);
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

function valid(p: RGB[] | null): RGB[] {
  expect(p).not.toBeNull();
  expect(p!.length).toBeGreaterThan(0);
  expect(p!.length).toBeLessThanOrEqual(5);
  for (const c of p!) for (const v of c) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
  return p!;
}

describe("paletteFromPixels", () => {
  it("finds both colors of a two color image", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 48 < 30 ? [200, 30, 40] : [30, 70, 210]))));
    expect(p.some((c) => hueDist(hue(c), hue([200, 30, 40])) < 0.03)).toBe(true);
    expect(p.some((c) => hueDist(hue(c), hue([30, 70, 210])) < 0.03)).toBe(true);
    // the larger area comes first
    expect(hueDist(hue(p[0]), hue([200, 30, 40]))).toBeLessThan(0.03);
  });

  it("ignores a gray and black background when there's color on it", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 10 === 0 ? [240, 120, 20] : i % 2 ? [8, 8, 8] : [128, 128, 128]))));
    for (const c of p) expect(hueDist(hue(c), hue([240, 120, 20]))).toBeLessThan(0.05);
  });

  it("lifts dark colors to a usable brightness", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 2 ? [70, 10, 20] : [10, 30, 60]))));
    for (const c of p) expect(light(c)).toBeGreaterThanOrEqual(0.45);
  });

  it("returns a muted palette for an all black image", () => {
    const p = valid(paletteFromPixels(image(() => [0, 0, 0])));
    expect(p.length).toBeGreaterThanOrEqual(2);
    for (const c of p) {
      expect(light(c)).toBeGreaterThanOrEqual(0.45);
      expect(chroma(c)).toBeLessThan(30);
    }
  });

  it("returns grays for a grayscale image", () => {
    const p = valid(paletteFromPixels(image((i) => [(i * 7) % 256, (i * 7) % 256, (i * 7) % 256])));
    expect(p.length).toBeGreaterThanOrEqual(2);
    for (const c of p) expect(chroma(c)).toBeLessThan(4);
    expect(new Set(p.map((c) => c.join())).size).toBe(p.length);
  });

  it("keeps a tint in a mostly gray image", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 2 ? [120, 110, 100] : [60, 55, 50]))));
    for (const c of p) {
      expect(chroma(c)).toBeLessThan(80);
      expect(c[0]).toBeGreaterThan(c[2]);
    }
  });

  it("picks distinct, vivid colors in hue order from noise", () => {
    const rand = seededRandom(7);
    const p = valid(paletteFromPixels(image(() => [rand() * 256, rand() * 256, rand() * 256])));
    expect(p.length).toBe(5);
    for (const c of p) expect(chroma(c)).toBeGreaterThan(60);
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) expect(p[i].join()).not.toBe(p[j].join());
    // around the hue circle from the first color, never doubling back
    const hues = p.map(hue);
    let turns = 0;
    for (let i = 0; i < hues.length; i++) if (hues[(i + 1) % hues.length] < hues[i]) turns++;
    expect(turns).toBe(1);
  });

  it("merges near duplicates", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 3 === 0 ? [220, 40, 40] : i % 3 === 1 ? [225, 48, 44] : [215, 36, 46]))));
    expect(p.length).toBeLessThanOrEqual(2);
  });

  it("skips transparent pixels", () => {
    const p = valid(paletteFromPixels(image((i) => (i % 4 ? [255, 0, 0, 0] : [40, 200, 90]))));
    for (const c of p) expect(hueDist(hue(c), hue([40, 200, 90]))).toBeLessThan(0.05);
    valid(paletteFromPixels(image(() => [255, 0, 0, 0])));
  });

  it("returns null when there are no pixels", () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0))).toBeNull();
  });
});
