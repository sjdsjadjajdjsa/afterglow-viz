import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitize } from "../src/settings";

describe("sanitize", () => {
  it("returns defaults for junk", () => {
    for (const input of [undefined, null, 3, "x", []]) expect(sanitize(input)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and fixes bad ones field by field", () => {
    const s = sanitize({
      shape: "rings",
      rings: { count: 99.6, size: -1, spread: "wide" },
      color: { mode: "plaid", single: "#ABCDEF" },
      centerpiece: { kind: "image", image: "javascript:alert(1)" },
      sensitivity: 1.5,
    });
    expect(s.shape).toBe("rings");
    expect(s.rings).toEqual({ ...DEFAULT_SETTINGS.rings, count: 12, size: 0 });
    expect(s.color.mode).toBe(DEFAULT_SETTINGS.color.mode);
    expect(s.color.single).toBe("#abcdef");
    expect(s.centerpiece.kind).toBe("image");
    expect(s.centerpiece.image).toBeNull();
    expect(s.sensitivity).toBe(1.5);
  });

  it("does not share objects with the defaults", () => {
    const s = sanitize({});
    s.rings.count = 7;
    expect(DEFAULT_SETTINGS.rings.count).toBe(4);
  });
});
