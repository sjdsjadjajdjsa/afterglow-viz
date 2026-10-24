import React, { useRef, useState } from "react";
import {
  BACKGROUNDS,
  CENTER_KINDS,
  COLOR_MODES,
  DEFAULT_SETTINGS,
  PARTICLES,
  RANGES,
  SHAPES,
  sanitize,
  type Settings,
} from "../settings";
import { BUILTIN_PRESETS } from "./builtins";
import { Icon } from "./icons";
import { imageFileToDataUrl } from "./image";
import { cleanName, findPreset, type Preset } from "./storage";
import type { Presets } from "./usePresets";
import type { SetSettings } from "./useSettings";

interface Props {
  settings: Settings;
  setSettings: SetSettings;
  presets: Presets;
  stored: boolean;
  onClose: () => void;
}

type Group = "rings" | "spectrum" | "color" | "centerpiece" | "background" | "particles";

const LABELS: Record<string, string> = {
  rings: "Rings",
  spectrum: "Spectrum",
  both: "Both",
  rainbow: "Rainbow",
  album: "Album",
  centerpiece: "Centerpiece",
  single: "Single",
  none: "None",
  image: "Image",
  solid: "Solid",
  "art-blur": "Art blur",
  gradient: "Gradient",
  dust: "Dust",
  snow: "Snow",
  stars: "Stars",
  fireflies: "Fireflies",
};

export function Panel({ settings, setSettings, presets, stored, onClose }: Props) {
  const patch = <K extends Group>(key: K, values: Partial<Settings[K]>) =>
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...values } }));
  const { shape, rings, spectrum, color, centerpiece, background, particles } = settings;
  const showRings = shape !== "spectrum";
  const showSpectrum = shape !== "rings";

  return (
    <aside className="agv-panel" aria-label="Customize">
      <header className="agv-panel-head">
        <h2>Customize</h2>
        <button className="agv-icon-btn" aria-label="Close" title="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <PresetSection settings={settings} setSettings={setSettings} presets={presets} />

      <Section title="Shape">
        <Choice options={SHAPES} value={shape} onChange={(v) => setSettings((s) => ({ ...s, shape: v }))} />
        {showRings && (
          <Sub title={shape === "both" ? "Rings" : null}>
            <Slider label="Count" path="rings.count" value={rings.count} onChange={(v) => patch("rings", { count: v })} />
            <Slider label="Size" path="rings.size" value={rings.size} onChange={(v) => patch("rings", { size: v })} />
            <Slider label="Spread" path="rings.spread" value={rings.spread} onChange={(v) => patch("rings", { spread: v })} />
            <Slider label="Thickness" path="rings.thickness" value={rings.thickness} onChange={(v) => patch("rings", { thickness: v })} />
          </Sub>
        )}
        {showSpectrum && (
          <Sub title={shape === "both" ? "Spectrum" : null}>
            <Slider label="Size" path="spectrum.size" value={spectrum.size} onChange={(v) => patch("spectrum", { size: v })} />
            <Slider label="Spread" path="spectrum.spread" value={spectrum.spread} onChange={(v) => patch("spectrum", { spread: v })} />
            <Slider label="Thickness" path="spectrum.thickness" value={spectrum.thickness} onChange={(v) => patch("spectrum", { thickness: v })} />
          </Sub>
        )}
      </Section>

      <Section title="Color">
        <Choice options={COLOR_MODES} value={color.mode} onChange={(v) => patch("color", { mode: v })} />
        {color.mode === "single" && (
          <label className="agv-row">
            <span>Color</span>
            <input type="color" className="agv-swatch" value={color.single} onChange={(e) => patch("color", { single: e.target.value })} />
          </label>
        )}
        <Slider label="Saturation" path="color.saturation" value={color.saturation} onChange={(v) => patch("color", { saturation: v })} />
        {color.mode !== "single" && (
          <Slider label="Speed" path="color.speed" value={color.speed} onChange={(v) => patch("color", { speed: v })} />
        )}
      </Section>

      <Section title="Centerpiece">
        <Choice options={CENTER_KINDS} value={centerpiece.kind} onChange={(v) => patch("centerpiece", { kind: v })} />
        <ImagePicker image={centerpiece.image} onPick={(image) => patch("centerpiece", { image, kind: "image" })} />

        {centerpiece.kind !== "none" && (
          <>
            <Slider label="Size" path="centerpiece.size" value={centerpiece.size} onChange={(v) => patch("centerpiece", { size: v })} />
            <Slider label="Pulse" path="centerpiece.pulse" value={centerpiece.pulse} onChange={(v) => patch("centerpiece", { pulse: v })} />
          </>
        )}
      </Section>

      <Section title="Background">
        <Choice options={BACKGROUNDS} value={background.kind} onChange={(v) => patch("background", { kind: v })} />
        {background.kind === "solid" ? (
          <label className="agv-row">
            <span>Color</span>
            <input type="color" className="agv-swatch" value={background.color} onChange={(e) => patch("background", { color: e.target.value })} />
          </label>
        ) : (
          <Slider label="Dim" path="background.dim" value={background.dim} onChange={(v) => patch("background", { dim: v })} />
        )}
      </Section>

      <Section title="Particles">
        <Choice options={PARTICLES} value={particles.kind} onChange={(v) => patch("particles", { kind: v })} />
        {particles.kind !== "none" && (
          <>
            <Slider label="Amount" path="particles.amount" value={particles.amount} onChange={(v) => patch("particles", { amount: v })} />
            <Slider label="Speed" path="particles.speed" value={particles.speed} onChange={(v) => patch("particles", { speed: v })} />
          </>
        )}
      </Section>

      <Section title="Sensitivity">
        <Slider label="Sensitivity" hideLabel path="sensitivity" value={settings.sensitivity} onChange={(v) => setSettings((s) => ({ ...s, sensitivity: v }))} />
      </Section>

      <footer className="agv-panel-foot">
        {!(stored && presets.stored) && <p className="agv-note">Kept for this session only. Storage is full or turned off.</p>}
        <button className="agv-btn agv-btn-small" onClick={() => setSettings((s) => keepImage(sanitize(DEFAULT_SETTINGS), s))}>
          Reset to defaults
        </button>
      </footer>
    </aside>
  );
}

