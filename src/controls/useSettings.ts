import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { getStorage, loadSettings, saveSettings } from "./storage";

const SAVE_DELAY_MS = 300;

// sliders fire on every step, so writes are batched, and flushed when the app closes
export function useSettings(): [Settings, (next: Settings) => void] {
  const [settings, setState] = useState<Settings>(() => loadSettings(getStorage()) ?? DEFAULT_SETTINGS);
  const latest = useRef(settings);
  const dirty = useRef(false);

  const setSettings = useCallback((next: Settings) => {
    latest.current = next;
    dirty.current = true;
    setState(next);
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
