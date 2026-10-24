import { sanitize, type Settings } from "../settings";
import { isObj } from "../util/read";

export const SETTINGS_KEY = "afterglow-viz:settings";
export const PRESETS_KEY = "afterglow-viz:presets";
export const MAX_NAME = 40;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface Preset {
  name: string;
  settings: Settings;
}

// localStorage itself can throw on access (disabled, sandboxed)
export function getStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(storage: StorageLike | null): Settings | null {
  const value = readJson(storage, SETTINGS_KEY);
  return isObj(value) ? sanitize(value) : null;
}

export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings);
}

// trimmed, inner whitespace collapsed, null when empty
export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
  return clean || null;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function loadPresets(storage: StorageLike | null): Preset[] {
  const value = readJson(storage, PRESETS_KEY);
  if (!Array.isArray(value)) return [];
  const out: Preset[] = [];
  for (const item of value) {
    if (!isObj(item)) continue;
    const name = cleanName(item.name);
    if (!name || out.some((p) => sameName(p.name, name))) continue;
    out.push({ name, settings: sanitize(item.settings) });
  }
  return out;
}

export function savePresets(storage: StorageLike | null, presets: Preset[]): boolean {
  return writeJson(storage, PRESETS_KEY, presets);
}

// adds a preset, or replaces the one with the same name (any case) in place
export function putPreset(presets: Preset[], name: string, settings: Settings): Preset[] | null {
  const clean = cleanName(name);
  if (!clean) return null;
  const preset = { name: clean, settings: sanitize(settings) };
  const i = presets.findIndex((p) => sameName(p.name, clean));
  if (i < 0) return [...presets, preset];
  const next = presets.slice();
  next[i] = preset;
  return next;
}

export function removePreset(presets: Preset[], name: string): Preset[] {
  return presets.filter((p) => !sameName(p.name, name));
}

export function findPreset(presets: Preset[], name: string): Preset | undefined {
  const clean = cleanName(name);
  return clean ? presets.find((p) => sameName(p.name, clean)) : undefined;
}
