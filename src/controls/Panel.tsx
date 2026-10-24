import React, { useRef, useState } from "react";
import { DEFAULT_SETTINGS, RANGES, sanitize, type Settings } from "../settings";
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
  onDiagnostics: () => void;
}

type Group = "rings" | "spectrum" | "color" | "centerpiece" | "background" | "particles";
type Options<T extends string> = readonly (readonly [T, string])[];

const STYLES: Options<Settings["shape"]> = [
  ["rings", "Rings"],
  ["spectrum", "Bars"],
  ["both", "Both"],
];
const MIDDLES: Options<Settings["centerpiece"]["kind"]> = [
  ["album", "Album art"],
  ["image", "Picture"],
  ["none", "None"],
];
const BACKGROUNDS: Options<Settings["background"]["kind"]> = [
  ["art-blur", "Blurred art"],
  ["gradient", "Gradient"],
  ["solid", "Plain"],
];
const PARTICLES: Options<Settings["particles"]["kind"]> = [
  ["none", "None"],
  ["dust", "Dust"],
  ["snow", "Snow"],
  ["stars", "Stars"],
  ["fireflies", "Fireflies"],
];

export function Panel({ settings, setSettings, presets, stored, onClose, onDiagnostics }: Props) {
  const patch = <K extends Group>(key: K, values: Partial<Settings[K]>) =>
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...values } }));
  const picker = useImagePicker((image) => patch("centerpiece", { image, kind: "image" }));
  const { shape, rings, spectrum, color, centerpiece, background, particles } = settings;
  const hasPicture = !!centerpiece.image;

  // the picture color mode only makes sense once there is a picture
  const colors: Options<Settings["color"]["mode"]> = [
    ["album", "Album"],
    ["rainbow", "Rainbow"],
    ...(hasPicture ? [["centerpiece", "Picture"] as const] : []),
    ["single", "One color"],
  ];

  return (
    <aside className="agv-panel" aria-label="Customize">
      <header className="agv-panel-head">
        <h2>Customize</h2>
        <button className="agv-icon-btn" aria-label="Close" title="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <Looks settings={settings} setSettings={setSettings} presets={presets} />

      <Section title="Style">
        <Choice options={STYLES} value={shape} onChange={(v) => setSettings((s) => ({ ...s, shape: v }))} />
      </Section>

      <Section title="Colors">
        <Choice options={colors} value={color.mode} onChange={(v) => patch("color", { mode: v })} />
        {color.mode === "single" && (
          <input
            type="color"
            className="agv-swatch"
            aria-label="Color"
            value={color.single}
            onChange={(e) => patch("color", { single: e.target.value })}
          />
        )}
      </Section>

      <Section title="Middle">
        <Choice
          options={MIDDLES}
          value={centerpiece.kind}
          onChange={(v) => (v === "image" && !hasPicture ? picker.open() : patch("centerpiece", { kind: v }))}
        />
        {picker.input}
        {(hasPicture || picker.state !== "idle") && (
          <div className="agv-pick">
            {hasPicture && <img className="agv-thumb" src={centerpiece.image!} alt="" />}
            <button className="agv-link" disabled={picker.state === "busy"} onClick={picker.open}>
              {picker.state === "failed" ? "Couldn't read that, try another" : picker.state === "busy" ? "Loading..." : "Change picture"}
            </button>
          </div>
        )}
      </Section>

      <Section title="Background">
        <Choice options={BACKGROUNDS} value={background.kind} onChange={(v) => patch("background", { kind: v })} />
      </Section>

      <Section title="Particles">
        <Choice options={PARTICLES} value={particles.kind} onChange={(v) => patch("particles", { kind: v })} />
      </Section>

      <Section title="Intensity">
        <Slider label="Intensity" hideLabel path="sensitivity" value={settings.sensitivity} onChange={(v) => setSettings((s) => ({ ...s, sensitivity: v }))} />
      </Section>

      <details className="agv-more">
        <summary>Fine tune</summary>
        {shape !== "spectrum" && (
          <Sub title="Rings">
            <Slider label="Count" path="rings.count" value={rings.count} onChange={(v) => patch("rings", { count: v })} />
            <Slider label="Size" path="rings.size" value={rings.size} onChange={(v) => patch("rings", { size: v })} />
            <Slider label="Spread" path="rings.spread" value={rings.spread} onChange={(v) => patch("rings", { spread: v })} />
            <Slider label="Thickness" path="rings.thickness" value={rings.thickness} onChange={(v) => patch("rings", { thickness: v })} />
          </Sub>
        )}
        {shape !== "rings" && (
          <Sub title="Bars">
            <Slider label="Height" path="spectrum.size" value={spectrum.size} onChange={(v) => patch("spectrum", { size: v })} />
            <Slider label="Width" path="spectrum.spread" value={spectrum.spread} onChange={(v) => patch("spectrum", { spread: v })} />
            <Slider label="Thickness" path="spectrum.thickness" value={spectrum.thickness} onChange={(v) => patch("spectrum", { thickness: v })} />
          </Sub>
        )}
        <Sub title="Colors">
          <Slider label="Saturation" path="color.saturation" value={color.saturation} onChange={(v) => patch("color", { saturation: v })} />
          {color.mode !== "single" && (
            <Slider label="Drift" path="color.speed" value={color.speed} onChange={(v) => patch("color", { speed: v })} />
          )}
        </Sub>
        {centerpiece.kind !== "none" && (
          <Sub title="Middle">
            <Slider label="Size" path="centerpiece.size" value={centerpiece.size} onChange={(v) => patch("centerpiece", { size: v })} />
            <Slider label="Pulse" path="centerpiece.pulse" value={centerpiece.pulse} onChange={(v) => patch("centerpiece", { pulse: v })} />
          </Sub>
        )}
        <Sub title="Background">
          {background.kind === "solid" ? (
            <label className="agv-row">
              <span>Color</span>
              <input type="color" className="agv-swatch" value={background.color} onChange={(e) => patch("background", { color: e.target.value })} />
            </label>
          ) : (
            <Slider label="Dim" path="background.dim" value={background.dim} onChange={(v) => patch("background", { dim: v })} />
          )}
        </Sub>
        {particles.kind !== "none" && (
          <Sub title="Particles">
            <Slider label="Amount" path="particles.amount" value={particles.amount} onChange={(v) => patch("particles", { amount: v })} />
            <Slider label="Speed" path="particles.speed" value={particles.speed} onChange={(v) => patch("particles", { speed: v })} />
          </Sub>
        )}
      </details>

      <footer className="agv-panel-foot">
        {!(stored && presets.stored) && <p className="agv-note">Kept for this session only. Storage is full or turned off.</p>}
        <div className="agv-foot-row">
          <button className="agv-link" onClick={() => setSettings((s) => keepImage(sanitize(DEFAULT_SETTINGS), s))}>
            Reset
          </button>
          <button className="agv-link" onClick={onDiagnostics}>
            Diagnostics
          </button>
        </div>
      </footer>
    </aside>
  );
}

