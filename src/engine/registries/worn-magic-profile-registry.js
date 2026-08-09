import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";
import { WORN_SLOT_DEFINITIONS } from "../worn-item-utils.js";

const VALID_SLOTS = new Set(WORN_SLOT_DEFINITIONS.map((slot) => slot.id));
const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase()))];
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
          id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`).trim(),
          label: variant.label ?? null,
          level: Number(variant.level),
          price: Number(variant.price),
          values: structuredClone(variant.values ?? {})
        }))
      : [];
    if (!variants.length) throw new Error(`Worn magic profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    const variantIds = new Set();
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Worn magic profile ${id} has an empty variant id`);
      if (variantIds.has(variant.id)) throw new Error(`Worn magic profile ${id} has duplicate variant id ${variant.id}`);
      variantIds.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid worn magic item level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Worn magic profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid worn magic item price in ${id}`);
      lastLevel = variant.level;
    }

    const rarity = String(definition.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Worn magic profile ${id} has invalid rarity ${rarity}`);
    if (definition.invested !== undefined && typeof definition.invested !== "boolean") throw new TypeError(`Worn magic profile ${id} invested must be boolean`);

    const profile = {
      id,
      slot,
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      rarity,
      invested: definition.invested !== false,
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
  const balance = { basis: "published-analogs", reviewed: true, analogs: ["mirror-goggles", "mask-of-mercy", "treasure-vault-worn-item-tables"], notes: "Core homebrew worn-item profile benchmarked against published invested worn items and GM Core item-design guidance." };


  registry.register({
    id: "core.pathmark-charm",
    balance: { basis: "published-analogs", reviewed: true, analogs: ["ring-of-discretion", "candlecap"], notes: "Low-level utility profile benchmarked against level-1 published worn items in Treasure Vault." },
    slot: "unrestricted",
    label: "PF2E_ITEM_FORGE.WornProfiles.PathmarkCharm",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.PathmarkCharmName",
    description: "PF2E_ITEM_FORGE.WornText.PathmarkCharmDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.PathmarkCharmEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 1, price: 15, values: { frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } }
    ]
  });

  registry.register({
    id: "core.signal-gloves",
    balance: { basis: "published-analogs", reviewed: true, analogs: ["apparition-gloves", "goz-mask"], notes: "Low-level non-invested utility profile benchmarked against level-2 published worn items in Treasure Vault." },
    slot: "gloves",
    invested: false,
    traits: ["illusion"],
    label: "PF2E_ITEM_FORGE.WornProfiles.SignalGloves",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.SignalGlovesName",
    description: "PF2E_ITEM_FORGE.WornText.SignalGlovesDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.SignalGlovesEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 2, price: 25, values: {} }
    ]
  });

  registry.register({
    id: "core.quickhand-bracers",
    balance: { basis: "published-analogs", reviewed: true, analogs: ["armory-bracelet", "skinsaw-mask"], notes: "Low-level action utility profile benchmarked against level-3 published worn items in Treasure Vault." },
    slot: "bracers",
    label: "PF2E_ITEM_FORGE.WornProfiles.QuickhandBracers",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.QuickhandBracersName",
    description: "PF2E_ITEM_FORGE.WornText.QuickhandBracersDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.QuickhandBracersEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 3, price: 50, values: { frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } }
    ]
  });

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


  registry.register({
    id: "core.surehand-gloves",
    balance,
    slot: "gloves",
    label: "PF2E_ITEM_FORGE.WornProfiles.SurehandGloves",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.SurehandGlovesName",
    description: "PF2E_ITEM_FORGE.WornText.SurehandGlovesDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.SurehandGlovesEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 6, price: 220, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 12, price: 1800, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 19, price: 40000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerTenMinutes" } }
    ]
  });

  registry.register({
    id: "core.artificer-bracers",
    balance,
    slot: "bracers",
    label: "PF2E_ITEM_FORGE.WornProfiles.ArtificerBracers",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.ArtificerBracersName",
    description: "PF2E_ITEM_FORGE.WornText.ArtificerBracersDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.ArtificerBracersEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 7, price: 330, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 13, price: 2700, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 20, price: 70000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerTenMinutes" } }
    ]
  });

  registry.register({
    id: "core.mistweave-garment",
    balance,
    slot: "garment",
    label: "PF2E_ITEM_FORGE.WornProfiles.MistweaveGarment",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.MistweaveGarmentName",
    description: "PF2E_ITEM_FORGE.WornText.MistweaveGarmentDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.MistweaveGarmentEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 8, price: 450, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 14, price: 4000, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  registry.register({
    id: "core.resolute-brooch",
    balance,
    slot: "unrestricted",
    label: "PF2E_ITEM_FORGE.WornProfiles.ResoluteBrooch",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.ResoluteBroochName",
    description: "PF2E_ITEM_FORGE.WornText.ResoluteBroochDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.ResoluteBroochEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 9, price: 650, values: { bonus: 1, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay", reduction: 1 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 15, price: 6000, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour", reduction: 2 } }
    ]
  });

  registry.register({
    id: "core.horizon-helm",
    balance,
    slot: "headwear",
    label: "PF2E_ITEM_FORGE.WornProfiles.HorizonHelm",
    nameTemplate: "PF2E_ITEM_FORGE.WornText.HorizonHelmName",
    description: "PF2E_ITEM_FORGE.WornText.HorizonHelmDescription",
    effectText: "PF2E_ITEM_FORGE.WornText.HorizonHelmEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 10, price: 900, values: { bonus: 2, frequency: "PF2E_ITEM_FORGE.WornText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 16, price: 9000, values: { bonus: 3, frequency: "PF2E_ITEM_FORGE.WornText.OncePerHour" } }
    ]
  });

  return registry;
}
