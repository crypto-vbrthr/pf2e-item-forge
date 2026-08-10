import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";

const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);
const VALID_ACTIVATION_TYPES = new Set(["action", "reaction", "free-action"]);
const VALID_BULK = /^(?:-|L|\d+)$/i;

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase()))];
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeActivation(activation, { profileId, variantId, fallbackEffectText = null } = {}) {
  if (activation == null) return null;
  if (!activation || typeof activation !== "object" || Array.isArray(activation)) {
    throw new TypeError(`Held magic profile ${profileId} variant ${variantId} activation must be an object`);
  }

  const suppliedActions = activation.actions == null ? null : Number(activation.actions);
  const inferredType = activation.type == null
    ? (suppliedActions === 0 ? "free-action" : "action")
    : String(activation.type).trim().toLowerCase();
  if (!VALID_ACTIVATION_TYPES.has(inferredType)) {
    throw new Error(`Held magic profile ${profileId} variant ${variantId} has invalid activation type`);
  }

  let actions = 0;
  if (inferredType === "action") {
    actions = suppliedActions;
    if (!Number.isInteger(actions) || actions < 1 || actions > 3) {
      throw new Error(`Held magic profile ${profileId} variant ${variantId} has invalid activation actions`);
    }
  } else if (suppliedActions != null && suppliedActions !== 0) {
    throw new Error(`Held magic profile ${profileId} variant ${variantId} ${inferredType} activation must not declare action count`);
  }

  const frequency = activation.frequency == null ? null : {
    max: Number(activation.frequency.max),
    period: normalizeText(activation.frequency.period)
  };
  if (frequency && (!Number.isInteger(frequency.max) || frequency.max < 1 || !frequency.period)) {
    throw new Error(`Held magic profile ${profileId} variant ${variantId} has invalid activation frequency`);
  }
  const effectText = normalizeText(activation.effectText ?? fallbackEffectText);
  if (!effectText) throw new Error(`Held magic profile ${profileId} variant ${variantId} activation requires effectText`);
  return {
    type: inferredType,
    actions,
    traits: uniqueStrings(activation.traits),
    frequency,
    trigger: normalizeText(activation.trigger),
    requirements: normalizeText(activation.requirements),
    duration: normalizeText(activation.duration),
    effectText
  };
}

function normalizePassive(passive, { profileId } = {}) {
  if (passive == null) return null;
  if (!passive || typeof passive !== "object" || Array.isArray(passive)) {
    throw new TypeError(`Held magic profile ${profileId} passive must be an object`);
  }
  const effectText = normalizeText(passive.effectText);
  if (!effectText) throw new Error(`Held magic profile ${profileId} passive requires effectText`);
  return { effectText };
}

function normalizePhysical(physical, { profileId } = {}) {
  const bulk = String(physical?.bulk ?? "L").trim();
  if (!VALID_BULK.test(bulk)) throw new Error(`Held magic profile ${profileId} has invalid bulk ${bulk}`);
  return { bulk: bulk.toUpperCase() === "L" ? "L" : bulk };
}

