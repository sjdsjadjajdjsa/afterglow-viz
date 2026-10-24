import { useLayoutEffect } from "react";

export function useStyle(css: string): void {
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.dataset.afterglowViz = "";
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [css]);
}
