import { describe, expect, it } from "vitest";
import { blurCanvasSize, dimAlpha, RenderKey } from "../src/scene/extras/backdrop";
import { coverCrop, createCrop } from "../src/scene/extras/cover";

describe("cover crop", () => {
  const crop = createCrop();

  it("crops the sides of a wide image", () => {
    coverCrop(1600, 900, 1, crop);
    expect(crop).toEqual({ sx: 350, sy: 0, sw: 900, sh: 900 });
  });

  it("crops top and bottom of a tall image", () => {
    coverCrop(600, 1000, 1, crop);
    expect(crop).toEqual({ sx: 0, sy: 200, sw: 600, sh: 600 });
  });

  it("keeps a square image whole for a square box", () => {
    coverCrop(640, 640, 1, crop);
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 640, sh: 640 });
  });

  it("covers a wide box with a square image", () => {
    coverCrop(640, 640, 16 / 9, crop);
    expect(crop.sw).toBe(640);
    expect(crop.sh).toBeCloseTo(360);
    expect(crop.sy).toBeCloseTo(140);
  });

  it("returns an empty crop for an unloaded image", () => {
    coverCrop(0, 0, 1, crop);
    expect(crop.sw).toBe(0);
  });
});

describe("background", () => {
  it("dim 0 adds nothing and dim 1 is black", () => {
    expect(dimAlpha(0)).toBe(0);
    expect(dimAlpha(0, 1)).toBe(0);
    expect(dimAlpha(1)).toBe(1);
    expect(dimAlpha(0.5)).toBe(0.5);
  });

  it("loud parts lift the dim a little", () => {
    expect(dimAlpha(0.6, 1)).toBeLessThan(dimAlpha(0.6, 0));
    expect(dimAlpha(0.6, 1)).toBeGreaterThan(0.4);
  });

  it("re-renders only when the image or size changes", () => {
    const key = new RenderKey<object>();
    const a = {};
    const b = {};
    expect(key.matches(a, 100, 100)).toBe(false);
    key.set(a, 100, 100);
    expect(key.matches(a, 100, 100)).toBe(true);
    expect(key.matches(a, 101, 100)).toBe(false);
    expect(key.matches(b, 100, 100)).toBe(false);
    expect(key.sourceChanged(a)).toBe(false);
    expect(key.sourceChanged(b)).toBe(true);
  });

  it("blurs into a small canvas with the same shape", () => {
    const [w, h] = blurCanvasSize(2560, 1440);
    expect(w).toBe(480);
    expect(h).toBe(270);
    expect(blurCanvasSize(200, 100)).toEqual([200, 100]);
  });
});
