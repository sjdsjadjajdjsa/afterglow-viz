import { useCallback, useState } from "react";
import type { Settings } from "../settings";
import { getStorage, loadPresets, putPreset, removePreset, savePresets, type Preset } from "./storage";

export interface Presets {
  list: Preset[];
  // false when the last write didn't reach storage; the list still works in memory
  stored: boolean;
  save(name: string, settings: Settings): boolean;
  remove(name: string): void;
}

export function usePresets(): Presets {
  const [list, setList] = useState<Preset[]>(() => loadPresets(getStorage()));
  const [stored, setStored] = useState(true);

  const commit = useCallback((next: Preset[]) => {
    setList(next);
    setStored(savePresets(getStorage(), next));
  }, []);

  const save = useCallback(
    (name: string, settings: Settings) => {
      const next = putPreset(list, name, settings);
      if (next) commit(next);
      return next !== null;
    },
    [list, commit],
  );

  const remove = useCallback((name: string) => commit(removePreset(list, name)), [list, commit]);

  return { list, stored, save, remove };
}
