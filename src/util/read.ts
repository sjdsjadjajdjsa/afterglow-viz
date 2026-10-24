export type Obj = Record<string, unknown>;

export function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asObj(value: unknown): Obj {
  return isObj(value) ? value : {};
}

export function str(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

// also takes numeric strings and { milliseconds }
export function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (isObj(value)) return num(value.milliseconds);
  return null;
}

export function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
