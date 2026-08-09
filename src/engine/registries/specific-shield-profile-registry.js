import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";
import { SHIELD_REINFORCING_PROFILES } from "../equipment-rune-profiles.js";


const REINFORCING_BY_VALUE = new Map(SHIELD_REINFORCING_PROFILES.map((profile) => [profile.reinforcing, profile]));

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value))];
}

function validDurability(value) {
  if (!value || typeof value !== "object") return false;
  const hardness = Number(value.hardness);
  const hp = Number(value.hp);
  const bt = Number(value.bt ?? hp / 2);
  return Number.isFinite(hardness) && hardness >= 0 && Number.isFinite(hp) && hp > 0 && Number.isFinite(bt) && bt > 0 && bt <= hp;
}

export class SpecificShieldProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Specific shield profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate specific shield profile: ${id}`);

    const allowedThemes = uniqueStrings(definition.allowedThemes);
    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`),
          label: variant.label ?? null,
          level: Number(variant.level),
          price: Number(variant.price),
          reinforcing: Number(variant.reinforcing ?? 0),
          durability: {
            hardness: Number(variant.durability?.hardness),
            hp: Number(variant.durability?.hp),
            bt: Number(variant.durability?.bt ?? Number(variant.durability?.hp) / 2)
          },
          values: structuredClone(variant.values ?? {})
        }))
      : [];

    if (!variants.length) throw new Error(`Specific shield profile ${id} requires at least one variant`);
    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid specific shield level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Specific shield profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid specific shield price in ${id}`);
      if (!validDurability(variant.durability)) throw new Error(`Invalid specific shield durability in ${id}:${variant.id}`);
      if (!Number.isInteger(variant.reinforcing) || !REINFORCING_BY_VALUE.has(variant.reinforcing)) {
        throw new Error(`Invalid reinforcing rune value in ${id}:${variant.id}`);
      }
      const reinforcingProfile = REINFORCING_BY_VALUE.get(variant.reinforcing);
      if (variant.level < reinforcingProfile.level) {
        throw new Error(`Specific shield variant ${id}:${variant.id} is below its reinforcing-rune level`);
      }
      // Custom shield profiles currently store explicit final durability values.
      // Until PF2e runtime behavior for combining those values with a reinforcing
      // rune is verified, reject non-zero runes rather than risk double-scaling.
      if (variant.reinforcing > 0) {
        throw new Error(`Specific shield variant ${id}:${variant.id} cannot combine explicit final durability with a reinforcing rune`);
      }
      lastLevel = variant.level;
    }

    const compatibility = definition.compatibility ?? {};
    const profile = {
      id,
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Specific shield profile", id }),
      rarity: definition.rarity ?? "common",
      allowedThemes,
      itemTraitsByTheme: structuredClone(definition.itemTraitsByTheme ?? {}),
      valuesByTheme: structuredClone(definition.valuesByTheme ?? {}),
      compatibility: {
        requiredTraits: uniqueStrings(compatibility.requiredTraits),
        forbiddenTraits: uniqueStrings(compatibility.forbiddenTraits),
        baseItems: uniqueStrings(compatibility.baseItems)
      },
      variants
    };

    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) { return this.#profiles.get(id) ?? null; }
  getAll() { return [...this.#profiles.values()]; }
  has(id) { return this.#profiles.has(id); }
}

export function registerCoreSpecificShieldProfiles(registry = new SpecificShieldProfileRegistry()) {
  registry.register({
    id: "core.restorative-shield",
    balance: { basis: "published-analogs", reviewed: true, notes: "Homebrew family benchmarked against published specific shields with direct durability progressions and repair effects." },
    label: "PF2E_ITEM_FORGE.SpecificShieldProfiles.Restorative",
    description: "PF2E_ITEM_FORGE.SpecificShieldText.RestorativeDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificShieldText.RestorativeName",
    effectText: "PF2E_ITEM_FORGE.SpecificShieldText.RestorativeEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 5, price: 160, durability: { hardness: 6, hp: 32, bt: 16 }, values: { repair: 12 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 10, price: 1000, durability: { hardness: 10, hp: 72, bt: 36 }, values: { repair: 24 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 15, price: 6500, durability: { hardness: 14, hp: 104, bt: 52 }, values: { repair: 40 } }
    ]
  });

  registry.register({
    id: "core.elemental-bastion-shield",
    balance: { basis: "published-analogs", reviewed: true, notes: "Homebrew family benchmarked against published shields that combine durability, resistance and activations." },
    label: "PF2E_ITEM_FORGE.SpecificShieldProfiles.ElementalBastion",
    description: "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionName",
    effectText: "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionEffect",
    allowedThemes: ["fire", "cold", "electricity", "acid"],
    itemTraitsByTheme: { fire: ["fire"], cold: ["cold"], electricity: ["electricity"], acid: ["acid"] },
    valuesByTheme: {
      fire: { damageLabel: "PF2E_ITEM_FORGE.Damage.Fire" },
      cold: { damageLabel: "PF2E_ITEM_FORGE.Damage.Cold" },
      electricity: { damageLabel: "PF2E_ITEM_FORGE.Damage.Electricity" },
      acid: { damageLabel: "PF2E_ITEM_FORGE.Damage.Acid" }
    },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 7, price: 360, durability: { hardness: 7, hp: 48, bt: 24 }, values: { resistance: 2 } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 12, price: 1900, durability: { hardness: 11, hp: 88, bt: 44 }, values: { resistance: 5 } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 17, price: 14000, durability: { hardness: 15, hp: 120, bt: 60 }, values: { resistance: 10 } }
    ]
  });

  registry.register({
    id: "core.guardian-bulwark-shield",
    balance: { basis: "published-analogs", reviewed: true, notes: "Homebrew family benchmarked against Clockwork Shield-style defensive reaction economy without copying its full minute-long benefit." },
    label: "PF2E_ITEM_FORGE.SpecificShieldProfiles.GuardianBulwark",
    description: "PF2E_ITEM_FORGE.SpecificShieldText.GuardianBulwarkDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpecificShieldText.GuardianBulwarkName",
    effectText: "PF2E_ITEM_FORGE.SpecificShieldText.GuardianBulwarkEffect",
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Base", level: 8, price: 500, durability: { hardness: 8, hp: 56, bt: 28 }, values: { frequency: "PF2E_ITEM_FORGE.SpecificShieldText.OncePerDay" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", level: 13, price: 3000, durability: { hardness: 12, hp: 90, bt: 45 }, values: { frequency: "PF2E_ITEM_FORGE.SpecificShieldText.OncePerHour" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpecificItemVariants.Major", level: 18, price: 22000, durability: { hardness: 17, hp: 130, bt: 65 }, values: { frequency: "PF2E_ITEM_FORGE.SpecificShieldText.OncePerTenMinutes" } }
    ]
  });

  return registry;
}
