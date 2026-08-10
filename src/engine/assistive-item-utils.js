/**
 * Published PF2e assistive items are deliberately treated as an existing-only
 * cross-cutting category. They span several physical document types and carry
 * bespoke rules that Item Forge must preserve rather than synthesize.
 */

function normalizeIdentifier(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Explicit source-backed PF2e assistive-item slugs/names from Player Core,
 * Guns & Gears, and Treasure Vault. Keep this allow-list intentionally narrow:
 * descriptions are never scanned, so ordinary items do not become assistive
 * simply because their prose happens to mention a disability or mobility aid.
 */
export const CORE_ASSISTIVE_ITEM_IDENTIFIERS = new Set([
  // Player Core baseline aids
  "cane",
  "hearing-aid",
  "prosthesis",
  "basic-prosthesis",
  "wheelchair",
  "travelers-chair",
  "traveler-s-chair",
  "wheelchair-storage",
  "corrective-lenses",

  // Guns & Gears mobility devices
  "frog-chair",
  "spider-chair",
  "storm-chair",

  // Treasure Vault: companion aids
  "basic-companion-chair",
  "traveling-companions-chair",
  "traveling-companion-s-chair",
  "guide-harness",
  "olfactory-stimulators",
  "bloodhound-olfactory-stimulators",
  "empathy-charm",

  // Treasure Vault: breathing devices, canes, eyes, prostheses, tails, miscellany
  "basic-face-mask",
  "bootstrap-respirator",
  "wand-cane",
  "batsbreath-cane",
  "magical-prosthetic-eye",
  "falconsight-eye",
  "spyglass-eye",
  "gossips-eye",
  "gossip-s-eye",
  "aether-appendage",
  "spring-heel",
  "verdant-branch",
  "extendable-tail",
  "thrasher-tail",
  "apparition-gloves",
  "confabulator",
  "chair-of-inventions",
  "tremorsensors",
  "voicebox"
]);

const ASSISTIVE_CATEGORY_MARKERS = new Set([
  "assistive",
  "assistive-item",
  "assistive-items",
  "mobility-aid",
  "mobility-device"
]);

export function isAssistiveItem(raw) {
  if (!raw || typeof raw !== "object") return false;

  const system = raw.system ?? {};
  const category = normalizeIdentifier(system.category?.value ?? system.category);
  if (ASSISTIVE_CATEGORY_MARKERS.has(category)) return true;

  const traits = Array.isArray(system.traits?.value) ? system.traits.value : [];
  if (traits.some((trait) => ASSISTIVE_CATEGORY_MARKERS.has(normalizeIdentifier(trait)))) return true;

  const candidates = [system.slug, raw.slug, raw.name]
    .map(normalizeIdentifier)
    .filter(Boolean);

  return candidates.some((candidate) => CORE_ASSISTIVE_ITEM_IDENTIFIERS.has(candidate));
}
