import { describe, expect, it } from "vitest";
import { BUILTIN_PRESETS } from "../src/controls/builtins";
import {
  PRESETS_KEY,
  SETTINGS_KEY,
  cleanName,
  findPreset,
  loadPresets,
  loadSettings,
  putPreset,
  removePreset,
  savePresets,
  saveSettings,
  type StorageLike,
} from "../src/controls/storage";
import { DEFAULT_SETTINGS, sanitize, type Settings } from "../src/settings";

function memory(init: Record<string, string> = {}): StorageLike {
  const data = { ...init };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

const full: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

const broken: StorageLike = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

const custom: Settings = sanitize({ shape: "rings", rings: { count: 9 }, color: { mode: "single", single: "#ff0000" } });

describe("settings storage", () => {
  it("round trips", () => {
    const s = memory();
    expect(saveSettings(s, custom)).toBe(true);
    expect(loadSettings(s)).toEqual(custom);
  });

  it("returns null when nothing is stored or it's junk", () => {
    expect(loadSettings(memory())).toBeNull();
    expect(loadSettings(null)).toBeNull();
    expect(loadSettings(broken)).toBeNull();
    for (const junk of ["{not json", "null", "42", '"x"', "[1,2]"]) {
      expect(loadSettings(memory({ [SETTINGS_KEY]: junk }))).toBeNull();
    }
  });

  it("fixes bad fields through sanitize", () => {
    const s = memory({ [SETTINGS_KEY]: JSON.stringify({ shape: "blob", rings: { count: 3 }, sensitivity: 50 }) });
    const loaded = loadSettings(s)!;
    expect(loaded.shape).toBe(DEFAULT_SETTINGS.shape);
    expect(loaded.rings.count).toBe(3);
    expect(loaded.sensitivity).toBe(2);
  });

  it("reports a failed save instead of throwing", () => {
    expect(saveSettings(full, custom)).toBe(false);
    expect(saveSettings(broken, custom)).toBe(false);
    expect(saveSettings(null, custom)).toBe(false);
  });
});

describe("presets", () => {
  it("round trips", () => {
    const s = memory();
    const list = putPreset(putPreset([], "Red rings", custom)!, "Plain", DEFAULT_SETTINGS)!;
    expect(savePresets(s, list)).toBe(true);
    expect(loadPresets(s)).toEqual(list);
    expect(findPreset(loadPresets(s), "red rings")?.settings).toEqual(custom);
  });

  it("skips junk entries and keeps good ones", () => {
    const s = memory({
      [PRESETS_KEY]: JSON.stringify([
        null,
        "x",
        { name: "  " },
        { name: 5, settings: {} },
        { name: " Good ", settings: { shape: "spectrum", rings: { count: "lots" } } },
        { name: "good", settings: {} },
        { name: "No settings" },
      ]),
    });
    const list = loadPresets(s);
    expect(list.map((p) => p.name)).toEqual(["Good", "No settings"]);
    expect(list[0].settings.shape).toBe("spectrum");
    expect(list[0].settings.rings.count).toBe(DEFAULT_SETTINGS.rings.count);
    expect(list[1].settings).toEqual(DEFAULT_SETTINGS);
  });

  it("returns an empty list for junk or broken storage", () => {
    expect(loadPresets(memory({ [PRESETS_KEY]: "{oops" }))).toEqual([]);
    expect(loadPresets(memory({ [PRESETS_KEY]: '{"name":"a"}' }))).toEqual([]);
    expect(loadPresets(broken)).toEqual([]);
    expect(loadPresets(null)).toEqual([]);
  });

  it("reports a quota error on save and leaves the list usable", () => {
    const list = putPreset([], "Big", custom)!;
    expect(savePresets(full, list)).toBe(false);
    expect(list).toHaveLength(1);
  });

  it("overwrites a preset with the same name in place", () => {
    let list = putPreset([], "One", DEFAULT_SETTINGS)!;
    list = putPreset(list, "Two", DEFAULT_SETTINGS)!;
    list = putPreset(list, "  one ", custom)!;
    expect(list.map((p) => p.name)).toEqual(["one", "Two"]);
    expect(list[0].settings).toEqual(custom);
  });

  it("deletes by name, any case", () => {
    let list = putPreset(putPreset([], "One", DEFAULT_SETTINGS)!, "Two", custom)!;
    list = removePreset(list, "ONE");
    expect(list.map((p) => p.name)).toEqual(["Two"]);
    expect(removePreset(list, "missing")).toEqual(list);
  });

  it("trims names and rejects empty ones", () => {
    expect(cleanName("  Late   night  ")).toBe("Late night");
    expect(cleanName("")).toBeNull();
    expect(cleanName("   \n\t")).toBeNull();
    expect(cleanName(undefined)).toBeNull();
    expect(cleanName("x".repeat(100))).toHaveLength(40);
    expect(putPreset([], "   ", custom)).toBeNull();
  });

  it("doesn't share objects with the settings passed in", () => {
    const settings = sanitize({});
    const list = putPreset([], "A", settings)!;
    settings.rings.count = 11;
    expect(list[0].settings.rings.count).toBe(DEFAULT_SETTINGS.rings.count);
  });

  it("has built-ins that are valid and look different", () => {
    const names = new Set(BUILTIN_PRESETS.map((p) => p.name.toLowerCase()));
    expect(names.size).toBe(BUILTIN_PRESETS.length);
    for (const p of BUILTIN_PRESETS) expect(sanitize(p.settings)).toEqual(p.settings);
    const looks = new Set(BUILTIN_PRESETS.map((p) => JSON.stringify(p.settings)));
    expect(looks.size).toBe(BUILTIN_PRESETS.length);
  });
});
