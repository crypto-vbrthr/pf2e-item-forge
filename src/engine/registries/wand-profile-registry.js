function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value))];
}

export class WandProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Wand profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate wand profile: ${id}`);

    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant) => ({
          rank: Number(variant.rank),
          level: Number(variant.level),
          price: Number(variant.price)
        }))
      : [];
    if (!variants.length) throw new Error(`Wand profile ${id} requires at least one variant`);

    let lastRank = 0;
    for (const variant of variants) {
      if (!Number.isInteger(variant.rank) || variant.rank < 1 || variant.rank > 9) {
        throw new Error(`Invalid spell rank in wand profile ${id}`);
      }
      if (!Number.isInteger(variant.level) || variant.level < 1) {
        throw new Error(`Invalid item level in wand profile ${id}`);
      }
      if (!Number.isFinite(variant.price) || variant.price <= 0) {
        throw new Error(`Invalid price in wand profile ${id}`);
      }
      if (variant.rank <= lastRank) throw new Error(`Wand profile ${id} variants must increase in spell rank`);
      lastRank = variant.rank;
    }

    const castActions = uniqueStrings(definition.compatibility?.castActions?.map?.(String) ?? [])
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);

    const profile = {
      id,
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      automation: definition.automation ?? "rules-text",
      compatibility: {
        requiresDamage: Boolean(definition.compatibility?.requiresDamage),
        castActions,
        forbiddenTraits: uniqueStrings(definition.compatibility?.forbiddenTraits)
      },
      variants
    };

    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) {
    return this.#profiles.get(id) ?? null;
  }

  getAll() {
    return [...this.#profiles.values()];
  }

  has(id) {
    return this.#profiles.has(id);
  }
}

const STANDARD_SPECIAL_LEVELS = [4, 6, 8, 10, 12, 14, 16, 18, 20];
const STANDARD_SPECIAL_PRICES = [100, 250, 500, 1000, 2000, 4500, 10000, 24000, 70000];
const MERCY_PRICES = [75, 200, 425, 850, 1650, 3600, 7900, 19000, 52000];

function rankVariants(prices) {
  return prices.map((price, index) => ({ rank: index + 1, level: STANDARD_SPECIAL_LEVELS[index], price }));
}

/**
 * Register conservative custom-wand profiles whose compatibility and scaling
 * are directly patterned after generic special wands in Treasure Vault.
 * Spell-specific published wands deliberately remain predefined items instead
 * of being generalized into arbitrary generator effects.
 */
export function registerCoreWandProfiles(registry = new WandProfileRegistry()) {
  registry.register({
    id: "core.reaching",
    label: "PF2E_ITEM_FORGE.WandProfiles.Reaching",
    description: "PF2E_ITEM_FORGE.WandText.ReachingDescription",
    nameTemplate: "PF2E_ITEM_FORGE.WandText.ReachingName",
    effectText: "PF2E_ITEM_FORGE.WandText.ReachingEffect",
    variants: rankVariants(STANDARD_SPECIAL_PRICES)
  });

  registry.register({
    id: "core.legerdemain",
    label: "PF2E_ITEM_FORGE.WandProfiles.Legerdemain",
    description: "PF2E_ITEM_FORGE.WandText.LegerdemainDescription",
    nameTemplate: "PF2E_ITEM_FORGE.WandText.LegerdemainName",
    effectText: "PF2E_ITEM_FORGE.WandText.LegerdemainEffect",
    variants: rankVariants(STANDARD_SPECIAL_PRICES)
  });

  registry.register({
    id: "core.mercy",
    label: "PF2E_ITEM_FORGE.WandProfiles.Mercy",
    description: "PF2E_ITEM_FORGE.WandText.MercyDescription",
    nameTemplate: "PF2E_ITEM_FORGE.WandText.MercyName",
    effectText: "PF2E_ITEM_FORGE.WandText.MercyEffect",
    compatibility: {
      requiresDamage: true,
      castActions: [1, 2],
      forbiddenTraits: ["death", "nonlethal", "void"]
    },
    variants: rankVariants(MERCY_PRICES)
  });

  return registry;
}
