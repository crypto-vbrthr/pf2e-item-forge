import { validateGeneratedProfileAutomation } from "../generation-contract.js";
import { normalizeBalanceMetadata } from "./profile-balance.js";

const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);
const VALID_ACTIVATION_TYPES = new Set(["action", "reaction", "free-action"]);

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim().toLowerCase()))];
}

function normalizeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePhysical(value = {}, { profileId }) {
  const bulk = String(value.bulk ?? "L").trim();
  if (!/^(?:L|\d+)$/.test(bulk)) throw new Error(`Grimoire profile ${profileId} has invalid bulk ${bulk}`);
  return { bulk };
}

function normalizeFrequency(value, { profileId, variantId }) {
  if (!value) return null;
  const max = Number(value.max ?? 1);
  const period = String(value.period ?? "").trim();
  if (!Number.isInteger(max) || max < 1 || !period) throw new Error(`Grimoire profile ${profileId}/${variantId} has invalid activation frequency`);
  return { max, period };
}

function normalizeSpellFilter(value, { profileId, variantId }) {
  const raw = value ?? {};
  if (raw && typeof raw !== "object") throw new TypeError(`Grimoire profile ${profileId}/${variantId} spellFilter must be an object`);
  return {
    preparedFromGrimoire: raw.preparedFromGrimoire !== false,
    slotsOnly: raw.slotsOnly !== false,
    nextActionCast: raw.nextActionCast === true,
    traitsAny: uniqueStrings(raw.traitsAny),
    traitsAll: uniqueStrings(raw.traitsAll),
    requiresDamage: raw.requiresDamage === true,
    requiresHealing: raw.requiresHealing === true,
    requiresSummon: raw.requiresSummon === true,
    requiresSpellAttack: raw.requiresSpellAttack === true
  };
}

function normalizeActivation(value, { profileId, variantId, fallbackEffectText }) {
  if (!value) return null;
  const type = String(value.type ?? "action").trim().toLowerCase();
  if (!VALID_ACTIVATION_TYPES.has(type)) throw new Error(`Grimoire profile ${profileId}/${variantId} has invalid activation type ${type}`);
  const declaredActions = value.actions == null ? null : Number(value.actions);
  let actions = 0;
  if (type === "action") {
    actions = declaredActions ?? 1;
    if (!Number.isInteger(actions) || actions < 1 || actions > 3) throw new Error(`Grimoire profile ${profileId}/${variantId} has invalid activation actions`);
  } else if (declaredActions != null && declaredActions !== 0) {
    throw new Error(`Grimoire profile ${profileId}/${variantId} ${type} must not declare action count`);
  }

  const effectText = normalizeText(value.effectText) ?? fallbackEffectText;
  if (!effectText) throw new Error(`Grimoire profile ${profileId}/${variantId} activation requires effectText`);
  return {
    type,
    actions,
    traits: uniqueStrings(value.traits),
    frequency: normalizeFrequency(value.frequency, { profileId, variantId }),
    trigger: normalizeText(value.trigger),
    requirements: normalizeText(value.requirements),
    duration: normalizeText(value.duration),
    spellFilter: normalizeSpellFilter(value.spellFilter, { profileId, variantId }),
    effectText
  };
}

