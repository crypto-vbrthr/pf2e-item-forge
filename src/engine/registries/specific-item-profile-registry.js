import { normalizeBalanceMetadata } from "./profile-balance.js";

import {
  ARMOR_FUNDAMENTAL_PROFILES,
  WEAPON_FUNDAMENTAL_PROFILES,
  propertyRuneCapacity
} from "../equipment-rune-profiles.js";

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value))];
}

function profileMap(itemType) {
  const profiles = itemType === "weapon" ? WEAPON_FUNDAMENTAL_PROFILES : ARMOR_FUNDAMENTAL_PROFILES;
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export class SpecificItemProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Specific item profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate specific item profile: ${id}`);

    const itemType = definition?.itemType;
    if (!["weapon", "armor"].includes(itemType)) {
      throw new Error(`Specific item profile ${id} requires itemType weapon or armor`);
    }

    const fundamentals = profileMap(itemType);
    const allowedThemes = uniqueStrings(definition.allowedThemes);
    const propertyRunesByTheme = structuredClone(definition.propertyRunesByTheme ?? {});
    for (const [theme, runes] of Object.entries(propertyRunesByTheme)) {
      if (!allowedThemes.includes(theme)) throw new Error(`Specific item profile ${id} has property runes for unsupported theme ${theme}`);
      if (!Array.isArray(runes) || runes.some((rune) => typeof rune !== "string" || !rune)) {
        throw new Error(`Specific item profile ${id} has invalid property runes for theme ${theme}`);
      }
    }

    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`),
          label: variant.label ?? null,
          level: Number(variant.level),
          price: Number(variant.price),
          fundamentalProfile: String(variant.fundamentalProfile ?? ""),
          propertyRunes: uniqueStrings(variant.propertyRunes),
          values: structuredClone(variant.values ?? {})
        }))
      : [];
    if (!variants.length) throw new Error(`Specific item profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid specific item level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Specific item profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid specific item price in ${id}`);
      const fundamental = fundamentals.get(variant.fundamentalProfile);
      if (!fundamental) throw new Error(`Unknown fundamental profile ${variant.fundamentalProfile} in ${id}`);
      if (variant.level < fundamental.level) throw new Error(`Specific item variant ${id}:${variant.id} is below its fundamental-rune level`);
      const capacity = propertyRuneCapacity(itemType, fundamental.potency ?? 0);
      const fixedRuneCount = variant.propertyRunes.length;
      if (fixedRuneCount > capacity) {
        throw new Error(`Specific item variant ${id}:${variant.id} exceeds its property-rune capacity`);
      }
      for (const runes of Object.values(propertyRunesByTheme)) {
        const combined = new Set([...variant.propertyRunes, ...runes]);
        if (combined.size > capacity) {
          throw new Error(`Specific item variant ${id}:${variant.id} exceeds its property-rune capacity for a theme`);
        }
      }
      lastLevel = variant.level;
    }

    const compatibility = definition.compatibility ?? {};
    if (compatibility.meleeOnly && compatibility.rangedOnly) throw new Error(`Specific item profile ${id} cannot be both melee-only and ranged-only`);

    const profile = {
      id,
      itemType,
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      automation: definition.automation ?? "rules-text",
      rarity: definition.rarity ?? "common",
      allowedThemes,
      itemTraitsByTheme: structuredClone(definition.itemTraitsByTheme ?? {}),
      valuesByTheme: structuredClone(definition.valuesByTheme ?? {}),
      propertyRunesByTheme,
      compatibility: {
        meleeOnly: Boolean(compatibility.meleeOnly),
        rangedOnly: Boolean(compatibility.rangedOnly),
        armorCategories: uniqueStrings(compatibility.armorCategories),
        requiredTraits: uniqueStrings(compatibility.requiredTraits),
        forbiddenTraits: uniqueStrings(compatibility.forbiddenTraits),
        groups: uniqueStrings(compatibility.groups)
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

  getForItemType(itemType) {
    return this.getAll().filter((profile) => profile.itemType === itemType);
  }

  has(id) {
    return this.#profiles.has(id);
  }
}

export function registerCoreSpecificItemProfiles(registry = new SpecificItemProfileRegistry()) {
  registry.register({
    id: "core.retributive-weapon",
    balance: { basis: "published-analogs", reviewed: true, notes: "Core homebrew profile benchmarked against published specific magic items." },
    itemType: "weapon",
    label: "PF2E_ITEM_FORGE.SpecificItemProfiles.RetributiveWeapon",
    description: "PF2E_ITEM_FORGE.SpecificItemText.RetributiveWeaponDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificItemText.RetributiveWeaponName",
    effectText: "PF2E_ITEM_FORGE.SpecificItemText.RetributiveWeaponEffect",
    compatibility: { meleeOnly: true },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 3, price: 60, fundamentalProfile: "potency-1", values: { bonus: 2 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 1150, fundamentalProfile: "potency-2-striking", values: { bonus: 4 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 16, price: 11000, fundamentalProfile: "potency-3-greater-striking", values: { bonus: 6 } }
    ]
  });

  registry.register({
    id: "core.elemental-resonance-weapon",
    balance: { basis: "published-analogs", reviewed: true, notes: "Core homebrew profile benchmarked against published specific magic items." },
    itemType: "weapon",
    label: "PF2E_ITEM_FORGE.SpecificItemProfiles.ElementalWeapon",
    description: "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponName",
    effectText: "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponEffect",
    allowedThemes: ["fire", "cold", "electricity", "acid"],
    itemTraitsByTheme: {
      fire: ["fire"], cold: ["cold"], electricity: ["electricity"], acid: ["acid"]
    },
    valuesByTheme: {
      fire: { damageLabel: "PF2E_ITEM_FORGE.Damage.Fire" },
      cold: { damageLabel: "PF2E_ITEM_FORGE.Damage.Cold" },
      electricity: { damageLabel: "PF2E_ITEM_FORGE.Damage.Electricity" },
      acid: { damageLabel: "PF2E_ITEM_FORGE.Damage.Acid" }
    },
    propertyRunesByTheme: {
      fire: ["flaming"], cold: ["frost"], electricity: ["shock"], acid: ["corrosive"]
    },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 8, price: 550, fundamentalProfile: "potency-1-striking", values: { surgeDamage: "2d6" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 12, price: 2400, fundamentalProfile: "potency-2-greater-striking", values: { surgeDamage: "4d6" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 16, price: 11000, fundamentalProfile: "potency-3-greater-striking", values: { surgeDamage: "6d6" } }
    ]
  });

  registry.register({
    id: "core.elemental-ward-armor",
    balance: { basis: "published-analogs", reviewed: true, notes: "Core homebrew profile benchmarked against published specific magic items." },
    itemType: "armor",
    label: "PF2E_ITEM_FORGE.SpecificItemProfiles.ElementalArmor",
    description: "PF2E_ITEM_FORGE.SpecificItemText.ElementalArmorDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificItemText.ElementalArmorName",
    effectText: "PF2E_ITEM_FORGE.SpecificItemText.ElementalArmorEffect",
    allowedThemes: ["fire", "cold", "electricity", "acid"],
    itemTraitsByTheme: {
      fire: ["fire"], cold: ["cold"], electricity: ["electricity"], acid: ["acid"]
    },
    valuesByTheme: {
      fire: { damageLabel: "PF2E_ITEM_FORGE.Damage.Fire" },
      cold: { damageLabel: "PF2E_ITEM_FORGE.Damage.Cold" },
      electricity: { damageLabel: "PF2E_ITEM_FORGE.Damage.Electricity" },
      acid: { damageLabel: "PF2E_ITEM_FORGE.Damage.Acid" }
    },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 7, price: 360, fundamentalProfile: "potency-1", values: { resistance: 2 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 11, price: 1500, fundamentalProfile: "potency-2-resilient", values: { resistance: 5 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 18, price: 25000, fundamentalProfile: "potency-3-greater-resilient", values: { resistance: 10 } }
    ]
  });

  registry.register({
    id: "core.guardian-reaction-armor",
    balance: { basis: "published-analogs", reviewed: true, notes: "Core homebrew profile benchmarked against published specific magic items." },
    itemType: "armor",
    label: "PF2E_ITEM_FORGE.SpecificItemProfiles.GuardianArmor",
    description: "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorName",
    effectText: "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 6, price: 250, fundamentalProfile: "potency-1", values: { acBonus: 1, frequency: "PF2E_ITEM_FORGE.SpecificItemText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 1050, fundamentalProfile: "potency-1-resilient", values: { acBonus: 1, frequency: "PF2E_ITEM_FORGE.SpecificItemText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 14, price: 4600, fundamentalProfile: "potency-2-greater-resilient", values: { acBonus: 2, frequency: "PF2E_ITEM_FORGE.SpecificItemText.OncePerTenMinutes" } }
    ]
  });

  return registry;
}
