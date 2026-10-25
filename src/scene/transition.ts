import type { Settings } from "../settings";

export const FADE_MS = 450;

// true when the change is worth a crossfade: a different option or look.
// dragging one slider changes a single number and is already smooth
export function bigChange(a: Settings, b: Settings): boolean {
  let numbers = 0;
  const walk = (x: unknown, y: unknown): boolean => {
    if (x === y) return false;
    if (typeof x === "number" && typeof y === "number") return ++numbers >= 2;
    if (x && y && typeof x === "object" && typeof y === "object") {
      for (const key of Object.keys(x)) {
        if (walk((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key])) return true;
      }
      return false;
    }
    return true;
  };
  return walk(a, b);
}

const EASE_MS = 160;
// whole numbers that can't be in between
const STEPPED = new Set(["rings.count"]);

// moves every number in `shown` a step toward `target`, so slider moves and
// new looks glide instead of jump. everything else is copied straight over
export function easeSettings(shown: Settings, target: Settings, dtMs: number): void {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / EASE_MS);
  ease(shown as unknown as Record<string, unknown>, target as unknown as Record<string, unknown>, k, "");
}

function ease(shown: Record<string, unknown>, target: Record<string, unknown>, k: number, path: string): void {
  for (const key in target) {
    const to = target[key];
    const from = shown[key];
    const at = path ? `${path}.${key}` : key;
    if (typeof to === "number" && typeof from === "number" && !STEPPED.has(at)) {
      const next = from + (to - from) * k;
      shown[key] = Math.abs(to - next) < 1e-4 ? to : next;
    } else if (to && typeof to === "object" && from && typeof from === "object") {
      ease(from as Record<string, unknown>, to as Record<string, unknown>, k, at);
    } else {
      shown[key] = to;
    }
  }
}
