import { describe, expect, it } from "vitest";
import { describeShape } from "../src/diagnostics/shape";

describe("describeShape", () => {
  it("keeps short primitives and outlines arrays", () => {
    expect(describeShape({ a: 1, b: "x", c: true, d: null, e: [1, 2, 3], f: [] })).toEqual({
      a: 1,
      b: "x",
      c: true,
      d: null,
      e: { "(array)": 3, first: 1 },
      f: [],
    });
  });

  it("shortens long strings and stops at the depth limit", () => {
    const out = describeShape({ long: "x".repeat(200), deep: { a: { b: { c: 1 } } } }, 2) as any;
    expect(out.long).toMatch(/\.\.\. \(200 chars\)$/);
    expect(out.deep).toEqual({ a: "(object with 1 keys)" });
  });

  it("redacts sensitive-looking keys", () => {
    expect(describeShape({ sessionId: "s", accessToken: "t", uri: "u" })).toEqual({
      sessionId: "(redacted)",
      accessToken: "(redacted)",
      uri: "u",
    });
  });

  it("survives getters that throw", () => {
    const tricky = {
      get boom() {
        throw new Error("no");
      },
      ok: 1,
    };
    expect(describeShape(tricky)).toEqual({ boom: "(threw on read)", ok: 1 });
  });

  it("names non-JSON values", () => {
    expect(describeShape(() => 1)).toBe("(function)");
    expect(describeShape(undefined)).toBe("(undefined)");
    expect(describeShape(NaN)).toBe("NaN");
  });
});
