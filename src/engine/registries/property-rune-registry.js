import { ContentRegistry } from "./content-registry.js";

const RARITY_ORDER = Object.freeze({ common: 0, uncommon: 1, rare: 2, unique: 3 });

function isMelee(entry) {
  return entry?.range == null || entry.range === "" || entry.range === false;
}

function hasThrownTrait(entry) {
  return (entry?.traits ?? []).some((trait) => trait === "thrown" || /^thrown-\d+$/.test(trait));
}

function deals(entry, types) {
  return types.includes(entry?.damageType ?? null);
}

function armorCategory(entry, allowed) {
  return allowed.includes(entry?.armorCategory ?? null);
}

export class PropertyRuneRegistry extends ContentRegistry {
  constructor() {
    super("property rune");
  }

  register(definition) {
    if (!definition?.slug || typeof definition.slug !== "string") {
      throw new TypeError("Property rune registration requires a string slug");
    }
    if (!["weapon", "armor"].includes(definition.itemType)) {
      throw new TypeError(`Property rune ${definition.slug} requires itemType weapon or armor`);
    }
    const level = Number(definition.level);
    if (!Number.isInteger(level) || level < 0) {
      throw new TypeError(`Property rune ${definition.slug} requires a non-negative integer level`);
    }
    const rarity = definition.rarity ?? "common";
    if (!(rarity in RARITY_ORDER)) {
      throw new TypeError(`Property rune ${definition.slug} has invalid rarity ${rarity}`);
    }
    return super.register({
      ...definition,
      id: definition.id ?? `${definition.itemType}.${definition.slug}`,
      slug: definition.slug,
      level,
      rarity,
      label: definition.label ?? definition.slug,
      matches: typeof definition.matches === "function" ? definition.matches : () => true
    });
  }

  getForItemType(itemType) {
    return this.getAll().filter((rune) => rune.itemType === itemType);
  }

  getBySlug(itemType, slug) {
    return this.getForItemType(itemType).find((rune) => rune.slug === slug) ?? null;
  }

  getCompatible(entry, { maxLevel = Infinity, allowedRarities = [] } = {}) {
    const rarityFilter = new Set(allowedRarities ?? []);
    return this.getForItemType(entry?.type)
      .filter((rune) => rune.level <= maxLevel)
      .filter((rune) => !rarityFilter.size || rarityFilter.has(rune.rarity))
      .filter((rune) => rune.matches(entry))
      .sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug));
  }
}

/**
 * A conservative Remaster-oriented starter set. The strings are PF2e property-rune
 * identifiers written directly to system.runes.property. The registry is public so
 * additional official, module, or campaign-specific runes can be added without
 * changing the generator.
 */
export function registerCorePropertyRunes(registry) {
  const definitions = [
    // Weapon property runes
    { slug: "returning", itemType: "weapon", level: 3, label: "PF2E_ITEM_FORGE.PropertyRunes.Returning", matches: hasThrownTrait },
    { slug: "ghost-touch", itemType: "weapon", level: 4, label: "PF2E_ITEM_FORGE.PropertyRunes.GhostTouch" },
    { slug: "disrupting", itemType: "weapon", level: 5, label: "PF2E_ITEM_FORGE.PropertyRunes.Disrupting", matches: isMelee },
    { slug: "shifting", itemType: "weapon", level: 6, label: "PF2E_ITEM_FORGE.PropertyRunes.Shifting", matches: isMelee },
    { slug: "wounding", itemType: "weapon", level: 7, label: "PF2E_ITEM_FORGE.PropertyRunes.Wounding", matches: (entry) => isMelee(entry) && deals(entry, ["slashing", "piercing"]) },
    { slug: "astral", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Astral" },
    { slug: "corrosive", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Corrosive" },
    { slug: "flaming", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Flaming" },
    { slug: "frost", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Frost" },
    { slug: "shock", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Shock" },
    { slug: "thundering", itemType: "weapon", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Thundering" },
    { slug: "extending", itemType: "weapon", level: 9, label: "PF2E_ITEM_FORGE.PropertyRunes.Extending", matches: isMelee },
    { slug: "holy", itemType: "weapon", level: 11, label: "PF2E_ITEM_FORGE.PropertyRunes.Holy" },
    { slug: "unholy", itemType: "weapon", level: 11, label: "PF2E_ITEM_FORGE.PropertyRunes.Unholy" },
    { slug: "impactful", itemType: "weapon", level: 13, label: "PF2E_ITEM_FORGE.PropertyRunes.Impactful", matches: (entry) => isMelee(entry) && deals(entry, ["bludgeoning"]) },

    // Armor property runes
    { slug: "shadow", itemType: "armor", level: 5, label: "PF2E_ITEM_FORGE.PropertyRunes.Shadow", matches: (entry) => armorCategory(entry, ["light", "medium"]) },
    { slug: "slick", itemType: "armor", level: 5, label: "PF2E_ITEM_FORGE.PropertyRunes.Slick" },
    { slug: "glamered", itemType: "armor", level: 5, label: "PF2E_ITEM_FORGE.PropertyRunes.Glamered" },
    { slug: "invisibility", itemType: "armor", level: 8, label: "PF2E_ITEM_FORGE.PropertyRunes.Invisibility", matches: (entry) => armorCategory(entry, ["light"]) },
    { slug: "fortification", itemType: "armor", level: 12, label: "PF2E_ITEM_FORGE.PropertyRunes.Fortification", matches: (entry) => armorCategory(entry, ["medium", "heavy"]) }
  ];

  for (const definition of definitions) registry.register(definition);
  return registry;
}

export { RARITY_ORDER };
