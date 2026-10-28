import { describe, expect, it } from "vitest";
import { getColor, toCss } from "../src/color/getColor";
import { createFrame } from "../src/reactivity/types";
import { createShapesLayer } from "../src/scene/layers/shapes";
import {
  clearance,
  createRingGeometry,
  createSpectrumGeometry,
  ringGeometry,
  spectrumGeometry,
  type RingGeometry,
  type SpectrumGeometry,
} from "../src/scene/shapes/geometry";
import { PROFILES } from "../src/scene/performance";
import type { DrawInfo, SceneTrack } from "../src/scene/types";
import { DEFAULT_SETTINGS, RANGES, type Settings } from "../src/settings";

const W = 2560;
const H = 1440;
const SIZE = 1440;

function settings(patch: (s: Settings) => void = () => {}): Settings {
  const s = structuredClone(DEFAULT_SETTINGS);
  patch(s);
  return s;
}

function rings(s: Settings): RingGeometry {
  const g = ringGeometry(s, SIZE, 1, createRingGeometry());
  return { ...g, radius: g.radius.slice(), bandStart: g.bandStart.slice(), bandEnd: g.bandEnd.slice() };
}

function spectrum(s: Settings): SpectrumGeometry {
  return { ...spectrumGeometry(s, W, SIZE, 1, createSpectrumGeometry()) };
}

function allFinite(o: object): boolean {
  return Object.values(o).every((v) =>
    typeof v === "number" ? Number.isFinite(v) : ArrayBuffer.isView(v) ? Array.from(v as Float32Array).every(Number.isFinite) : true,
  );
}

// every combination of min and max for the shape settings
function extremes(): Settings[] {
  const keys = Object.keys(RANGES).filter((k) => k.startsWith("rings.") || k.startsWith("spectrum.") || k.startsWith("centerpiece."));
  const out: Settings[] = [];
  for (const end of [0, 1] as const) {
    for (const kind of ["none", "album"] as const) {
      out.push(
        settings((s) => {
          s.centerpiece.kind = kind;
          for (const k of keys) {
            const [group, field] = k.split(".") as [keyof Settings, string];
            (s[group] as unknown as Record<string, number>)[field] = RANGES[k][end];
          }
        }),
      );
    }
  }
  return out;
}

describe("ringGeometry", () => {
  it("follows count, size, spread and thickness", () => {
    const base = rings(settings());
    expect(base.count).toBe(4);
    expect(rings(settings((s) => (s.rings.count = 9))).count).toBe(9);
    expect(rings(settings((s) => (s.rings.size = 1))).radius[0]).toBeGreaterThan(base.radius[0]);
    const wide = rings(settings((s) => (s.rings.spread = 1)));
    expect(wide.radius[3] - wide.radius[0]).toBeGreaterThan(base.radius[3] - base.radius[0]);
    expect(wide.radius[0]).toBe(base.radius[0]);
    expect(rings(settings((s) => (s.rings.thickness = 1))).lineWidth).toBeGreaterThan(base.lineWidth);
  });

  it("goes outward, inner rings get the lows, and covers every band", () => {
    for (let n = 1; n <= 12; n++) {
      const g = rings(settings((s) => (s.rings.count = n)));
      expect(g.bandStart[0]).toBe(0);
      expect(g.bandEnd[n - 1]).toBe(32);
      for (let i = 1; i < n; i++) {
        expect(g.radius[i]).toBeGreaterThan(g.radius[i - 1]);
        expect(g.bandStart[i]).toBe(g.bandEnd[i - 1]);
      }
    }
  });

  it("keeps the innermost ring outside the biggest centerpiece", () => {
    const g = rings(
      settings((s) => {
        s.rings.size = 0;
        s.centerpiece.size = 1;
      }),
    );
    expect(g.radius[0]).toBeGreaterThan(SIZE * (0.06 + 0.16));
    expect(g.radius[0]).toBeGreaterThanOrEqual(clearance(settings((s) => (s.centerpiece.size = 1)), SIZE));
  });

  it("is not moved by spectrum settings", () => {
    const base = rings(settings());
    const changed = rings(settings((s) => (s.spectrum = { size: 1, spread: 0, thickness: 1 })));
    expect(changed).toEqual(base);
  });
});

describe("spectrumGeometry", () => {
  it("follows size, spread and thickness", () => {
    const base = spectrum(settings());
    expect(spectrum(settings((s) => (s.spectrum.size = 1))).maxHalf).toBeGreaterThan(base.maxHalf);
    expect(spectrum(settings((s) => (s.spectrum.spread = 1))).slot).toBeGreaterThan(base.slot);
    expect(spectrum(settings((s) => (s.spectrum.thickness = 1))).barWidth).toBeGreaterThan(base.barWidth);
  });

  it("starts outside the centerpiece and stays on the canvas", () => {
    for (const s of extremes()) {
      const g = spectrum(s);
      expect(g.inner - g.slot / 2).toBeGreaterThanOrEqual(clearance(s, SIZE) - 1e-6);
      expect(g.inner + g.slot * (g.bars - 1) + g.barWidth / 2).toBeLessThanOrEqual(W / 2);
      expect(g.maxHalf + g.minHalf).toBeLessThanOrEqual(H / 2);
      expect(g.barWidth).toBeLessThanOrEqual(g.slot);
    }
  });

  it("is not moved by rings settings", () => {
    const base = spectrum(settings());
    const changed = spectrum(settings((s) => (s.rings = { count: 12, size: 1, spread: 1, thickness: 1 })));
    expect(changed).toEqual(base);
  });
});

