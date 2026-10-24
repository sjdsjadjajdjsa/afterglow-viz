const REDACT = /token|secret|auth|cookie|password|session|username/i;
const MAX_STRING = 80;
const MAX_KEYS = 40;

// keys, types and short values only, so reports don't dump whole queues
export function describeShape(value: unknown, depth = 3): unknown {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}... (${value.length} chars)` : value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "undefined":
      return "(undefined)";
    case "function":
      return "(function)";
    case "object":
      break;
    default:
      return `(${typeof value})`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (depth <= 0) return `(array of ${value.length})`;
    return { "(array)": value.length, first: describeShape(value[0], depth - 1) };
  }

  let keys: string[];
  try {
    keys = Object.keys(value as object);
  } catch {
    return "(unreadable object)";
  }
  if (depth <= 0) return `(object with ${keys.length} keys)`;

  const out: Record<string, unknown> = {};
  for (const key of keys.slice(0, MAX_KEYS)) {
    if (REDACT.test(key)) {
      out[key] = "(redacted)";
      continue;
    }
    try {
      out[key] = describeShape((value as Record<string, unknown>)[key], depth - 1);
    } catch {
      out[key] = "(threw on read)";
    }
  }
  if (keys.length > MAX_KEYS) out["(more keys)"] = keys.length - MAX_KEYS;
  return out;
}
