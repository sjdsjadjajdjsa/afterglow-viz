import { clamp01 } from "../../util/math";

// remembers what the blurred art was rendered for, so it is only redone
// when the image or the canvas size changes
export class RenderKey<T> {
  private source: T | null = null;
  private width = 0;
  private height = 0;

  matches(source: T | null, width: number, height: number): boolean {
    return source === this.source && width === this.width && height === this.height;
  }

  sourceChanged(source: T | null): boolean {
    return source !== this.source;
  }

  set(source: T | null, width: number, height: number): void {
    this.source = source;
    this.width = width;
    this.height = height;
  }
}

// alpha of the black layer drawn over the background. louder parts lift it a little
export function dimAlpha(dim: number, level = 0): number {
  return clamp01(clamp01(dim) * (1 - 0.18 * clamp01(level)));
}

// size of the offscreen canvas the art is blurred into. a small canvas is
// much cheaper to blur, and the detail is blurred away anyway
export function blurCanvasSize(width: number, height: number, max = 480): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}
