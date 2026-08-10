import { APEX_ATTRIBUTES } from "../apex-item-utils.js";
import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";

const VALID_ATTRIBUTES = new Set(APEX_ATTRIBUTES);
const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);
const VALID_ACTIVATION_TYPES = new Set(["action", "reaction", "free-action"]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase()))];
}

function normalizeActivation(activation, { profileId, variantId } = {}) {
  if (activation == null) return null;
  if (!activation || typeof activation !== "object" || Array.isArray(activation)) {
    throw new TypeError(`Apex profile ${profileId} variant ${variantId} activation must be an object`);
  }
  const type = String(activation.type ?? "action").trim().toLowerCase();
  if (!VALID_ACTIVATION_TYPES.has(type)) throw new Error(`Apex profile ${profileId} variant ${variantId} has invalid activation type`);
  const suppliedActions = activation.actions == null ? null : Number(activation.actions);
  let actions = 0;
  if (type === "action") {
    actions = suppliedActions;
    if (!Number.isInteger(actions) || actions < 1 || actions > 3) throw new Error(`Apex profile ${profileId} variant ${variantId} has invalid activation actions`);
  } else if (suppliedActions != null && suppliedActions !== 0) {
    throw new Error(`Apex profile ${profileId} variant ${variantId} ${type} activation must not declare action count`);
  }
  const frequency = activation.frequency == null ? null : {
    max: Number(activation.frequency.max),
    period: normalizeText(activation.frequency.period)
  };
  if (frequency && (!Number.isInteger(frequency.max) || frequency.max < 1 || !frequency.period)) {
    throw new Error(`Apex profile ${profileId} variant ${variantId} has invalid activation frequency`);
  }
  const effectText = normalizeText(activation.effectText);
  if (!effectText) throw new Error(`Apex profile ${profileId} variant ${variantId} activation requires effectText`);
  return {
    type,
    actions,
    traits: uniqueStrings(activation.traits),
    frequency,
    trigger: normalizeText(activation.trigger),
    requirements: normalizeText(activation.requirements),
    duration: normalizeText(activation.duration),
    effectText
  };
}

