export function normalizeSourcePolicy(source = {}) {
  return {
    mode: ["all", "system", "selected"].includes(source?.mode) ? source.mode : "all",
    includePacks: [...new Set(Array.isArray(source?.includePacks) ? source.includePacks.filter((id) => typeof id === "string" && id) : [])],
    excludePacks: [...new Set(Array.isArray(source?.excludePacks) ? source.excludePacks.filter((id) => typeof id === "string" && id) : [])]
  };
}

export function sourceAllowsEntry(entry, source = {}, { systemId = globalThis.game?.system?.id ?? "pf2e" } = {}) {
  const policy = normalizeSourcePolicy(source);
  const include = new Set(policy.includePacks);
  const exclude = new Set(policy.excludePacks);
  const isSystemPack = entry?.packageType === "system" || entry?.packageName === systemId || entry?.packageName === "pf2e";
  if (exclude.has(entry?.pack)) return false;
  if (policy.mode === "selected" && !include.has(entry?.pack)) return false;
  if (policy.mode === "system" && !isSystemPack) return false;
  return true;
}

export function filterEntriesBySourcePolicy(entries = [], source = {}, options = {}) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => sourceAllowsEntry(entry, source, options));
}

/**
 * Merge the user's currently visible checkbox selection with saved IDs whose
 * packs are temporarily unavailable. This keeps a disabled module from
 * silently erasing a world/request source choice. Explicit Select none actions
 * should bypass this helper and assign an empty list directly.
 */
export function mergeVisibleSourceSelection(currentIncludePacks = [], availablePackIds = [], checkedPackIds = []) {
  const available = new Set((Array.isArray(availablePackIds) ? availablePackIds : []).filter((id) => typeof id === "string" && id));
  const preservedMissing = (Array.isArray(currentIncludePacks) ? currentIncludePacks : [])
    .filter((id) => typeof id === "string" && id && !available.has(id));
  const checked = (Array.isArray(checkedPackIds) ? checkedPackIds : [])
    .filter((id) => typeof id === "string" && id && available.has(id));
  return [...new Set([...preservedMissing, ...checked])];
}
