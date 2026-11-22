import { type LifeRecord } from "./model";
export function stableHash(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableHash).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableHash(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function syncDecision(
  local: LifeRecord,
  remote: { record: LifeRecord; version: number } | undefined,
  base: { revision: number; hash: string } | undefined,
): "same" | "push" | "pull" | "conflict" {
  const hash = stableHash(local);
  if (remote && hash === stableHash(remote.record)) return "same";
  const localChanged = !base || base.hash !== hash;
  const remoteChanged = Boolean(
    remote && (!base || base.revision !== remote.version),
  );
  if (localChanged && remoteChanged) return "conflict";
  if (remoteChanged) return "pull";
  return localChanged ? "push" : "same";
}
