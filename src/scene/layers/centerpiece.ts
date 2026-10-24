import type { DrawInfo, Layer } from "../types";

export function createCenterpieceLayer(): Layer {
  return {
    draw(d: DrawInfo) {
      const img = d.settings.centerpiece.kind === "image" ? d.track.centerImage : d.settings.centerpiece.kind === "album" ? d.track.art : null;
      if (!img) return;
      const r = d.size * 0.15;
      d.ctx.beginPath();
      d.ctx.arc(d.cx, d.cy, r, 0, Math.PI * 2);
      d.ctx.clip();
      d.ctx.drawImage(img, d.cx - r, d.cy - r, r * 2, r * 2);
    },
  };
}