export class ApexProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Apex profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate apex profile: ${id}`);
    const attribute = String(definition?.attribute ?? "").trim().toLowerCase();
    if (!VALID_ATTRIBUTES.has(attribute)) throw new Error(`Apex profile ${id} has invalid attribute ${attribute}`);
    const rarity = String(definition.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Apex profile ${id} has invalid rarity ${rarity}`);

    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => {
          const variantId = String(variant.id ?? ["base", "greater", "major", "supreme"][index] ?? `tier-${index + 1}`).trim();
          return {
            id: variantId,
            label: variant.label ?? null,
            level: Number(variant.level),
            price: Number(variant.price),
            values: clone(variant.values ?? {}),
            activation: normalizeActivation(variant.activation, { profileId: id, variantId })
          };
        })
      : [];
    if (!variants.length) throw new Error(`Apex profile ${id} requires at least one variant`);
    const ids = new Set();
    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Apex profile ${id} has an empty variant id`);
      if (ids.has(variant.id)) throw new Error(`Apex profile ${id} has duplicate variant id ${variant.id}`);
      ids.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 17 || variant.level > 20) throw new Error(`Apex profile ${id} variant level must be 17-20`);
      if (variant.level <= lastLevel) throw new Error(`Apex profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid apex item price in ${id}`);
      lastLevel = variant.level;
    }

    const profile = {
      id,
      attribute,
      label: definition.label ?? id,
      nameTemplate: normalizeText(definition.nameTemplate),
      description: normalizeText(definition.description),
      passiveText: normalizeText(definition.passiveText),
      traits: uniqueStrings(definition.traits),
      rarity,
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Apex profile", id }),
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      variants
    };
    if (!profile.nameTemplate || !profile.description || !profile.passiveText) throw new Error(`Apex profile ${id} requires nameTemplate, description, and passiveText`);
    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) { return this.#profiles.get(id) ?? null; }
  getAll() { return [...this.#profiles.values()]; }
  getForAttribute(attribute) { return this.getAll().filter((profile) => profile.attribute === attribute); }
  has(id) { return this.#profiles.has(id); }
}

function rows(effectText, trigger = null, extraTraits = []) {
  const specs = [
    ["base", "PF2E_ITEM_FORGE.SpecificItemVariants.Base", 17, 15000, "day"],
    ["greater", "PF2E_ITEM_FORGE.SpecificItemVariants.Greater", 18, 24000, "day"],
    ["major", "PF2E_ITEM_FORGE.SpecificItemVariants.Major", 19, 40000, "hour"],
    ["supreme", "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme", 20, 70000, "hour"]
  ];
  return specs.map(([id, label, level, price, period], index) => ({
    id, label, level, price,
    values: { tier: index + 1, bonus: level === 20 ? 4 : 3, perceptionBonus: level >= 19 ? 3 : 2, reduction: [10, 15, 20, 25][index], distance: index >= 2 ? 10 : 5, activationBonus: index >= 2 ? 3 : 2 },
    activation: {
      type: trigger ? "reaction" : "action",
      actions: trigger ? 0 : 1,
      traits: [...new Set(["concentrate", ...extraTraits])],
      frequency: { max: 1, period },
      trigger,
      effectText
    }
  }));
}

export function registerCoreApexProfiles(registry = new ApexProfileRegistry()) {
  const shared = {
    basis: "published-analogs",
    reviewed: true,
    analogs: ["amulet-of-the-third-eye", "avalanche-boots", "artificer-spectacles", "pilferers-gloves", "troubadours-cap", "mantle-of-amazing-health", "dragon-handwraps"],
    notes: "Generated apex profiles use the published level 17-20 price bands, native PF2e apex attribute field, and deliberately conservative rules-text secondary benefits."
  };
  const specs = [
    ["core.apex-might", "str", "PF2E_ITEM_FORGE.ApexProfiles.Might", "PF2E_ITEM_FORGE.ApexText.MightName", "PF2E_ITEM_FORGE.ApexText.MightDescription", "PF2E_ITEM_FORGE.ApexText.MightPassive", "PF2E_ITEM_FORGE.ApexText.MightActivation", "PF2E_ITEM_FORGE.ApexText.MightTrigger"],
    ["core.apex-grace", "dex", "PF2E_ITEM_FORGE.ApexProfiles.Grace", "PF2E_ITEM_FORGE.ApexText.GraceName", "PF2E_ITEM_FORGE.ApexText.GraceDescription", "PF2E_ITEM_FORGE.ApexText.GracePassive", "PF2E_ITEM_FORGE.ApexText.GraceActivation", "PF2E_ITEM_FORGE.ApexText.GraceTrigger", ["fortune"]],
    ["core.apex-vitality", "con", "PF2E_ITEM_FORGE.ApexProfiles.Vitality", "PF2E_ITEM_FORGE.ApexText.VitalityName", "PF2E_ITEM_FORGE.ApexText.VitalityDescription", "PF2E_ITEM_FORGE.ApexText.VitalityPassive", "PF2E_ITEM_FORGE.ApexText.VitalityActivation", "PF2E_ITEM_FORGE.ApexText.VitalityTrigger"],
    ["core.apex-intellect", "int", "PF2E_ITEM_FORGE.ApexProfiles.Intellect", "PF2E_ITEM_FORGE.ApexText.IntellectName", "PF2E_ITEM_FORGE.ApexText.IntellectDescription", "PF2E_ITEM_FORGE.ApexText.IntellectPassive", "PF2E_ITEM_FORGE.ApexText.IntellectActivation", null],
    ["core.apex-insight", "wis", "PF2E_ITEM_FORGE.ApexProfiles.Insight", "PF2E_ITEM_FORGE.ApexText.InsightName", "PF2E_ITEM_FORGE.ApexText.InsightDescription", "PF2E_ITEM_FORGE.ApexText.InsightPassive", "PF2E_ITEM_FORGE.ApexText.InsightActivation", null],
    ["core.apex-presence", "cha", "PF2E_ITEM_FORGE.ApexProfiles.Presence", "PF2E_ITEM_FORGE.ApexText.PresenceName", "PF2E_ITEM_FORGE.ApexText.PresenceDescription", "PF2E_ITEM_FORGE.ApexText.PresencePassive", "PF2E_ITEM_FORGE.ApexText.PresenceActivation", null]
  ];
  for (const [id, attribute, label, nameTemplate, description, passiveText, effectText, trigger, activationTraits = []] of specs) {
    registry.register({ id, attribute, label, nameTemplate, description, passiveText, balance: shared, variants: rows(effectText, trigger, activationTraits) });
  }
  return registry;
}