describe("extremes", () => {
  it("never gives NaN, at any window size", () => {
    for (const s of extremes()) {
      for (const [w, size, dpr] of [
        [2560, 1440, 1],
        [1, 1, 1],
        [300, 900, 2],
      ]) {
        expect(allFinite(ringGeometry(s, size, dpr, createRingGeometry()))).toBe(true);
        expect(allFinite(spectrumGeometry(s, w, size, dpr, createSpectrumGeometry()))).toBe(true);
      }
    }
  });
});

type Call = [string, ...unknown[]];

// records every method call and property set
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, key) => (...args: unknown[]) => calls.push([String(key), ...args]),
    set: (_, key, value) => {
      calls.push(["set " + String(key), value]);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const track: SceneTrack = { artPalette: null, centerPalette: null, nowPlaying: null, art: null, centerImage: null };

function draw(s: Settings, level = 0.6): Call[] {
  const { ctx, calls } = recorder();
  const frame = createFrame();
  frame.level = level;
  frame.beat = level;
  for (let i = 0; i < frame.bands.length; i++) frame.bands[i] = level * ((i * 7) % 11) / 10;
  const d: DrawInfo = {
    ctx,
    width: W,
    height: H,
    dpr: 1,
    cx: W / 2,
    cy: H / 2,
    size: SIZE,
    time: 12.5,
    dt: 1 / 60,
    frame,
    settings: s,
    profile: PROFILES.balanced,
    track,
    color: (t) => getColor(s, track, t),
    css: (t, a = 1) => toCss(getColor(s, track, t), a),
  };
  createShapesLayer().draw(d);
  return calls;
}

function numbersOk(calls: Call[]): boolean {
  return calls.every((c) => c.slice(1).every((v) => typeof v !== "number" || Number.isFinite(v)));
}

describe("shapes layer", () => {
  it("draws only what the shape asks for", () => {
    const ringsOnly = draw(settings((s) => (s.shape = "rings")));
    const spectrumOnly = draw(settings((s) => (s.shape = "spectrum")));
    const both = draw(settings((s) => (s.shape = "both")));
    expect(ringsOnly.length).toBeGreaterThan(0);
    expect(spectrumOnly.length).toBeGreaterThan(0);
    expect(both).toEqual([...ringsOnly, ...spectrumOnly]);
    // rings are closed paths, spectrum bars never are
    expect(ringsOnly.filter((c) => c[0] === "closePath")).toHaveLength(4);
    expect(spectrumOnly.some((c) => c[0] === "closePath")).toBe(false);
  });

  it("draws one closed path per ring", () => {
    for (const n of [1, 5, 12]) {
      const calls = draw(
        settings((s) => {
          s.shape = "rings";
          s.rings.count = n;
        }),
      );
      expect(calls.filter((c) => c[0] === "closePath")).toHaveLength(n);
    }
  });

  it("keeps rings and spectrum independent when drawn", () => {
    const r = (patch: (s: Settings) => void) => draw(settings((s) => ((s.shape = "rings"), patch(s))));
    const sp = (patch: (s: Settings) => void) => draw(settings((s) => ((s.shape = "spectrum"), patch(s))));
    expect(r((s) => (s.spectrum = { size: 1, spread: 0, thickness: 1 }))).toEqual(r(() => {}));
    expect(sp((s) => (s.rings = { count: 11, size: 0, spread: 1, thickness: 1 }))).toEqual(sp(() => {}));
  });

  it("colors follow the color mode on the very next frame", () => {
    const layer = createShapesLayer();
    const styles = (mode: Settings["color"]["mode"]) => {
      const s = settings((x) => (x.color.mode = mode));
      const { ctx, calls } = recorder();
      layer.draw({
        ctx,
        width: W,
        height: H,
        dpr: 1,
        cx: W / 2,
        cy: H / 2,
        size: SIZE,
        time: 3,
        dt: 1 / 60,
        frame: createFrame(),
        settings: s,
        profile: PROFILES.balanced,
        track,
        color: (t) => getColor(s, track, t),
        css: (t, a = 1) => toCss(getColor(s, track, t), a),
      });
      return calls.filter((c) => c[0] === "set strokeStyle").map((c) => c[1]);
    };
    const rainbow = styles("rainbow");
    expect(new Set(rainbow).size).toBeGreaterThan(4);
    expect(styles("single")).not.toEqual(rainbow);
    expect(styles("rainbow")).toEqual(rainbow);
  });

  it("gives finite numbers at every extreme, silent or loud", () => {
    for (const s of extremes()) {
      for (const shape of ["rings", "spectrum", "both"] as const) {
        s.shape = shape;
        expect(numbersOk(draw(s, 0))).toBe(true);
        expect(numbersOk(draw(s, 1))).toBe(true);
      }
    }
  });
});