export class HeldMagicProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Held magic profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate held magic profile: ${id}`);

    const hands = Number(definition?.hands);
    if (![1, 2].includes(hands)) throw new Error(`Held magic profile ${id} requires hands 1 or 2`);

    const effectText = normalizeText(definition.effectText);
    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => {
          const variantId = String(variant.id ?? ["base", "greater", "major", "supreme"][index] ?? `tier-${index + 1}`).trim();
          return {
            id: variantId,
            label: variant.label ?? null,
            level: Number(variant.level),
            price: Number(variant.price),
            values: clone(variant.values ?? {}),
            activation: normalizeActivation(variant.activation, { profileId: id, variantId, fallbackEffectText: effectText })
          };
        })
      : [];
    if (!variants.length) throw new Error(`Held magic profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    const ids = new Set();
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Held magic profile ${id} has an empty variant id`);
      if (ids.has(variant.id)) throw new Error(`Held magic profile ${id} has duplicate variant id ${variant.id}`);
      ids.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 1 || variant.level > 20) throw new Error(`Invalid held magic item level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Held magic profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid held magic item price in ${id}`);
      lastLevel = variant.level;
    }

    const rarity = String(definition.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Held magic profile ${id} has invalid rarity ${rarity}`);
    if (definition.invested !== undefined && typeof definition.invested !== "boolean") throw new TypeError(`Held magic profile ${id} invested must be boolean`);

    const profile = {
      id,
      hands,
      label: definition.label ?? id,
      description: normalizeText(definition.description),
      nameTemplate: normalizeText(definition.nameTemplate),
      effectText,
      passive: normalizePassive(definition.passive, { profileId: id }),
      physical: normalizePhysical(definition.physical, { profileId: id }),
      rarity,
      invested: definition.invested === true,
      traits: uniqueStrings(definition.traits),
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Held magic profile", id }),
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      variants
    };
    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) { return this.#profiles.get(id) ?? null; }
  getAll() { return [...this.#profiles.values()]; }
  getForHands(hands) { return this.getAll().filter((profile) => profile.hands === Number(hands)); }
  has(id) { return this.#profiles.has(id); }
}

function frequency(period) {
  return { max: 1, period };
}

function tierActivation(actions, traits, period, effectText, type = "action") {
  return { type, actions, traits, frequency: frequency(period), effectText };
}

function makeRows(levels, prices, values, { actions, traits, effectText, type = "action" }) {
  const periods = ["day", "hour", "hour", "10-minutes"];
  const ids = ["base", "greater", "major", "supreme"];
  const labels = [
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Greater",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Major",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme"
  ];
  return levels.map((level, index) => ({
    id: ids[index],
    label: labels[index],
    level,
    price: prices[index],
    values: clone(values[index] ?? {}),
    activation: tierActivation(actions, traits, periods[index], effectText, type)
  }));
}

export function registerCoreHeldMagicProfiles(registry = new HeldMagicProfileRegistry()) {
  const shared = {
    basis: "published-analogs",
    reviewed: true,
    analogs: ["treasure-vault-held-items"],
    notes: "Homebrew held-item profiles benchmarked against Treasure Vault permanent held-item level/price bands and activation cadence."
  };
  const prices = {
    1: 15, 2: 30, 3: 55, 4: 90, 5: 140,
    6: 225, 7: 330, 8: 450, 9: 650, 10: 900,
    11: 1250, 12: 1800, 13: 2700, 14: 4000, 15: 6000,
    16: 9000, 17: 13000, 18: 19000, 19: 40000, 20: 70000
  };
  const p = (levels) => levels.map((level) => prices[level]);

  const specs = [
    {
      id: "core.waylight-lantern", hands: 1, bulk: "L", traits: ["light"],
      label: "PF2E_ITEM_FORGE.HeldProfiles.WaylightLantern", name: "PF2E_ITEM_FORGE.HeldText.WaylightLanternName",
      description: "PF2E_ITEM_FORGE.HeldText.WaylightLanternDescription", effect: "PF2E_ITEM_FORGE.HeldText.WaylightLanternEffect",
      levels: [1, 6, 11, 16], values: [{ radius: 10 }, { radius: 20 }, { radius: 30 }, { radius: 40 }], actions: 1, activationTraits: ["concentrate"]
    },
    {
      id: "core.scholar-prism", hands: 1, bulk: "L", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.ScholarPrism", name: "PF2E_ITEM_FORGE.HeldText.ScholarPrismName",
      description: "PF2E_ITEM_FORGE.HeldText.ScholarPrismDescription", effect: "PF2E_ITEM_FORGE.HeldText.ScholarPrismEffect",
      levels: [2, 7, 12, 17], values: [{ bonus: 1 }, { bonus: 1 }, { bonus: 2 }, { bonus: 3 }], actions: 1, activationTraits: ["concentrate"]
    },
    {
      id: "core.resonance-baton", hands: 1, bulk: "L", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.ResonanceBaton", name: "PF2E_ITEM_FORGE.HeldText.ResonanceBatonName",
      description: "PF2E_ITEM_FORGE.HeldText.ResonanceBatonDescription", effect: "PF2E_ITEM_FORGE.HeldText.ResonanceBatonEffect",
      levels: [3, 8, 13, 18], values: [{ temp: 3 }, { temp: 8 }, { temp: 13 }, { temp: 18 }], actions: 1, activationTraits: ["auditory", "concentrate"]
    },
    {
      id: "core.echo-compass", hands: 1, bulk: "L", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.EchoCompass", name: "PF2E_ITEM_FORGE.HeldText.EchoCompassName",
      description: "PF2E_ITEM_FORGE.HeldText.EchoCompassDescription", effect: "PF2E_ITEM_FORGE.HeldText.EchoCompassEffect",
      levels: [4, 9, 14, 19], values: [{ bonus: 1, distance: 20 }, { bonus: 1, distance: 30 }, { bonus: 2, distance: 40 }, { bonus: 3, distance: 60 }], actions: 1, activationTraits: ["concentrate"]
    },
    {
      id: "core.warding-bell", hands: 1, bulk: "L", traits: ["auditory"],
      label: "PF2E_ITEM_FORGE.HeldProfiles.WardingBell", name: "PF2E_ITEM_FORGE.HeldText.WardingBellName",
      description: "PF2E_ITEM_FORGE.HeldText.WardingBellDescription", effect: "PF2E_ITEM_FORGE.HeldText.WardingBellEffect",
      levels: [5, 10, 15, 20], values: [{ radius: 10, bonus: 1 }, { radius: 15, bonus: 1 }, { radius: 20, bonus: 2 }, { radius: 30, bonus: 3 }], actions: 1, activationTraits: ["auditory", "concentrate"]
    },
    {
      id: "core.guiding-brazier", hands: 2, bulk: "1", traits: ["light"],
      label: "PF2E_ITEM_FORGE.HeldProfiles.GuidingBrazier", name: "PF2E_ITEM_FORGE.HeldText.GuidingBrazierName",
      description: "PF2E_ITEM_FORGE.HeldText.GuidingBrazierDescription", effect: "PF2E_ITEM_FORGE.HeldText.GuidingBrazierEffect",
      levels: [1, 6, 11, 16], values: [{ radius: 10 }, { radius: 15 }, { radius: 20 }, { radius: 30 }], actions: 2, activationTraits: ["concentrate", "manipulate"]
    },
    {
      id: "core.memory-tablet", hands: 2, bulk: "1", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.MemoryTablet", name: "PF2E_ITEM_FORGE.HeldText.MemoryTabletName",
      description: "PF2E_ITEM_FORGE.HeldText.MemoryTabletDescription", effect: "PF2E_ITEM_FORGE.HeldText.MemoryTabletEffect",
      levels: [2, 7, 12, 17], values: [{ bonus: 1 }, { bonus: 1 }, { bonus: 2 }, { bonus: 3 }], actions: 2, activationTraits: ["concentrate", "manipulate"]
    },
    {
      id: "core.rescue-pole", hands: 2, bulk: "1", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.RescuePole", name: "PF2E_ITEM_FORGE.HeldText.RescuePoleName",
      description: "PF2E_ITEM_FORGE.HeldText.RescuePoleDescription", effect: "PF2E_ITEM_FORGE.HeldText.RescuePoleEffect",
      levels: [3, 8, 13, 18], values: [{ distance: 10 }, { distance: 15 }, { distance: 20 }, { distance: 30 }], actions: 1, activationTraits: ["manipulate"]
    },
    {
      id: "core.stormglass-sphere", hands: 2, bulk: "1", traits: ["air"],
      label: "PF2E_ITEM_FORGE.HeldProfiles.StormglassSphere", name: "PF2E_ITEM_FORGE.HeldText.StormglassSphereName",
      description: "PF2E_ITEM_FORGE.HeldText.StormglassSphereDescription", effect: "PF2E_ITEM_FORGE.HeldText.StormglassSphereEffect",
      levels: [4, 9, 14, 19], values: [{ distance: 10 }, { distance: 20 }, { distance: 30 }, { distance: 40 }], actions: 2, activationTraits: ["concentrate", "manipulate"]
    },
    {
      id: "core.guardian-standard", hands: 2, bulk: "1", traits: [],
      label: "PF2E_ITEM_FORGE.HeldProfiles.GuardianStandard", name: "PF2E_ITEM_FORGE.HeldText.GuardianStandardName",
      description: "PF2E_ITEM_FORGE.HeldText.GuardianStandardDescription", effect: "PF2E_ITEM_FORGE.HeldText.GuardianStandardEffect",
      levels: [5, 10, 15, 20], values: [{ bonus: 1 }, { bonus: 1 }, { bonus: 2 }, { bonus: 3 }], actions: 1, activationTraits: ["concentrate"]
    }
  ];

  for (const spec of specs) {
    registry.register({
      id: spec.id,
      hands: spec.hands,
      label: spec.label,
      nameTemplate: spec.name,
      description: spec.description,
      effectText: spec.effect,
      traits: spec.traits,
      physical: { bulk: spec.bulk },
      balance: shared,
      variants: makeRows(spec.levels, p(spec.levels), spec.values, {
        actions: spec.actions,
        traits: spec.activationTraits,
        effectText: spec.effect
      })
    });
  }
  return registry;
}
