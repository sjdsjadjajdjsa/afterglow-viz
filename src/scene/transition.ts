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
