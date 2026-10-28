import { coverCrop, createCrop } from "../extras/cover";
import { createCanvas } from "../extras/sprites";
import type { DrawInfo, Layer } from "../types";

const TAU = Math.PI * 2;

function centerRadius(size: number, setting: number, pulse: number, beat: number): number {
  return size * (0.06 + 0.16 * setting) * (1 + 0.07 * pulse * beat);
}

export function createCenterpieceLayer(): Layer {
  const crop = createCrop();
  let shown = 0;
  let lastImg: HTMLImageElement | null = null;
  let shadow: HTMLCanvasElement | null = null;
  let shadowFor = 0;
  let art: HTMLCanvasElement | null = null;
  let artFor = "";
  let artImg: HTMLImageElement | null = null;

  function shadowSprite(r: number): HTMLCanvasElement | null {
    if (shadow && shadowFor === r) return shadow;
    const e = Math.ceil(r * 1.4);
    shadow ??= createCanvas(1, 1);
    shadow.width = shadow.height = e * 2;
    const ctx = shadow.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(e, e + r * 0.04, r * 0.85, e, e + r * 0.04, r * 1.32);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(0.4, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e, e, r * 1.32, 0, TAU);
    ctx.fill();
    shadowFor = r;
    return shadow;
  }

  function artSprite(img: HTMLImageElement, r: number, dpr: number): HTMLCanvasElement | null {
    const key = r + "|" + dpr;
    if (art && artImg === img && artFor === key) return art;
    coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, 1, crop);
    if (crop.sw <= 0) return null;
    art ??= createCanvas(1, 1);
    art.width = art.height = r * 2;
    const ctx = art.getContext("2d");
    if (!ctx) return null;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, r * 2, r * 2);
    ctx.restore();
    rim(ctx, r, r, r, dpr);
    artImg = img;
    artFor = key;
    return art;
  }

  return {
    draw(d: DrawInfo) {
      const cp = d.settings.centerpiece;
      if (cp.kind === "none") return;
      const img = cp.kind === "image" ? d.track.centerImage : d.track.art;
      const { ctx, cx, cy, frame } = d;
      const r = centerRadius(d.size, cp.size, cp.pulse, frame.beat);

      // fade a new image in instead of popping
      if (img !== lastImg) {
        lastImg = img;
        shown = 0;
      }
      shown = Math.min(1, shown + d.dt / 0.4);

      // the shadow and the clipped art only change with the image and size, so
      // they're painted once at the biggest pulse and scaled down to fit
      const big = Math.ceil(centerRadius(d.size, cp.size, cp.pulse, 1));
      const k = r / big;
      const shadow = shadowSprite(big);
      if (shadow) {
        const e = shadow.width / 2;
        ctx.drawImage(shadow, cx - e * k, cy - e * k, e * 2 * k, e * 2 * k);
      }

      // a faint halo in the current color that swells on the beat
      const glow = 0.12 + 0.3 * cp.pulse * frame.beat;
      if (glow > 0.01) {
        const c = d.color(d.time * d.settings.color.speed * 0.1);
        const rgb = `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;
        const halo = ctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.22);
        halo.addColorStop(0, `rgba(${rgb},${glow.toFixed(3)})`);
        halo.addColorStop(1, `rgba(${rgb},0)`);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.22, 0, TAU);
        // a ring, since the gradient would also fill the inside
        ctx.arc(cx, cy, r * 0.98, 0, TAU, true);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      const art = img ? artSprite(img, big, d.dpr) : null;
      if (art) {
        ctx.globalAlpha = shown;
        ctx.drawImage(art, cx - r, cy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      } else {
        rim(ctx, cx, cy, r, d.dpr);
      }
    },
  };
}

// a thin light rim keeps the edge crisp on any background
function rim(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dpr: number): void {
  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU);
  ctx.stroke();
}
