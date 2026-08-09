export const WORN_SLOT_DEFINITIONS = Object.freeze([
  { id: "unrestricted", keywords: [], label: "PF2E_ITEM_FORGE.WornSlots.Unrestricted" },
  { id: "backpack", keywords: ["backpack"], label: "PF2E_ITEM_FORGE.WornSlots.Backpack" },
  { id: "belt", keywords: ["belt"], label: "PF2E_ITEM_FORGE.WornSlots.Belt" },
  { id: "cloak", keywords: ["cloak", "cape"], label: "PF2E_ITEM_FORGE.WornSlots.Cloak" },
  { id: "eyepiece", keywords: ["eyepiece", "goggles", "spectacles"], label: "PF2E_ITEM_FORGE.WornSlots.Eyepiece" },
  { id: "garment", keywords: ["garment", "clothing", "robe"], label: "PF2E_ITEM_FORGE.WornSlots.Garment" },
  { id: "gloves", keywords: ["gloves", "gauntlets"], label: "PF2E_ITEM_FORGE.WornSlots.Gloves" },
  { id: "bracers", keywords: ["bracers", "armbands"], label: "PF2E_ITEM_FORGE.WornSlots.Bracers" },
  { id: "headwear", keywords: ["headwear", "helmet", "helm", "hat", "crown"], label: "PF2E_ITEM_FORGE.WornSlots.Headwear" },
  { id: "circlet", keywords: ["circlet"], label: "PF2E_ITEM_FORGE.WornSlots.Circlet" },
  { id: "mask", keywords: ["mask"], label: "PF2E_ITEM_FORGE.WornSlots.Mask" },
  { id: "footwear", keywords: ["shoes", "footwear", "boots", "slippers", "sandals"], label: "PF2E_ITEM_FORGE.WornSlots.Footwear" },
  { id: "collar", keywords: ["collar"], label: "PF2E_ITEM_FORGE.WornSlots.Collar" },
  { id: "other", keywords: [], label: "PF2E_ITEM_FORGE.WornSlots.Other" }
]);

const SLOT_BY_ID = new Map(WORN_SLOT_DEFINITIONS.map((slot) => [slot.id, slot]));

function compact(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * PF2e usage strings have appeared in both human-readable and slug-like forms.
 * Normalize defensively so "worn cloak", "worn-cloak", and "worncloak" all
 * classify identically without baking a single system-version spelling into
 * Item Forge.
 */
export function parseWornUsage(value) {
  const human = compact(value);
  const collapsed = human.replace(/\s+/g, "");
  if (!collapsed.startsWith("worn")) return { worn: false, slot: null, raw: value ?? null };

  const suffixCollapsed = collapsed.slice(4);
  const suffixHuman = human.startsWith("worn") ? human.slice(4).trim() : "";
  if (!suffixCollapsed) return { worn: true, slot: "unrestricted", raw: value ?? null };

  for (const slot of WORN_SLOT_DEFINITIONS) {
    if (["unrestricted", "other"].includes(slot.id)) continue;
    if (slot.keywords.some((keyword) => suffixCollapsed.includes(keyword.replace(/\s+/g, "")) || suffixHuman.includes(keyword))) {
      return { worn: true, slot: slot.id, raw: value ?? null };
    }
  }
  return { worn: true, slot: "other", raw: value ?? null };
}

export function wornCategoryForSlot(slot) {
  return SLOT_BY_ID.has(slot) ? `magic.worn.${slot}` : "magic.worn.other";
}

export function wornSlotLabelKey(slot) {
  return SLOT_BY_ID.get(slot)?.label ?? SLOT_BY_ID.get("other").label;
}

export function isMagicWornTraits(traits = []) {
  const set = new Set(Array.isArray(traits) ? traits : []);
  return ["invested", "magical", "arcane", "divine", "occult", "primal", "focused"].some((trait) => set.has(trait));
}


export const GENERATED_WORN_TEMPLATE_TYPES = Object.freeze(["equipment"]);

export function hasMagicMarkerTraits(traits = []) {
  const set = new Set(Array.isArray(traits) ? traits : []);
  return ["magical", "arcane", "divine", "occult", "primal"].some((trait) => set.has(trait));
}

export function getWornSlotCapabilities({ entries = [], profiles = [] } = {}) {
  const profileList = Array.isArray(profiles) ? profiles : (profiles?.getAll?.() ?? []);
  return WORN_SLOT_DEFINITIONS.map((slot) => {
    const category = `magic.worn.${slot.id}`;
    const existingEntries = entries.filter((entry) => entry.categories?.includes?.(category));
    const generatedProfiles = slot.id === "other" ? [] : profileList.filter((profile) => profile.slot === slot.id);
    const templateEntries = entries.filter((entry) =>
      GENERATED_WORN_TEMPLATE_TYPES.includes(entry.type) && entry.categories?.includes?.(category)
    );
    const generatedLevels = [...new Set(generatedProfiles.flatMap((profile) => profile.variants?.map((variant) => variant.level) ?? []))]
      .filter((level) => Number.isInteger(level))
      .sort((a, b) => a - b);
    return {
      id: slot.id,
      label: slot.label,
      existing: existingEntries.length > 0,
      existingCount: existingEntries.length,
      generated: generatedProfiles.length > 0 && templateEntries.length > 0,
      generatedProfileCount: generatedProfiles.length,
      generatedTemplateCount: templateEntries.length,
      generatedLevels
    };
  });
}
