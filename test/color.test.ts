import { describe, expect, it } from "vitest";
import { getColor, hexToRgb, rgbToHsl, samplePalette, type ColorTrack, type RGB } from "../src/color/getColor";
import { COLOR_MODES, DEFAULT_SETTINGS, type Settings } from "../src/settings";

type Mode = Settings["color"]["mode"];

function settings(mode: Mode, color: Partial<Settings["color"]> = {}): Settings {
  return { ...DEFAULT_SETTINGS, color: { ...DEFAULT_SETTINGS.color, mode, single: "#1ed760", ...color } };
}

const art: RGB[] = [
  [230, 60, 40],
  [250, 190, 40],
  [40, 120, 230],
];
const center: RGB[] = [
  [140, 230, 90],
  [200, 80, 220],
];
const full: ColorTrack = { artPalette: art, centerPalette: center };
const ts = [0, 0.13, 0.37, 0.5, 0.71, 0.94];

const strip = (s: Settings, track: ColorTrack) => ts.map((t) => getColor(s, track, t));
const close = (a: RGB, b: RGB, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) <= eps);

describe("getColor", () => {
  it("gives a different strip for every mode, and the same one again on the way back", () => {
    const order: Mode[] = ["album", "single", "rainbow", "centerpiece", "album", "rainbow", "single", "centerpiece"];
    const first = new Map<Mode, RGB[]>();
    for (const mode of order) {
      const out = strip(settings(mode), full);
      // fresh copies so nothing could be shared with earlier calls
      const fresh = strip(settings(mode), { artPalette: art.map((c) => [...c] as RGB), centerPalette: center.map((c) => [...c] as RGB) });
      expect(out).toEqual(fresh);
      if (first.has(mode)) expect(out).toEqual(first.get(mode));
      else first.set(mode, out);
    }
    for (const a of COLOR_MODES)
      for (const b of COLOR_MODES) if (a !== b) expect(first.get(a)).not.toEqual(first.get(b));
  });

  it("changes along t in every mode", () => {
    for (const mode of COLOR_MODES) {
      const out = strip(settings(mode), full);
      expect(out.some((c) => !close(c, out[0], 1))).toBe(true);
    }
  });

  it("hits the palette colors at their positions", () => {
    for (let i = 0; i < art.length; i++) expect(close(getColor(settings("album"), full, i / art.length), art[i])).toBe(true);
    for (let i = 0; i < center.length; i++)
      expect(close(getColor(settings("centerpiece"), full, i / center.length), center[i])).toBe(true);
  });

  it("falls back from the centerpiece palette to the album palette, then to rainbow", () => {
    const centerpiece = settings("centerpiece");
    const noCenter = strip(centerpiece, { artPalette: art, centerPalette: null });
    expect(noCenter).toEqual(strip(settings("album"), full));
    expect(strip(centerpiece, { artPalette: art, centerPalette: [] })).toEqual(noCenter);
    const nothing = strip(centerpiece, { artPalette: null, centerPalette: null });
    expect(nothing).toEqual(strip(settings("rainbow"), full));
    expect(strip(centerpiece, { artPalette: [], centerPalette: [] })).toEqual(nothing);
  });

  it("falls back to rainbow in album mode when there's no art palette", () => {
    expect(strip(settings("album"), { artPalette: null, centerPalette: center })).toEqual(strip(settings("rainbow"), full));
  });

  it("keeps single recognizably the chosen color", () => {
    const target = hexToRgb("#1ed760");
    const [h] = rgbToHsl(...target);
    expect(close(getColor(settings("single"), full, 0), target)).toBe(true);
    for (let t = 0; t < 1; t += 0.05) {
      const c = getColor(settings("single"), full, t);
      expect(Math.abs(rgbToHsl(...c)[0] - h)).toBeLessThan(0.03);
    }
    const red = getColor(settings("single", { single: "#ff0000" }), full, 0.3);
    expect(red[0]).toBeGreaterThan(red[1] + 150);
  });

  it("turns gray at saturation 0 and leaves colors alone at 1", () => {
    for (const mode of COLOR_MODES) {
      for (const t of ts) {
        const [r, g, b] = getColor(settings(mode, { saturation: 0 }), full, t);
        expect(Math.abs(r - g)).toBeLessThan(1e-9);
        expect(Math.abs(g - b)).toBeLessThan(1e-9);
      }
    }
    for (let i = 0; i < art.length; i++) expect(close(getColor(settings("album", { saturation: 1 }), full, i / 3), art[i])).toBe(true);
    const half = getColor(settings("album", { saturation: 0.5 }), full, 0);
    expect(half[0] - half[1]).toBeLessThan(art[0][0] - art[0][1]);
    expect(half[0] - half[1]).toBeGreaterThan(0);
  });

  it("wraps t", () => {
    for (const mode of COLOR_MODES)
      for (const t of ts) {
        const s = settings(mode);
        expect(close(getColor(s, full, t), getColor(s, full, t + 1), 1e-6)).toBe(true);
        expect(close(getColor(s, full, t), getColor(s, full, t - 3), 1e-6)).toBe(true);
      }
  });

  it("always returns finite channels in 0..255", () => {
    const odd = [-1e9, -0.5, 0, 0.999999, 1, 7.25, 1e9, NaN, Infinity, -Infinity];
    const extreme: ColorTrack = {
      artPalette: [
        [0, 0, 0],
        [255, 255, 255],
        [255, 0, 0],
      ],
      centerPalette: [[0, 255, 0]],
    };
    for (const mode of COLOR_MODES)
      for (const saturation of [0, 0.3, 1])
        for (const single of ["#000000", "#ffffff", "#ff00aa", "nope"])
          for (const t of [...odd, ...ts]) {
            const c = getColor(settings(mode, { saturation, single }), extreme, t);
            for (const v of c) {
              expect(Number.isFinite(v)).toBe(true);
              expect(v).toBeGreaterThanOrEqual(0);
              expect(v).toBeLessThanOrEqual(255);
            }
          }
  });

  it("doesn't pass through gray between two far apart colors", () => {
    const pair: RGB[] = [
      [240, 40, 40],
      [40, 220, 220],
    ];
    const mid = samplePalette(pair, 0.25);
    expect(Math.max(...mid) - Math.min(...mid)).toBeGreaterThan(150);
  });
});
