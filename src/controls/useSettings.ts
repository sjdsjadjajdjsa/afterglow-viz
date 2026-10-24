import { useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../settings";

export function useSettings(): [Settings, (next: Settings) => void] {
  return useState<Settings>(DEFAULT_SETTINGS);
}
