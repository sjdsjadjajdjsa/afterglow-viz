import type { RGB } from "../../color/getColor";

export const SPRITE = 64;

// stops for a round sprite, from the center out: [offset, alpha]
export type Falloff = readonly (readonly [number, number])[];

export const SOFT: Falloff = [
  [0, 1],
  [0.25, 0.8],
  [0.6, 0.25],
  [1, 0],
];

export const GLOW: Falloff = [
  [0, 1],
  [0.08, 0.95],
  [0.18, 0.45],
  [0.45, 0.12],
  [1, 0],
];

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

// draws one sprite into a SPRITE x SPRITE cell of an atlas.
// core is mixed toward white so colored sprites get a hot center
export function paintSprite(ctx: CanvasRenderingContext2D, cell: number, [r, g, b]: RGB, falloff: Falloff, core = 0): void {
  const half = SPRITE / 2;
  const x = cell * SPRITE;
  ctx.clearRect(x, 0, SPRITE, SPRITE);
  const grad = ctx.createRadialGradient(x + half, half, 0, x + half, half, half);
  for (let i = 0; i < falloff.length; i++) {
    const [at, alpha] = falloff[i];
    const w = i === 0 ? core : 0;
    const cr = Math.round(r + (255 - r) * w);
    const cg = Math.round(g + (255 - g) * w);
    const cb = Math.round(b + (255 - b) * w);
    grad.addColorStop(at, `rgba(${cr},${cg},${cb},${alpha})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, SPRITE, SPRITE);
}
