import { approach } from "../../util/math";
import { blurCanvasSize, dimAlpha, RenderKey } from "../extras/backdrop";
import { coverCrop, createCrop } from "../extras/cover";
import { createCanvas } from "../extras/sprites";
import type { DrawInfo, Layer } from "../types";

const FADE_S = 1.2;

// the art-blur and gradient backgrounds are soft all over, so they are
// composed every frame on a small canvas and stretched to the screen once
export function createBackgroundLayer(): Layer {
  const key = new RenderKey<HTMLImageElement>();
  const crop = createCrop();
  const sizeKey = new RenderKey<null>();
  let small: HTMLCanvasElement | null = null;
  let sctx: CanvasRenderingContext2D | null = null;
  // cur holds the blurred art for key's image, prev the one before it while they crossfade
  let cur: HTMLCanvasElement | null = null;
  let prev: HTMLCanvasElement | null = null;
  let hasPrev = false;
  let mix = 1;
  let visible = 0;

  function renderBlur(img: HTMLImageElement, target: HTMLCanvasElement, bw: number, bh: number): void {
    target.width = bw;
    target.height = bh;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const blur = Math.max(bw, bh) * 0.045;
    // draw past the edges so the blur doesn't pull in transparent black there
    const pad = blur * 2.5;
    coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, (bw + pad * 2) / (bh + pad * 2), crop);
    ctx.filter = `blur(${blur.toFixed(1)}px) saturate(1.35) brightness(0.82)`;
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, -pad, -pad, bw + pad * 2, bh + pad * 2);
    ctx.filter = "none";
    const v = ctx.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.25, bw / 2, bh / 2, Math.hypot(bw, bh) / 2);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, bw, bh);
  }

  function drawBlur(ctx: CanvasRenderingContext2D, w: number, h: number, d: DrawInfo, canvas: HTMLCanvasElement, alpha: number): void {
    if (alpha <= 0.002) return;
    const t = d.time;
    // slow breathing and drift, a touch bigger when it's loud. 1.08 leaves room for the drift
    const scale = 1.08 + 0.025 * Math.sin(t * 0.07) + 0.02 * d.frame.level;
    const sw = w * scale;
    const sh = h * scale;
    const ox = Math.sin(t * 0.031) * w * 0.015;
    const oy = Math.cos(t * 0.023) * h * 0.015;
    ctx.globalAlpha = alpha;
    ctx.drawImage(canvas, (w - sw) / 2 + ox, (h - sh) / 2 + oy, sw, sh);
    ctx.globalAlpha = 1;
  }

  function dim(ctx: CanvasRenderingContext2D, w: number, h: number, d: DrawInfo): void {
    const a = dimAlpha(d.settings.background.dim, d.frame.level);
    if (a <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    draw(d: DrawInfo) {
      const { ctx, width, height } = d;
      const bg = d.settings.background;

      if (bg.kind === "solid") {
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, width, height);
        dim(ctx, width, height, d);
        return;
      }

      const [bw, bh] = blurCanvasSize(width, height);
      if (!small || !sizeKey.matches(null, bw, bh)) {
        small = small ?? createCanvas(1, 1);
        small.width = bw;
        small.height = bh;
        sctx = small.getContext("2d");
        sizeKey.set(null, bw, bh);
      }
      const sc = sctx;
      if (!sc) return;

      if (bg.kind === "gradient") {
        drawGradient(sc, bw, bh, d);
      } else {
        const img = d.track.art;
        if (img && !key.matches(img, bw, bh)) {
          if (!cur) cur = createCanvas(1, 1);
          if (key.sourceChanged(img) && visible > 0.01) {
            if (!prev) prev = createCanvas(1, 1);
            const t = prev;
            prev = cur;
            cur = t;
            hasPrev = true;
            mix = 0;
          } else {
            hasPrev = false;
            mix = 1;
          }
          renderBlur(img, cur, bw, bh);
          key.set(img, bw, bh);
        }
        visible = approach(visible, img ? 1 : 0, d.dt * 1000, 450);
        mix = Math.min(1, mix + d.dt / FADE_S);
        if (mix >= 1) hasPrev = false;

        if (visible < 0.999) drawGradient(sc, bw, bh, d);
        if (hasPrev && prev) drawBlur(sc, bw, bh, d, prev, visible);
        if (cur) drawBlur(sc, bw, bh, d, cur, visible * mix);
      }
      dim(sc, bw, bh, d);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, width, height);
    },
  };
}

// a dark base with a few big soft blobs of palette color wandering around it
function drawGradient(ctx: CanvasRenderingContext2D, width: number, height: number, d: DrawInfo): void {
  const time = d.time;
  const shift = time * d.settings.color.speed * 0.05;
  const base = d.color(shift);
  ctx.fillStyle = `rgb(${Math.round(base[0] * 0.1)},${Math.round(base[1] * 0.1)},${Math.round(base[2] * 0.1)})`;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.max(width, height) * 0.75;
  const glow = 0.42 + 0.12 * d.frame.level;
  for (let k = 0; k < 3; k++) {
    const c = d.color(shift + k / 3);
    const x = width / 2 + Math.cos(time * (0.043 + 0.017 * k) + k * 2.1) * width * 0.38;
    const y = height / 2 + Math.sin(time * (0.037 + 0.013 * k) + k * 1.3) * height * 0.36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    const rgb = `${Math.round(c[0] * 0.8)},${Math.round(c[1] * 0.8)},${Math.round(c[2] * 0.8)}`;
    g.addColorStop(0, `rgba(${rgb},${glow.toFixed(3)})`);
    g.addColorStop(0.45, `rgba(${rgb},${(glow * 0.35).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
