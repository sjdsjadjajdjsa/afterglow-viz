import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { getStorage, loadSettings, saveSettings } from "./storage";

const SAVE_DELAY_MS = 300;

export type SetSettings = (next: Settings | ((prev: Settings) => Settings)) => void;

// sliders fire on every step, so writes are batched, and flushed when the app closes
export function useSettings(): [Settings, SetSettings] {
  const [settings, setState] = useState<Settings>(() => loadSettings(getStorage()) ?? DEFAULT_SETTINGS);
  const latest = useRef(settings);
  const dirty = useRef(false);

  // updaters see the latest value, so a slow image pick can't undo newer changes
  const setSettings: SetSettings = useCallback((next) => {
    const value = typeof next === "function" ? next(latest.current) : next;
    latest.current = value;
    dirty.current = true;
    setState(value);
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      saveSettings(getStorage(), latest.current);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      saveSettings(getStorage(), latest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return [settings, setSettings];
}
