import { DEFAULT_SETTINGS, sanitize } from "../settings";
import type { Preset } from "./storage";

// fields left out fall back to the defaults
export const BUILTIN_PRESETS: Preset[] = [
  { name: "Afterglow", settings: sanitize(DEFAULT_SETTINGS) },
  {
    name: "Neon",
    settings: sanitize({
      shape: "rings",
      rings: { count: 7, size: 0.6, spread: 0.7, thickness: 0.25 },
      color: { mode: "rainbow", saturation: 1, speed: 0.6 },
      centerpiece: { kind: "none" },
      background: { kind: "gradient", dim: 0.75 },
      particles: { kind: "stars", amount: 0.6, speed: 0.3 },
      sensitivity: 1.2,
    }),
  },
  {
    name: "Mono",
    settings: sanitize({
      shape: "spectrum",
      spectrum: { size: 0.6, spread: 0.8, thickness: 0.35 },
      color: { mode: "single", single: "#ffffff", saturation: 0 },
      centerpiece: { kind: "album", size: 0.4, pulse: 0.2 },
      background: { kind: "solid", color: "#000000" },
      particles: { kind: "none" },
    }),
  },
  {
    name: "Fireflies",
    settings: sanitize({
      shape: "both",
      rings: { count: 2, size: 0.4, spread: 0.3, thickness: 0.6 },
      spectrum: { size: 0.35, spread: 0.4, thickness: 0.7 },
      color: { mode: "album", saturation: 0.8, speed: 0.15 },
      centerpiece: { kind: "album", size: 0.6, pulse: 0.8 },
      background: { kind: "art-blur", dim: 0.8 },
      particles: { kind: "fireflies", amount: 0.7, speed: 0.25 },
      sensitivity: 0.8,
    }),
  },
];
