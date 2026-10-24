import { describe, expect, it } from "vitest";
import { EDGE, MAX_PARTICLES, ParticleField, particleCount, type ParticleKind } from "../src/scene/extras/particleField";

const KINDS: ParticleKind[] = ["dust", "snow", "stars", "fireflies"];

function inBounds(f: ParticleField): boolean {
  for (let i = 0; i < f.count; i++) {
    const x = f.x[i];
    const y = f.y[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < -EDGE || x > 1 + EDGE || y < -EDGE || y > 1 + EDGE) return false;
  }
  return true;
}

describe("particle count", () => {
  it("follows amount and is zero for none", () => {
    expect(particleCount("dust", 0)).toBe(0);
    expect(particleCount("dust", 0.5)).toBe(MAX_PARTICLES / 2);
    expect(particleCount("snow", 1)).toBe(MAX_PARTICLES);
    expect(particleCount("stars", 7)).toBe(MAX_PARTICLES);
    expect(particleCount("none", 1)).toBe(0);
    expect(particleCount("fireflies", 1)).toBe(160);
    expect(particleCount("fireflies", 0.5)).toBe(80);
  });

  it("the field grows and shrinks with amount", () => {
    const f = new ParticleField();
    f.sync("dust", 0.25);
    expect(f.count).toBe(100);
    f.sync("dust", 1);
    expect(f.count).toBe(400);
    f.sync("dust", 0.1);
    expect(f.count).toBe(40);
    f.sync("none", 0.1);
    expect(f.count).toBe(0);
  });

  it("new particles fade in", () => {
    const f = new ParticleField();
    f.sync("dust", 0.1);
    f.step({ width: 800, height: 600, size: 600, dt: 1, time: 1, speed: 0.5, level: 0, beat: 0 });
    f.sync("dust", 0.2);
    expect(f.age[0]).toBeGreaterThan(0);
    expect(f.age[f.count - 1]).toBe(0);
  });
});

describe("particle motion", () => {
  for (const kind of KINDS) {
    it(`${kind} stays finite and in bounds`, () => {
      const f = new ParticleField(3);
      f.sync(kind, 1);
      let w = 2560;
      let h = 1440;
      let time = 0;
      for (const speed of [0, 0.4, 1]) {
        for (let step = 0; step < 1500; step++) {
          if (step === 700) {
            w = 600;
            h = 1100;
          }
          const dt = step % 97 === 0 ? 0.25 : 1 / 60;
          time += dt;
          const beat = step % 30 === 0 ? 1 : 0;
          f.step({ width: w, height: h, size: Math.min(w, h), dt, time, speed, level: 0.8, beat });
          if (!inBounds(f)) throw new Error(`out of bounds at step ${step}, speed ${speed}`);
        }
        w = 2560;
        h = 1440;
      }
    });
  }

  it("actually moves", () => {
    for (const kind of KINDS) {
      const f = new ParticleField(5);
      f.sync(kind, 0.2);
      const x0 = Array.from(f.x.subarray(0, f.count));
      const y0 = Array.from(f.y.subarray(0, f.count));
      for (let i = 0; i < 60; i++) f.step({ width: 1280, height: 720, size: 720, dt: 1 / 60, time: i / 60, speed: 0.5, level: 0, beat: 0 });
      let moved = 0;
      for (let i = 0; i < f.count; i++) moved += Math.abs(f.x[i] - x0[i]) + Math.abs(f.y[i] - y0[i]);
      expect(moved).toBeGreaterThan(0);
    }
  });

  it("ignores bad dt and zero size canvases", () => {
    const f = new ParticleField();
    f.sync("snow", 0.5);
    for (const dt of [NaN, -1, Infinity]) f.step({ width: 100, height: 100, size: 100, dt, time: 0, speed: 1, level: 0, beat: 0 });
    f.step({ width: 0, height: 0, size: 0, dt: 0.1, time: 0, speed: 1, level: 0, beat: 0 });
    expect(inBounds(f)).toBe(true);
  });
});
