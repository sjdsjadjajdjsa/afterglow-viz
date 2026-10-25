import { describe, expect, it } from "vitest";
import { bigChange, easeSettings } from "../src/scene/transition";
import { DEFAULT_SETTINGS, sanitize } from "../src/settings";

const base = sanitize(DEFAULT_SETTINGS);

describe("bigChange", () => {
  it("ignores no change and a single slider move", () => {
    expect(bigChange(base, sanitize(base))).toBe(false);
    expect(bigChange(base, { ...base, rings: { ...base.rings, size: 0.9 } })).toBe(false);
    expect(bigChange(base, { ...base, sensitivity: 1.5 })).toBe(false);
  });

  it("fades when an option changes", () => {
    expect(bigChange(base, { ...base, shape: "rings" })).toBe(true);
    expect(bigChange(base, { ...base, color: { ...base.color, mode: "rainbow" } })).toBe(true);
    expect(bigChange(base, { ...base, particles: { ...base.particles, kind: "snow" } })).toBe(true);
    expect(bigChange(base, { ...base, color: { ...base.color, single: "#ff0000" } })).toBe(true);
  });

  it("fades when a look changes several numbers at once", () => {
    expect(bigChange(base, { ...base, rings: { ...base.rings, size: 0.9, spread: 0.1 } })).toBe(true);
  });
});

describe("easeSettings", () => {
  it("glides numbers, snaps choices and whole numbers", () => {
    const shown = sanitize(base);
    const target = { ...base, shape: "rings" as const, rings: { ...base.rings, size: 1, count: 9 } };
    easeSettings(shown, target, 16);
    expect(shown.shape).toBe("rings");
    expect(shown.rings.count).toBe(9);
    expect(shown.rings.size).toBeGreaterThan(base.rings.size);
    expect(shown.rings.size).toBeLessThan(1);
    for (let i = 0; i < 200; i++) easeSettings(shown, target, 16);
    expect(shown.rings.size).toBe(1);
  });

  it("never touches the target", () => {
    const target = sanitize(base);
    const before = JSON.stringify(target);
    easeSettings(sanitize({ sensitivity: 0 }), target, 16);
    expect(JSON.stringify(target)).toBe(before);
  });
});
