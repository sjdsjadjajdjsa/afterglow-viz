import { clamp01 } from "../../util/math";
import { ParticleField } from "../extras/particleField";
import { createCanvas, GLOW, paintSprite, SOFT, SPRITE } from "../extras/sprites";
import type { DrawInfo, Layer } from "../types";

// palette colors for dust and fireflies, then the two white sprites
const BUCKETS = 6;
const SNOW_CELL = BUCKETS;
const STAR_CELL = BUCKETS + 1;
const SNOW_RGB: [number, number, number] = [236, 242, 255];
const STAR_RGB: [number, number, number] = [222, 232, 255];

export function createParticlesLayer(): Layer {
  const field = new ParticleField(7);
  let atlas: HTMLCanvasElement | null = null;
  let actx: CanvasRenderingContext2D | null = null;
  // what each colored cell was last painted with, so unchanged cells are skipped
  const painted = new Int32Array(BUCKETS).fill(-1);
  let paintedKind = "";

  function paintColors(d: DrawInfo, ctx: CanvasRenderingContext2D, fireflies: boolean): void {
    const kind = fireflies ? "fireflies" : "dust";
    const shift = d.time * d.settings.color.speed * 0.1;
    for (let k = 0; k < BUCKETS; k++) {
      const c = d.color(k / BUCKETS + shift);
      const packed = (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
      if (packed === painted[k] && kind === paintedKind) continue;
      painted[k] = packed;
      // dust is a softened tint, fireflies keep their color with a bright core
      if (!fireflies) for (let j = 0; j < 3; j++) c[j] += (255 - c[j]) * 0.35;
      paintSprite(ctx, k, c, fireflies ? GLOW : SOFT, fireflies ? 0.7 : 0.2);
    }
    paintedKind = kind;
  }

  return {
    draw(d: DrawInfo) {
      const { kind, amount, speed } = d.settings.particles;
      field.sync(kind, amount);
      if (field.count === 0) return;
      const { frame } = d;
      field.step({ width: d.width, height: d.height, size: d.size, dt: d.dt, time: d.time, speed, level: frame.level, beat: frame.beat });

      if (!atlas) {
        atlas = createCanvas(SPRITE * (BUCKETS + 2), SPRITE);
        actx = atlas.getContext("2d");
        if (!actx) return;
        paintSprite(actx, SNOW_CELL, SNOW_RGB, SOFT, 0.5);
        paintSprite(actx, STAR_CELL, STAR_RGB, GLOW, 1);
      }
      if (!actx) return;
      if (kind === "dust" || kind === "fireflies") paintColors(d, actx, kind === "fireflies");

      const { ctx, time, size } = d;
      const { x, y, radius, depth, seed, phase, age } = field;
      const minR = 0.7 * d.dpr;
      const beat = frame.beat;
      const level = frame.level;
      const grow = 1 + 0.15 * beat;
      ctx.globalCompositeOperation = kind === "dust" || kind === "snow" ? "source-over" : "lighter";

      for (let i = 0; i < field.count; i++) {
        const fade = age[i] < 1.5 ? age[i] / 1.5 : 1;
        let alpha: number;
        let cell: number;
        let spread: number;
        if (kind === "dust") {
          alpha = (0.18 + 0.32 * depth[i]) * (0.75 + 0.25 * Math.sin(time * 0.7 + phase[i])) + 0.2 * beat * depth[i];
          cell = Math.floor(seed[i] * BUCKETS);
          spread = 2.4;
        } else if (kind === "snow") {
          alpha = 0.3 + 0.55 * depth[i] + 0.1 * level;
          cell = SNOW_CELL;
          spread = 2.2;
        } else if (kind === "stars") {
          const twinkle = 0.55 + 0.45 * Math.sin(time * (1.2 + 3 * seed[i]) + phase[i]);
          // stars born near the center fade in as they move out
          const dx = x[i] - 0.5;
          const dy = y[i] - 0.5;
          const out = clamp01((dx * dx + dy * dy) * 30);
          alpha = (0.35 + 0.65 * depth[i]) * twinkle * out + 0.3 * beat * depth[i];
          cell = STAR_CELL;
          spread = 3.2;
        } else {
          const p = 0.5 + 0.5 * Math.sin(time * (0.9 + 1.2 * seed[i]) + seed[i] * 40);
          alpha = 0.12 + 0.88 * p * p * p + 0.2 * beat;
          cell = Math.floor(seed[i] * BUCKETS);
          spread = 4;
        }
        alpha *= fade;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        const r = Math.max(minR, radius[i] * size * grow) * spread;
        ctx.drawImage(atlas, cell * SPRITE, 0, SPRITE, SPRITE, x[i] * d.width - r, y[i] * d.height - r, r * 2, r * 2);
      }
    },
  };
}