function PresetSection({ settings, setSettings, presets }: Omit<Props, "onClose" | "stored">) {
  const [name, setName] = useState("");
  const clean = cleanName(name);
  const existing = clean ? findPreset(presets.list, clean) : undefined;

  const chip = (p: Preset, own: boolean) => (
    <span key={(own ? "u:" : "b:") + p.name} className={"agv-chip" + (sameSettings(keepImage(p.settings, settings), settings) ? " agv-chip-on" : "")}>
      <button
        className="agv-chip-name"
        onClick={() => {
          setSettings((s) => keepImage(sanitize(p.settings), s));
          if (own) setName(p.name);
        }}
      >
        {p.name}
      </button>
      {own && (
        <button className="agv-chip-x" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => presets.remove(p.name)}>
          <Icon name="close" />
        </button>
      )}
    </span>
  );

  return (
    <Section title="Presets">
      <div className="agv-chips">
        {BUILTIN_PRESETS.map((p) => chip(p, false))}
        {presets.list.map((p) => chip(p, true))}
      </div>
      <form
        className="agv-save"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean && presets.save(clean, settings)) setName(clean);
        }}
      >
        <input
          className="agv-input"
          value={name}
          maxLength={40}
          placeholder="Preset name"
          aria-label="Preset name"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="agv-btn agv-btn-small" type="submit" disabled={!clean}>
          {existing ? "Overwrite" : "Save"}
        </button>
      </form>
    </Section>
  );
}

function ImagePicker({ image, onPick }: { image: string | null; onPick: (dataUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  return (
    <div className="agv-pick">
      {image && <img className="agv-thumb" src={image} alt="" />}
      <button className="agv-btn agv-btn-small" disabled={state === "busy"} onClick={() => input.current?.click()}>
        {state === "failed" ? "Couldn't read that, try another" : image ? "Change image" : "Choose image"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setState("busy");
          try {
            onPick(await imageFileToDataUrl(file));
            setState("idle");
          } catch {
            setState("failed");
          }
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="agv-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string | null; children: React.ReactNode }) {
  return (
    <div className="agv-sub">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="agv-choice" role="radiogroup">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={o === value} className={o === value ? "agv-on" : ""} onClick={() => onChange(o)}>
          {LABELS[o] ?? o}
        </button>
      ))}
    </div>
  );
}

interface SliderProps {
  label: string;
  hideLabel?: boolean;
  path: string;
  value: number;
  onChange: (v: number) => void;
}

function Slider({ label, hideLabel, path, value, onChange }: SliderProps) {
  const [min, max, step] = RANGES[path] ?? [0, 1, 0.01];
  return (
    <label className={"agv-row" + (hideLabel ? " agv-row-bare" : "")}>
      {!hideLabel && <span>{label}</span>}
      <input
        type="range"
        className="agv-range"
        aria-label={hideLabel ? label : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--agv-fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

// presets without their own image keep the one the user picked, so trying a
// look doesn't throw the picked image away
function keepImage(next: Settings, current: Settings): Settings {
  if (next.centerpiece.image || !current.centerpiece.image) return next;
  return { ...next, centerpiece: { ...next.centerpiece, image: current.centerpiece.image } };
}

function sameSettings(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => sameSettings((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
