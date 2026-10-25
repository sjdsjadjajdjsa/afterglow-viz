import { describe, expect, it } from "vitest";
import { bigChange } from "../src/scene/transition";
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
