const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);
const VALID_TARGET_KINDS = new Set(["clothing", "footwear", "container", "shield", "item", "vehicle"]);
const VALID_MAGIC_POLICIES = new Set(["mundane-only", "allowed"]);
const DEFAULT_DOCUMENT_TYPES = Object.freeze({
  clothing: ["equipment"],
  footwear: ["equipment"],
  container: ["equipment", "backpack"],
  shield: ["shield"],
  item: ["equipment", "weapon", "armor", "shield", "consumable", "backpack", "book", "kit"],
  vehicle: ["vehicle"]
});

function cleanStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim()))];
}

function normalizeActivation(value) {
  if (!value) return null;
  const actions = Number(value.actions);
  if (!Number.isInteger(actions) || actions < 1 || actions > 3) throw new Error("Accessory rune activation actions must be an integer from 1 to 3");
  const traits = cleanStrings(value.traits);
  const frequency = value.frequency == null ? null : {
    max: Number(value.frequency.max),
    period: String(value.frequency.period ?? "").trim()
  };
  if (frequency && (!Number.isInteger(frequency.max) || frequency.max < 1 || !frequency.period)) {
    throw new Error("Accessory rune activation frequency is invalid");
  }
  const effectText = typeof value.effectText === "string" && value.effectText.trim() ? value.effectText.trim() : null;
  if (!effectText) throw new Error("Accessory rune activation requires effect text");
  const spell = value.spell ? {
    slug: String(value.spell.slug ?? "").trim(),
    rank: Number(value.spell.rank),
    dc: value.spell.dc == null ? null : Number(value.spell.dc)
  } : null;
  if (spell && (!spell.slug || !Number.isInteger(spell.rank) || spell.rank < 1 || (spell.dc != null && (!Number.isInteger(spell.dc) || spell.dc < 1)))) {
    throw new Error("Accessory rune activation spell data is invalid");
  }
  return { actions, traits, frequency, effectText, spell };
}

/**
 * Registry for Accessory Rune families. Definitions are source-backed rune
 * contracts, not free-form generated effects. The host contract is declarative
 * so future rune families can target shields or other supported item kinds
 * without teaching the generator about each family by id.
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

    const hostInput = definition?.host ?? {};
    const magicPolicy = String(hostInput.magicPolicy ?? definition?.hostMagicPolicy ?? "mundane-only").trim();
    if (!VALID_MAGIC_POLICIES.has(magicPolicy)) throw new Error(`Accessory rune family ${id} has invalid host magic policy ${magicPolicy}`);
    const documentTypes = cleanStrings(hostInput.documentTypes ?? DEFAULT_DOCUMENT_TYPES[targetKind]);
    if (!documentTypes.length) throw new Error(`Accessory rune family ${id} requires at least one host document type`);
    const wornSlots = cleanStrings(hostInput.wornSlots ?? definition.allowedSlots);

    const variants = Array.isArray(definition?.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant?.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`).trim(),
          label: variant?.label ?? null,
          level: Number(variant?.level),
          priceGp: Number(variant?.priceGp),
          effectText: variant?.effectText ?? definition.effectText ?? null,
          activation: normalizeActivation(variant?.activation),
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
      if (!variant.sourceSlug) throw new Error(`Accessory rune family ${id} variant ${variant.id} requires a source slug`);
      previousLevel = variant.level;
    }

    const family = {
      id,
      label: definition.label ?? id,
      targetKind,
      usageLabel: definition.usageLabel ?? null,
      // Backward-compatible aliases for existing extension consumers.
      allowedSlots: wornSlots,
      hostMagicPolicy: magicPolicy,
      host: { documentTypes, wornSlots, magicPolicy },
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
    host: { documentTypes: ["equipment"], wornSlots: ["belt", "cloak", "garment", "gloves", "headwear", "mask", "footwear"], magicPolicy: "mundane-only" },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 3, priceGp: 50, sourceSlug: "menacing", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingBase" },
      {
        id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 10, priceGp: 900, sourceSlug: "menacing-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingGreater",
        activation: {
          actions: 2,
          traits: ["concentrate", "manipulate"],
          frequency: { max: 1, period: "day" },
          effectText: "PF2E_ITEM_FORGE.AccessoryRuneActivation.MenacingGreater",
          spell: { slug: "fear", rank: 3, dc: 25 }
        }
      }
    ]
  });

  registry.register({
    id: "pontoon",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Pontoon",
    targetKind: "footwear",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Footwear",
    host: { documentTypes: ["equipment"], wornSlots: ["footwear"], magicPolicy: "mundane-only" },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 9, priceGp: 650, sourceSlug: "pontoon", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.Pontoon" }
    ]
  });

  registry.register({
    id: "preserving",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Preserving",
    targetKind: "container",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Container",
    host: { documentTypes: ["equipment", "backpack"], magicPolicy: "mundane-only" },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 3, priceGp: 45, sourceSlug: "preserving", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingBase" },
      {
        id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 8, priceGp: 450, sourceSlug: "preserving-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingGreater",
        activation: {
          actions: 2,
          traits: ["concentrate", "manipulate"],
          frequency: { max: 1, period: "day" },
          effectText: "PF2E_ITEM_FORGE.AccessoryRuneActivation.PreservingGreater"
        }
      }
    ]
  });

  registry.register({
    id: "trackless",
    label: "PF2E_ITEM_FORGE.AccessoryRunes.Trackless",
    targetKind: "footwear",
    usageLabel: "PF2E_ITEM_FORGE.AccessoryRuneUsage.Footwear",
    host: { documentTypes: ["equipment"], wornSlots: ["footwear"], magicPolicy: "mundane-only" },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base", level: 6, priceGp: 225, sourceSlug: "trackless", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessBase" },
      {
        id: "greater", label: "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater", level: 10, priceGp: 900, sourceSlug: "trackless-greater", effectText: "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessGreater",
        activation: {
          actions: 2,
          traits: ["concentrate"],
          frequency: { max: 1, period: "day" },
          effectText: "PF2E_ITEM_FORGE.AccessoryRuneActivation.TracklessGreater"
        }
      }
    ]
  });

  return registry;
}