function Looks({ settings, setSettings, presets }: Pick<Props, "settings" | "setSettings" | "presets">) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const clean = cleanName(name);
  const existing = clean ? findPreset(presets.list, clean) : undefined;

  const chip = (p: Preset, own: boolean) => (
    <span key={(own ? "u:" : "b:") + p.name} className={"agv-chip" + (sameSettings(keepImage(p.settings, settings), settings) ? " agv-chip-on" : "")}>
      <button className="agv-chip-name" onClick={() => setSettings((s) => keepImage(sanitize(p.settings), s))}>
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
    <Section title="Looks">
      <div className="agv-chips">
        {BUILTIN_PRESETS.map((p) => chip(p, false))}
        {presets.list.map((p) => chip(p, true))}
        {!saving && (
          <button className="agv-chip agv-chip-add" onClick={() => setSaving(true)}>
            Save this look
          </button>
        )}
      </div>
      {saving && (
        <form
          className="agv-save"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean && presets.save(clean, settings)) {
              setName("");
              setSaving(false);
            }
          }}
        >
          <input
            className="agv-input"
            value={name}
            maxLength={40}
            placeholder="Name"
            aria-label="Look name"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setSaving(false);
              }
            }}
          />
          <button className="agv-btn agv-btn-small" type="submit" disabled={!clean}>
            {existing ? "Replace" : "Save"}
          </button>
        </form>
      )}
    </Section>
  );
}

function useImagePicker(onPick: (dataUrl: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const input = (
    <input
      ref={ref}
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
  );
  return { input, state, open: () => ref.current?.click() };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="agv-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="agv-sub">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: Options<T>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="agv-choice" role="radiogroup">
      {options.map(([o, label]) => (
        <button key={o} role="radio" aria-checked={o === value} className={o === value ? "agv-on" : ""} onClick={() => onChange(o)}>
          {label}
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
