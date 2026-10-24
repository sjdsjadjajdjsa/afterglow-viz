import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const IDLE_MS = 2500;
const ROOT = ".agv-viz";

// "fullscreen" fills the spotify window, not the screen, so spotify stays
// whatever size the user has it. the app owns the state; this adds esc and
// hides the controls and cursor while idle
export function useFullscreen(anchor: RefObject<HTMLElement>, full: boolean, setFull: (full: boolean) => void, holdUi: boolean) {
  const root = useCallback(() => anchor.current?.closest<HTMLElement>(ROOT) ?? null, [anchor]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, setFull]);

  const idle = useIdle(root, full && !holdUi);
  const toggle = useCallback(() => setFull(!full), [full, setFull]);
  return { idle, toggle };
}

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
