import type { Settings } from "../../settings";
import { clamp01, seededRandom } from "../../util/math";

export type ParticleKind = Settings["particles"]["kind"];

export const MAX_PARTICLES = 400;
// how far past the edge (as a fraction of the canvas) a particle may go before it wraps or respawns
export const EDGE = 0.06;

export function particleCount(kind: ParticleKind, amount: number): number {
  if (kind === "none") return 0;
  // fireflies are big glows, a full swarm of them is too much
  const max = kind === "fireflies" ? MAX_PARTICLES * 0.4 : MAX_PARTICLES;
  return Math.round(clamp01(amount) * max);
}

// how much faster everything moves for a speed setting and the music
export function speedFactor(speed: number, level: number, beat: number): number {
  return (0.15 + 1.85 * clamp01(speed)) * (1 + 0.35 * clamp01(level) + 0.25 * clamp01(beat));
}

export interface StepInput {
  width: number;
  height: number;
  // min(width, height); velocities are in these units per second
  size: number;
  dt: number;
  time: number;
  speed: number;
  level: number;
  beat: number;
}

const TAU = Math.PI * 2;

// positions are fractions of the canvas, so a resize keeps everyone in place.
// everything lives in preallocated arrays and step() doesn't allocate
export class ParticleField {
  readonly x = new Float32Array(MAX_PARTICLES);
  readonly y = new Float32Array(MAX_PARTICLES);
  readonly vx = new Float32Array(MAX_PARTICLES);
  readonly vy = new Float32Array(MAX_PARTICLES);
  // radius as a fraction of size
  readonly radius = new Float32Array(MAX_PARTICLES);
  // 0..1: nearness for snow and stars, brightness otherwise
  readonly depth = new Float32Array(MAX_PARTICLES);
  // 0..1, a stable per-particle value for palette position and timing offsets
  readonly seed = new Float32Array(MAX_PARTICLES);
  readonly phase = new Float32Array(MAX_PARTICLES);
  // seconds since spawn, for fading in
  readonly age = new Float32Array(MAX_PARTICLES);
  kind: ParticleKind = "none";
  count = 0;
  private readonly random: () => number;

  constructor(seed = 1) {
    this.random = seededRandom(seed);
  }

  sync(kind: ParticleKind, amount: number): void {
    const count = particleCount(kind, amount);
    if (kind !== this.kind) {
      this.kind = kind;
      for (let i = 0; i < MAX_PARTICLES; i++) this.spawn(i, true);
    } else {
      for (let i = this.count; i < count; i++) this.spawn(i, true);
    }
    this.count = count;
  }

  step(input: StepInput): void {
    const { width, height, size, time } = input;
    const dt = input.dt > 0 && Number.isFinite(input.dt) ? input.dt : 0;
    if (dt === 0 || width <= 0 || height <= 0) return;
    const m = speedFactor(input.speed, input.level, input.beat) * dt;
    const kx = size / width;
    const ky = size / height;
    const { x, y, vx, vy, depth, seed, phase, age } = this;

    for (let i = 0; i < this.count; i++) {
      age[i] += dt;
      const s = seed[i];
      if (this.kind === "dust") {
        x[i] += (vx[i] + 0.008 * Math.sin(time * 0.31 + phase[i])) * m * kx;
        y[i] += (vy[i] + 0.008 * Math.cos(time * 0.23 + phase[i] * 1.7)) * m * ky;
      } else if (this.kind === "snow") {
        x[i] += (vx[i] + 0.025 * depth[i] * Math.sin(time * (0.5 + s) + phase[i])) * m * kx;
        y[i] += vy[i] * m * ky;
      } else if (this.kind === "stars") {
        // drift away from the center, faster for near stars, like flying slowly through them
        const rate = (0.02 + 0.1 * depth[i]) * m;
        x[i] += (x[i] - 0.5) * rate + vx[i] * m * kx;
        y[i] += (y[i] - 0.5) * rate + vy[i] * m * ky;
      } else if (this.kind === "fireflies") {
        const turn = Math.sin(time * 0.9 + s * 40) * 1.4 + Math.sin(time * 0.37 + s * 17) * 0.9;
        phase[i] += turn * m;
        const v = 0.02 + 0.03 * depth[i];
        x[i] += Math.cos(phase[i]) * v * m * kx;
        y[i] += Math.sin(phase[i]) * v * m * ky;
      }
      this.keepInside(i);
    }
  }

  private keepInside(i: number): void {
    const { x, y } = this;
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) {
      this.spawn(i, true);
      return;
    }
    const span = 1 + 2 * EDGE;
    const out = x[i] < -EDGE || x[i] > 1 + EDGE || y[i] < -EDGE || y[i] > 1 + EDGE;
    if (!out) return;
    if (this.kind === "stars") this.spawn(i, false);
    else if (this.kind === "snow" && y[i] > 1 + EDGE) this.spawn(i, false);
    else {
      if (x[i] < -EDGE) x[i] += span;
      else if (x[i] > 1 + EDGE) x[i] -= span;
      if (y[i] < -EDGE) y[i] += span;
      else if (y[i] > 1 + EDGE) y[i] -= span;
      // a huge step can still land outside after one wrap
      if (x[i] < -EDGE || x[i] > 1 + EDGE || y[i] < -EDGE || y[i] > 1 + EDGE) this.spawn(i, true);
    }
  }

  // anywhere on screen when scattering, otherwise where this kind enters
  private spawn(i: number, scatter: boolean): void {
    const r = this.random;
    this.seed[i] = r();
    this.phase[i] = r() * TAU;
    this.depth[i] = r();
    this.age[i] = 0;
    this.x[i] = r();
    this.y[i] = r();
    this.vx[i] = 0;
    this.vy[i] = 0;
    const d = this.depth[i];
    switch (this.kind) {
      case "dust":
        this.vx[i] = (r() - 0.5) * 0.02;
        this.vy[i] = (r() - 0.5) * 0.02 - 0.004;
        this.radius[i] = 0.002 + 0.006 * r() * r();
        break;
      case "snow":
        this.depth[i] = 0.25 + 0.75 * d * d;
        this.vx[i] = 0.004 + (r() - 0.5) * 0.01;
        this.vy[i] = 0.035 + 0.11 * this.depth[i];
        this.radius[i] = 0.0012 + 0.0045 * this.depth[i];
        if (!scatter) this.y[i] = -EDGE * r();
        break;
      case "stars": {
        this.radius[i] = 0.001 + 0.0026 * d * d;
        this.vx[i] = (r() - 0.5) * 0.004;
        this.vy[i] = (r() - 0.5) * 0.004;
        if (!scatter) {
          const a = r() * TAU;
          const dist = 0.04 + 0.3 * r();
          this.x[i] = 0.5 + Math.cos(a) * dist;
          this.y[i] = 0.5 + Math.sin(a) * dist;
        }
        break;
      }
      case "fireflies":
        this.radius[i] = 0.0025 + 0.003 * r();
        break;
      default:
        this.radius[i] = 0;
    }
  }
}
