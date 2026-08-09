import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";
import { WORN_SLOT_DEFINITIONS } from "../worn-item-utils.js";

const VALID_SLOTS = new Set(WORN_SLOT_DEFINITIONS.map((slot) => slot.id));

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

export class WornMagicProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Worn magic profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate worn magic profile: ${id}`);

    const slot = String(definition?.slot ?? "").trim();
    if (!VALID_SLOTS.has(slot) || slot === "other") throw new Error(`Worn magic profile ${id} has invalid slot ${slot}`);

    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`),
          label: variant.label ?? null,
          level: Number(variant.level),
          price: Number(variant.price),
          values: structuredClone(variant.values ?? {})
        }))
      : [];
    if (!variants.length) throw new Error(`Worn magic profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid worn magic item level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Worn magic profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid worn magic item price in ${id}`);
      lastLevel = variant.level;
    }

    const profile = {
      id,
      slot,
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      rarity: definition.rarity ?? "common",
      traits: uniqueStrings(definition.traits),
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Worn magic profile", id }),
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
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

  getForSlot(slot) {
    return this.getAll().filter((profile) => profile.slot === slot);
  }

  has(id) {
    return this.#profiles.has(id);
  }
}

export function registerCoreWornMagicProfiles(registry = new WornMagicProfileRegistry()) {
  const balance = { basis: "published-analogs", reviewed: true, notes: "Core homebrew worn-item profile benchmarked against published invested worn items and GM Core item-design guidance." };

  registry.register({
    id: "core.wayfarer-footwear",
    balance,
    slot: "footwear",
    label: "PF2E_ITEM_FORGE.WornProfiles.WayfarerFootwear",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.WayfarerFootwearName",
    description: "PF2E_ITEM_FORGE.WornText.WayfarerFootwearDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.WayfarerFootwearEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 4, price: 90, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 900, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 17, price: 13000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  registry.register({
    id: "core.watchful-eyepiece",
    balance,
    slot: "eyepiece",
    label: "PF2E_ITEM_FORGE.WornProfiles.WatchfulEyepiece",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.WatchfulEyepieceName",
    description: "PF2E_ITEM_FORGE.WornText.WatchfulEyepieceDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.WatchfulEyepieceEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 5, price: 135, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay", activationBonus: 2 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 11, price: 1200, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour", activationBonus: 3 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 18, price: 19000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour", activationBonus: 4 } }
    ]
  });

  registry.register({
    id: "core.steadfast-belt",
    balance,
    slot: "belt",
    label: "PF2E_ITEM_FORGE.WornProfiles.SteadfastBelt",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.SteadfastBeltName",
    description: "PF2E_ITEM_FORGE.WornText.SteadfastBeltDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.SteadfastBeltEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 5, price: 150, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay", resist: 5 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 900, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour", resist: 10 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 17, price: 13000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour", resist: 15 } }
    ]
  });

  registry.register({
    id: "core.guardian-cloak",
    balance,
    slot: "cloak",
    label: "PF2E_ITEM_FORGE.WornProfiles.GuardianCloak",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.GuardianCloakName",
    description: "PF2E_ITEM_FORGE.WornText.GuardianCloakDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.GuardianCloakEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 5, price: 150, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 11, price: 1250, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 18, price: 20000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  registry.register({
    id: "core.merciful-mask",
    balance,
    slot: "mask",
    label: "PF2E_ITEM_FORGE.WornProfiles.MercifulMask",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.MercifulMaskName",
    description: "PF2E_ITEM_FORGE.WornText.MercifulMaskDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.MercifulMaskEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 4, price: 100, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 950, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 17, price: 14000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  registry.register({
    id: "core.scholar-circlet",
    balance,
    slot: "circlet",
    label: "PF2E_ITEM_FORGE.WornProfiles.ScholarCirclet",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.ScholarCircletName",
    description: "PF2E_ITEM_FORGE.WornText.ScholarCircletDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.ScholarCircletEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 5, price: 140, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 11, price: 1200, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 18, price: 19000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  return registry;
}
