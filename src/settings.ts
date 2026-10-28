import { asObj } from "./util/read";

export const SHAPES = ["rings", "spectrum", "both"] as const;
export const COLOR_MODES = ["rainbow", "album", "centerpiece", "single"] as const;
export const CENTER_KINDS = ["none", "album", "image"] as const;
export const BACKGROUNDS = ["solid", "art-blur", "gradient"] as const;
export const PARTICLES = ["none", "dust", "snow", "stars", "fireflies"] as const;
export const PERFORMANCE = ["auto", "quality", "balanced", "saver"] as const;

export interface Settings {
  shape: (typeof SHAPES)[number];
  rings: { count: number; size: number; spread: number; thickness: number };
  spectrum: { size: number; spread: number; thickness: number };
  color: { mode: (typeof COLOR_MODES)[number]; single: string; saturation: number; speed: number };
  centerpiece: { kind: (typeof CENTER_KINDS)[number]; image: string | null; size: number; pulse: number };
  background: { kind: (typeof BACKGROUNDS)[number]; color: string; dim: number };
  particles: { kind: (typeof PARTICLES)[number]; amount: number; speed: number; size: number };
  sensitivity: number;
  // how much work each frame may cost, kept when a preset is picked
  performance: (typeof PERFORMANCE)[number];
}

export const DEFAULT_SETTINGS: Settings = {
  shape: "both",
  rings: { count: 4, size: 0.5, spread: 0.5, thickness: 0.4 },
  spectrum: { size: 0.5, spread: 0.6, thickness: 0.5 },
  color: { mode: "album", single: "#1ed760", saturation: 1, speed: 0.3 },
  centerpiece: { kind: "album", image: null, size: 0.5, pulse: 0.5 },
  background: { kind: "art-blur", color: "#000000", dim: 0.6 },
  particles: { kind: "dust", amount: 0.4, speed: 0.4, size: 0.5 },
  sensitivity: 1,
  performance: "auto",
};

// [min, max, step] for every number setting, by path
export const RANGES: Record<string, [number, number, number]> = {
  "rings.count": [1, 12, 1],
  "rings.size": [0, 1, 0.01],
  "rings.spread": [0, 1, 0.01],
  "rings.thickness": [0, 1, 0.01],
  "spectrum.size": [0, 1, 0.01],
  "spectrum.spread": [0, 1, 0.01],
  "spectrum.thickness": [0, 1, 0.01],
  "color.saturation": [0, 1, 0.01],
  "color.speed": [0, 1, 0.01],
  "centerpiece.size": [0, 1, 0.01],
  "centerpiece.pulse": [0, 1, 0.01],
  "background.dim": [0, 1, 0.01],
  "particles.amount": [0, 1, 0.01],
  "particles.speed": [0, 1, 0.01],
  "particles.size": [0, 1, 0.01],
  sensitivity: [0, 2, 0.01],
};

const CHOICES: Record<string, readonly string[]> = {
  shape: SHAPES,
  "color.mode": COLOR_MODES,
  "centerpiece.kind": CENTER_KINDS,
  "background.kind": BACKGROUNDS,
  "particles.kind": PARTICLES,
  performance: PERFORMANCE,
};

const HEX = /^#[0-9a-f]{6}$/i;

// builds valid settings from anything (old presets, hand-edited storage), falling back to defaults per field
export function sanitize(input: unknown): Settings {
  return walk(DEFAULT_SETTINGS, input, "") as Settings;
}

function walk(def: unknown, value: unknown, path: string): unknown {
  if (def !== null && typeof def === "object") {
    const src = asObj(value);
    const out: Record<string, unknown> = {};
    for (const [key, d] of Object.entries(def)) out[key] = walk(d, src[key], path ? `${path}.${key}` : key);
    return out;
  }
  if (typeof def === "number") {
    const [min, max, step] = RANGES[path] ?? [-Infinity, Infinity, 0];
    if (typeof value !== "number" || !Number.isFinite(value)) return def;
    const clamped = Math.min(max, Math.max(min, value));
    return step >= 1 ? Math.round(clamped) : clamped;
  }
  if (path in CHOICES) return CHOICES[path].includes(value as string) ? value : def;
  if (path === "centerpiece.image") return typeof value === "string" && value.startsWith("data:image/") ? value : null;
  if (typeof def === "string") return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : def;
  return def;
}
