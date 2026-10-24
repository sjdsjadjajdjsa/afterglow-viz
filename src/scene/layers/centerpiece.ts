import { coverCrop, createCrop } from "../extras/cover";
import type { DrawInfo, Layer } from "../types";

const TAU = Math.PI * 2;

function centerRadius(size: number, setting: number, pulse: number, beat: number): number {
  return size * (0.06 + 0.16 * setting) * (1 + 0.07 * pulse * beat);
}

export function createCenterpieceLayer(): Layer {
  const crop = createCrop();
  let shown = 0;
  let lastImg: HTMLImageElement | null = null;

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

      // soft shadow so it floats over the shapes
      const shadow = ctx.createRadialGradient(cx, cy + r * 0.04, r * 0.85, cx, cy + r * 0.04, r * 1.32);
      shadow.addColorStop(0, "rgba(0,0,0,0.5)");
      shadow.addColorStop(0.4, "rgba(0,0,0,0.22)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.32, 0, TAU);
      ctx.fill();

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

      if (img) {
        coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, 1, crop);
        if (crop.sw > 0) {
          ctx.save();
          ctx.clip();
          ctx.globalAlpha = shown;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
        }
      }

      // a thin light rim keeps the edge crisp on any background
      ctx.lineWidth = Math.max(1, d.dpr);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU);
      ctx.stroke();
    },
  };
}
