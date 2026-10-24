import React from "react";
import type { Settings } from "../settings";

export interface ControlsProps {
  settings: Settings;
  setSettings: (next: Settings) => void;
  onDiagnostics: () => void;
}

export function Controls({ onDiagnostics }: ControlsProps) {
  return (
    <div className="agv-controls">
      <button className="agv-btn agv-btn-small" onClick={onDiagnostics}>
        Diagnostics
      </button>
    </div>
  );
}
