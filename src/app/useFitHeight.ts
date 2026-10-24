import { useLayoutEffect, type RefObject } from "react";

// spotify's main view doesn't give custom apps a height, so size the element
// to the visible part of its scroll container
export function useFitHeight(ref: RefObject<HTMLElement>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      const scroller = scrollParent(el);
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      el.style.height = `${Math.max(320, Math.floor(bottom - top))}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ref]);
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
}