export class GrimoireProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Grimoire profile requires id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate grimoire profile: ${id}`);

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
    if (!variants.length) throw new Error(`Grimoire profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    const ids = new Set();
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Grimoire profile ${id} has an empty variant id`);
      if (ids.has(variant.id)) throw new Error(`Grimoire profile ${id} has duplicate variant id ${variant.id}`);
      ids.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 1 || variant.level > 20) throw new Error(`Invalid grimoire level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Grimoire profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid grimoire price in ${id}`);
      lastLevel = variant.level;
    }

    const rarity = String(definition.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Grimoire profile ${id} has invalid rarity ${rarity}`);

    const profile = {
      id,
      label: definition.label ?? id,
      nameTemplate: normalizeText(definition.nameTemplate),
      description: normalizeText(definition.description),
      effectText,
      traits: uniqueStrings(definition.traits),
      physical: normalizePhysical(definition.physical, { profileId: id }),
      rarity,
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Grimoire profile", id }),
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      variants
    };
    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) { return this.#profiles.get(id) ?? null; }
  getAll() { return [...this.#profiles.values()]; }
  has(id) { return this.#profiles.has(id); }
}

function activation({ type = "free-action", actions = 0, traits = ["concentrate"], max = 1, period = "day", trigger = null, requirements = null, duration = null, spellFilter = {}, effectText }) {
  return { type, actions, traits, frequency: { max, period }, trigger, requirements, duration, spellFilter, effectText };
}

function row(id, label, level, price, values, activationData) {
  return { id, label, level, price, values, activation: activation(activationData) };
}

export function registerCoreGrimoireProfiles(registry = new GrimoireProfileRegistry()) {
  const shared = {
    basis: "published-analogs",
    reviewed: true,
    analogs: [
      "draxies-recipe-book",
      "corrosive-engravings",
      "tome-of-restorative-cleansing",
      "illuminated-folio",
      "book-of-warding-prayers",
      "spell-duelists-siphon",
      "codex-of-destruction-and-renewal"
    ],
    notes: "Homebrew grimoire profiles benchmarked against Treasure Vault grimoires, their level/price bands, spellshape cadence, triggers, and once-per-day style activations."
  };
  const labels = {
    base: "PF2E_ITEM_FORGE.SpecificItemVariants.Base",
    greater: "PF2E_ITEM_FORGE.SpecificItemVariants.Greater",
    major: "PF2E_ITEM_FORGE.SpecificItemVariants.Major",
    supreme: "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme"
  };

  registry.register({
    id: "core.elemental-concordance",
    label: "PF2E_ITEM_FORGE.GrimoireProfiles.ElementalConcordance",
    nameTemplate: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceName",
    description: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceDescription",
    effectText: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect",
    traits: [], physical: { bulk: "L" }, balance: shared,
    variants: [
      row("base", labels.base, 4, 90, { resistance: 2 }, { traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, traitsAny: ["acid", "cold", "electricity", "fire", "sonic"], requiresDamage: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect" }),
      row("greater", labels.greater, 9, 650, { resistance: 5 }, { traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, traitsAny: ["acid", "cold", "electricity", "fire", "sonic"], requiresDamage: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect" }),
      row("major", labels.major, 14, 4000, { resistance: 7 }, { traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, traitsAny: ["acid", "cold", "electricity", "fire", "sonic"], requiresDamage: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect" }),
      row("supreme", labels.supreme, 19, 40000, { resistance: 10 }, { traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, traitsAny: ["acid", "cold", "electricity", "fire", "sonic"], requiresDamage: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect" })
    ]
  });

  registry.register({
    id: "core.restorative-ledger",
    label: "PF2E_ITEM_FORGE.GrimoireProfiles.RestorativeLedger",
    nameTemplate: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerName",
    description: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerDescription",
    effectText: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerEffect",
    traits: ["healing"], physical: { bulk: "L" }, balance: shared,
    variants: [
      row("base", labels.base, 5, 140, { temp: 4 }, { traits: ["concentrate", "healing"], requirements: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerRequirement", duration: "PF2E_ITEM_FORGE.GrimoireText.OneHour", spellFilter: { requiresHealing: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerEffect" }),
      row("greater", labels.greater, 10, 900, { temp: 8 }, { traits: ["concentrate", "healing"], requirements: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerRequirement", duration: "PF2E_ITEM_FORGE.GrimoireText.OneHour", spellFilter: { requiresHealing: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerEffect" }),
      row("major", labels.major, 15, 6000, { temp: 12 }, { traits: ["concentrate", "healing"], requirements: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerRequirement", duration: "PF2E_ITEM_FORGE.GrimoireText.OneHour", spellFilter: { requiresHealing: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerEffect" }),
      row("supreme", labels.supreme, 20, 70000, { temp: 16 }, { traits: ["concentrate", "healing"], requirements: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerRequirement", duration: "PF2E_ITEM_FORGE.GrimoireText.OneHour", spellFilter: { requiresHealing: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.RestorativeLedgerEffect" })
    ]
  });

  registry.register({
    id: "core.summoners-field-notes",
    label: "PF2E_ITEM_FORGE.GrimoireProfiles.SummonersFieldNotes",
    nameTemplate: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesName",
    description: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesDescription",
    effectText: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesEffect",
    traits: [], physical: { bulk: "L" }, balance: shared,
    variants: [
      row("base", labels.base, 6, 225, { temp: 5, speed: 5 }, { type: "action", actions: 1, traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, requiresSummon: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesEffect" }),
      row("greater", labels.greater, 11, 1250, { temp: 10, speed: 5 }, { type: "action", actions: 1, traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, requiresSummon: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesEffect" }),
      row("major", labels.major, 16, 9000, { temp: 15, speed: 10 }, { type: "action", actions: 1, traits: ["concentrate", "spellshape"], spellFilter: { nextActionCast: true, requiresSummon: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.SummonersFieldNotesEffect" })
    ]
  });

  registry.register({
    id: "core.aegis-commentary",
    label: "PF2E_ITEM_FORGE.GrimoireProfiles.AegisCommentary",
    nameTemplate: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryName",
    description: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryDescription",
    effectText: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryEffect",
    traits: [], physical: { bulk: "L" }, balance: shared,
    variants: [
      row("base", labels.base, 7, 330, { resistance: 5 }, { trigger: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryTrigger", duration: "PF2E_ITEM_FORGE.GrimoireText.UntilNextTurn", spellFilter: { traitsAny: ["acid", "cold", "electricity", "fire", "sonic", "spirit"] }, effectText: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryEffect" }),
      row("greater", labels.greater, 12, 1800, { resistance: 8 }, { trigger: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryTrigger", duration: "PF2E_ITEM_FORGE.GrimoireText.UntilNextTurn", spellFilter: { traitsAny: ["acid", "cold", "electricity", "fire", "sonic", "spirit"] }, effectText: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryEffect" }),
      row("major", labels.major, 17, 13000, { resistance: 12 }, { trigger: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryTrigger", duration: "PF2E_ITEM_FORGE.GrimoireText.UntilNextTurn", spellFilter: { traitsAny: ["acid", "cold", "electricity", "fire", "sonic", "spirit"] }, effectText: "PF2E_ITEM_FORGE.GrimoireText.AegisCommentaryEffect" })
    ]
  });

  registry.register({
    id: "core.corrective-formulae",
    label: "PF2E_ITEM_FORGE.GrimoireProfiles.CorrectiveFormulae",
    nameTemplate: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeName",
    description: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeDescription",
    effectText: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeEffect",
    traits: [], physical: { bulk: "L" }, balance: shared,
    variants: [
      row("base", labels.base, 8, 450, { bonus: 1 }, { type: "reaction", traits: ["concentrate"], trigger: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeTrigger", spellFilter: { requiresSpellAttack: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeEffect" }),
      row("greater", labels.greater, 13, 2700, { bonus: 1 }, { type: "reaction", traits: ["concentrate"], max: 2, period: "day", trigger: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeTrigger", spellFilter: { requiresSpellAttack: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeEffect" }),
      row("major", labels.major, 18, 19000, { bonus: 1 }, { type: "reaction", traits: ["concentrate"], max: 1, period: "hour", trigger: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeTrigger", spellFilter: { requiresSpellAttack: true }, effectText: "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeEffect" })
    ]
  });

  return registry;
}
