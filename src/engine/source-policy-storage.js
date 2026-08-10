import { normalizeSourcePolicy } from "./source-policy.js";

export function serializeSourcePolicy(source = {}) {
  return JSON.stringify(normalizeSourcePolicy(source));
}

export function deserializeSourcePolicy(rawPolicy, { legacyMode = "all", legacyIncludePacks = [] } = {}) {
  if (typeof rawPolicy === "string" && rawPolicy.trim()) {
    try {
      const parsed = JSON.parse(rawPolicy);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return normalizeSourcePolicy(parsed);
    } catch (_error) {
      // Fall through to legacy values.
    }
  }
  return normalizeSourcePolicy({ mode: legacyMode, includePacks: legacyIncludePacks, excludePacks: [] });
}
