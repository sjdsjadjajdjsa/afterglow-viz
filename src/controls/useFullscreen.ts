import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type FullMode = "off" | "native" | "window";

export const IDLE_MS = 2500;
const ROOT = ".agv-viz";

// fullscreen for the .agv-viz element around `anchor`. when the element api is
// missing or refused, covers the window with css instead and handles esc itself
export function useFullscreen(anchor: RefObject<HTMLElement>, holdUi: boolean) {
  const [mode, setMode] = useState<FullMode>("off");
  const root = useCallback(() => anchor.current?.closest<HTMLElement>(ROOT) ?? null, [anchor]);

  useEffect(() => {
    const onChange = () => {
      const el = root();
      const native = !!el && document.fullscreenElement === el;
      setMode((m) => (native ? "native" : m === "native" ? "off" : m));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      const el = root();
      if (el && document.fullscreenElement === el) document.exitFullscreen?.().catch(() => {});
    };
  }, [root]);

  // browsers exit native fullscreen on esc themselves, but an embedding app
  // like spotify's may not pass the key on, so handle it here too
  useEffect(() => {
    if (mode === "off") return;
    const el = root();
    if (mode === "window") el?.classList.add("agv-fullwin");
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (mode === "native") document.exitFullscreen?.().catch(() => {});
      else setMode("off");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      el?.classList.remove("agv-fullwin");
      window.removeEventListener("keydown", onKey);
    };
  }, [mode, root]);

  const idle = useIdle(root, mode !== "off" && !holdUi);

  const enter = useCallback(async () => {
    const el = root();
    if (!el) return;
    if (typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // refused, use the css fallback
      }
    }
    setMode("window");
  }, [root]);

  const exit = useCallback(() => {
    if (mode === "native") document.exitFullscreen?.().catch(() => setMode("off"));
    else setMode("off");
  }, [mode]);

  const toggle = useCallback(() => (mode === "off" ? enter() : exit()), [mode, enter, exit]);

  return { mode, full: mode !== "off", idle, toggle };
}

// hides the cursor and controls after a while without mouse movement
function useIdle(root: () => HTMLElement | null, active: boolean): boolean {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);

  useEffect(() => {
    const el = root();
    if (!active || !el) return;
    let timer = 0;
    const set = (value: boolean) => {
      if (idleRef.current === value) return;
      idleRef.current = value;
      el.classList.toggle("agv-idle", value);
      setIdle(value);
    };
    const wake = () => {
      set(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => set(true), IDLE_MS);
    };
    wake();
    el.addEventListener("mousemove", wake);
    el.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      set(false);
      el.removeEventListener("mousemove", wake);
      el.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [root, active]);

  return idle;
}
