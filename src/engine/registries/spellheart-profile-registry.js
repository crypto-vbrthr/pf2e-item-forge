export class SpellheartProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Spellheart profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate spellheart profile: ${id}`);

    const allowedThemes = [...new Set((definition.allowedThemes ?? []).filter((theme) => typeof theme === "string" && theme))];
    if (!allowedThemes.length) throw new Error(`Spellheart profile ${id} requires at least one allowed theme`);

    const variants = Array.isArray(definition.variants) ? definition.variants.map((variant, index) => ({
      id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`),
      label: variant.label ?? null,
      level: Number(variant.level),
      price: Number(variant.price),
      spellDC: variant.spellDC == null ? null : Number(variant.spellDC),
      spellAttack: variant.spellAttack == null ? null : Number(variant.spellAttack),
      dailyRanks: Array.isArray(variant.dailyRanks) ? variant.dailyRanks.map(Number) : [],
      values: structuredClone(variant.values ?? {})
    })) : [];

    if (!variants.length) throw new Error(`Spellheart profile ${id} requires at least one variant`);
    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid spellheart variant level in ${id}`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid spellheart variant price in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Spellheart profile ${id} variants must increase in level`);
      lastLevel = variant.level;
      if (variant.spellDC != null && (!Number.isInteger(variant.spellDC) || variant.spellDC < 10)) {
        throw new Error(`Invalid spellheart spell DC in ${id}`);
      }
      if (variant.spellAttack != null && (!Number.isInteger(variant.spellAttack) || variant.spellAttack < 0)) {
        throw new Error(`Invalid spellheart spell attack in ${id}`);
      }
      for (const rank of variant.dailyRanks) {
        if (!Number.isInteger(rank) || rank < 1 || rank > 10) throw new Error(`Invalid daily spell rank in spellheart profile ${id}`);
      }
    }

    const profile = {
      id,
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      armorText: definition.armorText ?? null,
      weaponText: definition.weaponText ?? null,
      activationText: definition.activationText ?? null,
      allowedThemes,
      itemTraitsByTheme: structuredClone(definition.itemTraitsByTheme ?? {}),
      valuesByTheme: structuredClone(definition.valuesByTheme ?? {}),
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

export function registerCoreSpellheartProfiles(registry = new SpellheartProfileRegistry()) {
  registry.register({
    id: "core.elemental-conduit",
    label: "PF2E_ITEM_FORGE.SpellheartProfiles.ElementalConduit",
    description: "PF2E_ITEM_FORGE.SpellheartText.ElementalDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpellheartText.ElementalName",
    armorText: "PF2E_ITEM_FORGE.SpellheartText.ElementalArmor",
    weaponText: "PF2E_ITEM_FORGE.SpellheartText.ElementalWeapon",
    activationText: "PF2E_ITEM_FORGE.SpellheartText.StandardActivation",
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
      { id: "base", label: "PF2E_ITEM_FORGE.SpellheartVariants.Base", level: 3, price: 60, spellDC: 17, spellAttack: 7, dailyRanks: [], values: { resistance: 2, weaponDamage: "1d4" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpellheartVariants.Greater", level: 8, price: 450, spellDC: 24, spellAttack: 14, dailyRanks: [3], values: { resistance: 5, weaponDamage: "1d6" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpellheartVariants.Major", level: 13, price: 2800, spellDC: 30, spellAttack: 20, dailyRanks: [4, 5], values: { resistance: 10, weaponDamage: "1d8" } }
    ]
  });

  registry.register({
    id: "core.sonic-resonator",
    label: "PF2E_ITEM_FORGE.SpellheartProfiles.SonicResonator",
    description: "PF2E_ITEM_FORGE.SpellheartText.SonicDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpellheartText.SonicName",
    armorText: "PF2E_ITEM_FORGE.SpellheartText.SonicArmor",
    weaponText: "PF2E_ITEM_FORGE.SpellheartText.SonicWeapon",
    activationText: "PF2E_ITEM_FORGE.SpellheartText.StandardActivation",
    allowedThemes: ["sonic"],
    itemTraitsByTheme: { sonic: ["sonic"] },
    valuesByTheme: { sonic: { damageLabel: "PF2E_ITEM_FORGE.Damage.Sonic" } },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpellheartVariants.Base", level: 5, price: 140, spellDC: 19, spellAttack: 9, dailyRanks: [1], values: { resistance: 2, saveBonus: 1, weaponCondition: "PF2E_ITEM_FORGE.SpellheartText.DeafenedShort" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpellheartVariants.Greater", level: 7, price: 340, spellDC: 23, spellAttack: 13, dailyRanks: [2, 2], values: { resistance: 5, saveBonus: 2, weaponCondition: "PF2E_ITEM_FORGE.SpellheartText.DeafenedMedium" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpellheartVariants.Major", level: 12, price: 1800, spellDC: 29, spellAttack: 19, dailyRanks: [4, 5], values: { resistance: 10, saveBonus: 2, weaponCondition: "PF2E_ITEM_FORGE.SpellheartText.DeafenedLong" } }
    ]
  });

  registry.register({
    id: "core.void-fang",
    label: "PF2E_ITEM_FORGE.SpellheartProfiles.VoidFang",
    description: "PF2E_ITEM_FORGE.SpellheartText.VoidDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpellheartText.VoidName",
    armorText: "PF2E_ITEM_FORGE.SpellheartText.VoidArmor",
    weaponText: "PF2E_ITEM_FORGE.SpellheartText.VoidWeapon",
    activationText: "PF2E_ITEM_FORGE.SpellheartText.StandardActivation",
    allowedThemes: ["void"],
    itemTraitsByTheme: { void: ["void"] },
    valuesByTheme: { void: { damageLabel: "PF2E_ITEM_FORGE.Damage.Bleed" } },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpellheartVariants.Base", level: 9, price: 650, spellDC: 25, dailyRanks: [3], values: { resistance: 3, saveBonus: 2, weaponDamage: "1d4" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpellheartVariants.Greater", level: 12, price: 1750, spellDC: 29, dailyRanks: [4, 4], values: { resistance: 5, saveBonus: 2, weaponDamage: "1d6" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpellheartVariants.Major", level: 15, price: 5750, spellDC: 34, dailyRanks: [5, 6], values: { resistance: 10, saveBonus: 3, weaponDamage: "2d6" } }
    ]
  });

  registry.register({
    id: "core.vitality-feather",
    label: "PF2E_ITEM_FORGE.SpellheartProfiles.VitalityFeather",
    description: "PF2E_ITEM_FORGE.SpellheartText.VitalityDescription",
    nameTemplate: "PF2E_ITEM_FORGE.SpellheartText.VitalityName",
    armorText: "PF2E_ITEM_FORGE.SpellheartText.VitalityArmor",
    weaponText: "PF2E_ITEM_FORGE.SpellheartText.VitalityWeapon",
    activationText: "PF2E_ITEM_FORGE.SpellheartText.StandardActivation",
    allowedThemes: ["vitality", "healing"],
    itemTraitsByTheme: { vitality: ["vitality", "healing"], healing: ["vitality", "healing"] },
    valuesByTheme: {
      vitality: { runeLabel: "PF2E_ITEM_FORGE.SpellheartText.VitalizingRune" },
      healing: { runeLabel: "PF2E_ITEM_FORGE.SpellheartText.VitalizingRune" }
    },
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.SpellheartVariants.Base", level: 10, price: 960, dailyRanks: [4], values: { saveBonus: 2, weaponRune: "vitalizing" } },
      { id: "greater", label: "PF2E_ITEM_FORGE.SpellheartVariants.Greater", level: 14, price: 4100, dailyRanks: [5, 5], values: { saveBonus: 3, weaponRune: "vitalizing" } },
      { id: "major", label: "PF2E_ITEM_FORGE.SpellheartVariants.Major", level: 16, price: 9400, dailyRanks: [6, 7], values: { saveBonus: 4, weaponRune: "greater-vitalizing" } }
    ]
  });

  return registry;
}
