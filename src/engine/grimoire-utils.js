const MAGIC_MARKERS = new Set(["magical", "arcane", "divine", "occult", "primal"]);

export const GENERATED_GRIMOIRE_TEMPLATE_TYPES = Object.freeze(["book", "equipment"]);

export function isGrimoireTraits(traits = []) {
  return (Array.isArray(traits) ? traits : []).some((trait) => String(trait).toLowerCase() === "grimoire");
}

export function hasGrimoireMagicMarkerTraits(traits = []) {
  return (Array.isArray(traits) ? traits : []).some((trait) => MAGIC_MARKERS.has(String(trait).toLowerCase()));
}

function isSystemEntry(entry) {
  const systemId = globalThis.game?.system?.id ?? "pf2e";
  return entry?.packageType === "system" || entry?.packageName === systemId || entry?.packageName === "pf2e";
}

export function getGrimoireCapabilities({ entries = [], profiles = [] } = {}) {
  const profileList = Array.isArray(profiles) ? profiles : (profiles?.getAll?.() ?? []);
  const existingEntries = entries.filter((entry) => entry.categories?.includes?.("magic.grimoire"));
  const templateEntries = existingEntries.filter((entry) => GENERATED_GRIMOIRE_TEMPLATE_TYPES.includes(entry.type) && isSystemEntry(entry));
  const generatedLevels = [...new Set(profileList.flatMap((profile) => profile.variants?.map((variant) => variant.level) ?? []))]
    .filter((level) => Number.isInteger(level))
    .sort((a, b) => a - b);
  return {
    existing: existingEntries.length > 0,
    existingCount: existingEntries.length,
    generated: profileList.length > 0 && templateEntries.length > 0,
    generatedProfileCount: profileList.length,
    generatedTemplateCount: templateEntries.length,
    generatedLevels
  };
}
