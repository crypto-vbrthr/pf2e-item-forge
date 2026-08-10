const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);
const VALID_TARGET_KINDS = new Set(["clothing", "footwear", "container"]);

function cleanStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim()))];
}

/**
 * Registry for Accessory Rune families. These definitions describe the rules
 * contract needed to compose a rune with a compatible base item. The generated
 * host item remains rules-text automation until PF2e exposes a verified native
 * accessory-rune carrier schema we can safely build.
 */
export class AccessoryRuneRegistry {
  #families = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Accessory rune family requires a string id");
    if (this.#families.has(id)) throw new Error(`Duplicate accessory rune family: ${id}`);

    const targetKind = String(definition?.targetKind ?? "").trim();
    if (!VALID_TARGET_KINDS.has(targetKind)) throw new Error(`Accessory rune family ${id} has invalid target kind ${targetKind}`);

    const rarity = String(definition?.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Accessory rune family ${id} has invalid rarity ${rarity}`);

    const variants = Array.isArray(definition?.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant?.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`).trim(),
          label: variant?.label ?? null,
          level: Number(variant?.level),
          priceGp: Number(variant?.priceGp),
          effectText: variant?.effectText ?? definition.effectText ?? null,
          sourceSlug: typeof variant?.sourceSlug === "string" ? variant.sourceSlug.trim() : null
        }))
      : [];
    if (!variants.length) throw new Error(`Accessory rune family ${id} requires at least one variant`);

    let previousLevel = -Infinity;
    const variantIds = new Set();
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Accessory rune family ${id} has an empty variant id`);
      if (variantIds.has(variant.id)) throw new Error(`Accessory rune family ${id} has duplicate variant id ${variant.id}`);
      variantIds.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Accessory rune family ${id} has invalid level ${variant.level}`);
      if (variant.level <= previousLevel) throw new Error(`Accessory rune family ${id} variants must increase in level`);
      if (!Number.isFinite(variant.priceGp) || variant.priceGp <= 0) throw new Error(`Accessory rune family ${id} has invalid price`);
      previousLevel = variant.level;
    }

    const family = {
      id,
      label: definition.label ?? id,
      targetKind,
      usageLabel: definition.usageLabel ?? null,
      allowedSlots: cleanStrings(definition.allowedSlots),
      rarity,
      source: definition.source ?? "treasure-vault-remaster",
      automation: "rules-text",
      variants
    };
    this.#families.set(id, family);
    return family;
  }

  get(id) { return this.#families.get(id) ?? null; }
  has(id) { return this.#families.has(id); }
  getAll() { return [...this.#families.values()]; }
}

export function registerCoreAccessoryRunes(registry = new AccessoryRuneRegistry()) {
  registry.register({
    id: "menacing",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Menacing",
    targetKind: "clothing",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Clothing",
    allowedSlots: ["belt", "cloak", "garment", "gloves", "headwear", "mask", "footwear"],
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 3, priceGp: 50, sourceSlug: "menacing", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingBase" },
      { id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 10, priceGp: 900, sourceSlug: "menacing-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingGreater" }
    ]
  });

  registry.register({
    id: "pontoon",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Pontoon",
    targetKind: "footwear",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Footwear",
    allowedSlots: ["footwear"],
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 9, priceGp: 650, sourceSlug: "pontoon", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.Pontoon" }
    ]
  });

  registry.register({
    id: "preserving",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Preserving",
    targetKind: "container",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Container",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 3, priceGp: 45, sourceSlug: "preserving", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingBase" },
      { id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 8, priceGp: 450, sourceSlug: "preserving-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingGreater" }
    ]
  });

  registry.register({
    id: "trackless",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Trackless",
    targetKind: "footwear",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Footwear",
    allowedSlots: ["footwear"],
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 6, priceGp: 225, sourceSlug: "trackless", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessBase" },
      { id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 10, priceGp: 900, sourceSlug: "trackless-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessGreater" }
    ]
  });

  return registry;
}
