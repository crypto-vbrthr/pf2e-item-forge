import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { hasHeldMagicMarkerTraits, heldHandsLabelKey, parseHeldUsage } from "../held-item-utils.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}
function localize(formatter, key, data = {}, fallback = "") {
  if (!key) return fallback;
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback || key;
}
function resolveValue(value, formatter) {
  if (typeof value !== "string") return value;
  const localized = formatter?.(value, {});
  return localized && localized !== value ? localized : value;
}
function requestedHands(category) {
  if (category === "magic.held.one-hand") return 1;
  if (category === "magic.held.two-hands") return 2;
  return null;
}
function frequencyLabel(formatter, frequency) {
  if (!frequency) return "";
  const count = Number(frequency.max);
  const oneKey = {
    day: "PF2E_ITEM_FORGE.HeldText.OncePerDay",
    hour: "PF2E_ITEM_FORGE.HeldText.OncePerHour",
    "10-minutes": "PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"
  }[frequency.period];
  const manyKey = {
    day: "PF2E_ITEM_FORGE.HeldText.TimesPerDay",
    hour: "PF2E_ITEM_FORGE.HeldText.TimesPerHour",
    "10-minutes": "PF2E_ITEM_FORGE.HeldText.TimesPerTenMinutes"
  }[frequency.period];
  const key = count === 1 ? oneKey : manyKey;
  return key
    ? localize(formatter, key, { count }, `${count}/${frequency.period}`)
    : `${count}/${frequency.period}`;
}

function activationTypeLabel(formatter, activation) {
  if (activation.type === "reaction") return localize(formatter, "PF2E_ITEM_FORGE.HeldText.Reaction", {}, "Reaction");
  if (activation.type === "free-action") return localize(formatter, "PF2E_ITEM_FORGE.HeldText.FreeAction", {}, "Free Action");
  if (activation.actions === 1) return localize(formatter, "PF2E_ITEM_FORGE.HeldText.OneAction", {}, "1 action");
  return localize(formatter, "PF2E_ITEM_FORGE.HeldText.MultipleActions", { count: activation.actions }, `${activation.actions} actions`);
}

function activationTraitLabel(formatter, trait) {
  const suffix = String(trait ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return localize(formatter, `PF2E_ITEM_FORGE.HeldActivationTraits.${suffix}`, {}, trait);
}
function normalizeMaterial(system) {
  if (!Object.hasOwn(system, "material")) return;
  system.material = { type: null, grade: null };
}
function setBulk(system, bulk) {
  if (system.bulk && typeof system.bulk === "object" && !Array.isArray(system.bulk)) system.bulk.value = bulk;
  else system.bulk = { value: bulk };
}
function clearTemplatePhysicalIdentity(system) {
  normalizeMaterial(system);
  if (Object.hasOwn(system, "baseItem")) system.baseItem = null;
  if (Object.hasOwn(system, "containerId")) system.containerId = null;
  if (Object.hasOwn(system, "quantity")) system.quantity = 1;
}

export class HeldMagicItemGenerator {
  constructor({ compendiumIndex, heldMagicProfiles, templateResolver, formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key } = {}) {
    this.id = "held-magic-item";
    this.mode = "magic";
    this.priority = 214;
    this.index = compendiumIndex;
    this.profiles = heldMagicProfiles;
    this.templateResolver = templateResolver;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && ["magic.held", "magic.held.one-hand", "magic.held.two-hands"].includes(request.category);
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.heldMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.held"));
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined held magic item matches the request");
      error.code = "NO_PREDEFINED_HELD_ITEM_CANDIDATE";
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) { const error = new Error(`Could not load held magic item ${selected.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = { ...(itemSource.flags["pf2e-item-forge"] ?? {}), generated: false, generator: this.id, seed: request.seed, sourceUuid: selected.uuid, heldItem: { mode: "existing", hands: selected.heldHands, usage: selected.usage } };
    return {
      request, itemSource, warnings: selection.warnings,
      plan: { kind: "held-existing", sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level, hands: selected.heldHands } },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: selected.pack, sourceUuid: selected.uuid,
        contentSources: [selected.pack], templateSource: null, level: selected.level, rarity: selected.rarity, category: request.category,
        candidateCount: selection.candidates.length, automation: { level: "native" },
        magic: { kind: "held", heldMode: "existing", hands: selected.heldHands },
        heldItem: { mode: "existing", hands: selected.heldHands, handsLabel: heldHandsLabelKey(selected.heldHands), usage: selected.usage, invested: selected.traits?.includes?.("invested") ?? false, automation: "native" }
      }
    };
  }

  async #generateCustom(request) {
    const requestedProfile = request.magic?.heldProfile ?? "automatic";
    let profiles = requestedProfile === "automatic" ? this.profiles.getAll() : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && !profiles.length) { const error = new Error(`Unknown held magic profile ${requestedProfile}`); error.code = "UNKNOWN_HELD_ITEM_PROFILE"; throw error; }
    const hands = requestedHands(request.category);
    if (hands) profiles = profiles.filter((profile) => profile.hands === hands);

    const templateByHands = new Map();
    for (const profileHands of new Set(profiles.map((profile) => profile.hands))) {
      templateByHands.set(profileHands, this.templateResolver?.resolveHeldTemplateEntry?.(profileHands, { allowedTypes: ["equipment"], sourcePolicy: "system-only" }) ?? null);
    }
    const templateCapableProfiles = profiles.filter((profile) => templateByHands.get(profile.hands));
    if (profiles.length && !templateCapableProfiles.length) {
      const unavailableHands = [...new Set(profiles.map((profile) => profile.hands))].sort();
      const error = new Error(`No PF2e held-item implementation template is available for ${unavailableHands.join("/")} hand(s)`);
      error.code = "NO_HELD_ITEM_TEMPLATE";
      error.details = { hands: unavailableHands };
      throw error;
    }
    profiles = templateCapableProfiles;

    const structural = [];
    for (const profile of profiles) for (const variant of profile.variants) {
      if (request.rarity.length && !request.rarity.includes(profile.rarity)) continue;
      structural.push({ profile, variant });
    }
    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) { const error = new Error("No generated held magic item profile matches the request"); error.code = "NO_HELD_ITEM_PROFILE_CANDIDATE"; throw error; }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const templateEntry = templateByHands.get(selected.profile.hands) ?? null;
    if (!templateEntry) { const error = new Error(`No PF2e held-item implementation template is available for ${selected.profile.hands} hand(s)`); error.code = "NO_HELD_ITEM_TEMPLATE"; throw error; }
    const document = await this.index.getDocument(templateEntry);
    if (!document) { const error = new Error(`Could not load held-item template ${templateEntry.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    if (itemSource.type !== "equipment") { const error = new Error(`Unsafe held-item template type ${itemSource.type}`); error.code = "INVALID_HELD_ITEM_TEMPLATE_TYPE"; throw error; }
    const parsed = parseHeldUsage(itemSource.system?.usage?.value);
    if (!parsed.held || parsed.hands !== selected.profile.hands) { const error = new Error("Held-item template usage mismatch"); error.code = "HELD_ITEM_TEMPLATE_USAGE_MISMATCH"; throw error; }
    const rendered = this.#compose(itemSource, selected, request);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    return {
      request, itemSource, warnings: selection.warnings,
      plan: {
        kind: "held-generated",
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        hands: selected.profile.hands, usage: rendered.usage, effect: rendered.effect,
        passive: rendered.passive, activation: rendered.activation, physical: clone(selected.profile.physical),
        template: { uuid: templateEntry.uuid, name: templateEntry.name }
      },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: null, sourceUuid: null, contentSources: [],
        templateSource: this.templateResolver?.templateMetadata?.(templateEntry, { kind: "held" }) ?? null,
        level: selected.variant.level, rarity: selected.profile.rarity, category: request.category, candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: { kind: "held", heldMode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel, hands: selected.profile.hands },
        heldItem: {
          mode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel,
          hands: selected.profile.hands, handsLabel: heldHandsLabelKey(selected.profile.hands), usage: rendered.usage,
          effect: rendered.effect, passive: rendered.passive, activation: rendered.activation, activationSummary: rendered.activationSummary,
          physical: clone(selected.profile.physical), priceGp: selected.variant.price, invested: selected.profile.invested,
          automation: selected.profile.automation, balance: clone(selected.profile.balance)
        }
      }
    };
  }

  #renderActivation(profile, variant, data) {
    if (!variant.activation) return { activation: null, effect: localize(this.formatter, profile.effectText, data, profile.effectText ?? ""), summary: null };
    const activation = clone(variant.activation);
    const frequencyText = frequencyLabel(this.formatter, activation.frequency);
    const renderData = { ...data, frequency: frequencyText };
    const effect = localize(this.formatter, activation.effectText, renderData, activation.effectText ?? "");
    const triggerText = activation.trigger ? localize(this.formatter, activation.trigger, renderData, activation.trigger) : null;
    const requirementsText = activation.requirements ? localize(this.formatter, activation.requirements, renderData, activation.requirements) : null;
    const durationText = activation.duration ? localize(this.formatter, activation.duration, renderData, activation.duration) : null;
    const traitLabels = (activation.traits ?? []).map((trait) => activationTraitLabel(this.formatter, trait));
    const actionText = activationTypeLabel(this.formatter, activation);
    const actionPart = traitLabels.length ? `${actionText} (${traitLabels.join(", ")})` : actionText;
    const summaryParts = [actionPart];
    if (frequencyText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Frequency", { frequency: frequencyText }, `Frequency ${frequencyText}`));
    if (triggerText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Trigger", { trigger: triggerText }, `Trigger ${triggerText}`));
    if (requirementsText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Requirements", { requirements: requirementsText }, `Requirements ${requirementsText}`));
    if (durationText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Duration", { duration: durationText }, `Duration ${durationText}`));
    const summary = summaryParts.join("; ");

    activation.effect = effect;
    activation.actionLabel = actionText;
    activation.traitLabels = traitLabels;
    activation.frequencyLabel = frequencyText || null;
    activation.triggerText = triggerText;
    activation.requirementsText = requirementsText;
    activation.durationText = durationText;
    activation.summary = summary;
    return { activation, effect, summary };
  }

  #compose(itemSource, selected, request) {
    const { profile, variant } = selected;
    const data = Object.fromEntries(Object.entries(variant.values ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)]));
    const activationRendered = this.#renderActivation(profile, variant, data);
    const passive = profile.passive
      ? { ...clone(profile.passive), effect: localize(this.formatter, profile.passive.effectText, data, profile.passive.effectText) }
      : null;
    const effect = activationRendered.effect || passive?.effect || localize(this.formatter, profile.effectText, data, profile.effectText ?? "");
    const usage = itemSource.system?.usage?.value ?? null;
    itemSource.name = localize(this.formatter, profile.nameTemplate, data, profile.id);
    itemSource.img = "systems/pf2e/icons/default-icons/equipment.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level }; itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} }; itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    const traits = new Set(profile.traits ?? []); if (profile.invested) traits.add("invested"); if (!hasHeldMagicMarkerTraits([...traits])) traits.add("magical");
    itemSource.system.traits.value = [...traits].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = profile.rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = profile.rarity;
    setBulk(itemSource.system, profile.physical.bulk);
    clearTemplatePhysicalIdentity(itemSource.system);
    itemSource.system.rules = [];
    if (Object.hasOwn(itemSource.system, "slug")) itemSource.system.slug = null;
    if (Object.hasOwn(itemSource.system, "apex")) delete itemSource.system.apex;
    if (Object.hasOwn(itemSource.system, "publication")) delete itemSource.system.publication;
    if (Object.hasOwn(itemSource.system, "subitems")) itemSource.system.subitems = [];
    const description = localize(this.formatter, profile.description, data, "");
    const passiveText = passive?.effect ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Passive", {}, "Passive:")}</strong> ${passive.effect}</p>` : "";
    const activationText = activationRendered.activation
      ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Activation", {}, "Activate:")}</strong> ${activationRendered.summary}</p><p>${activationRendered.effect}</p>`
      : effect ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.SpecialAbility", {}, "Effect:")}</strong> ${effect}</p>` : "";
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      passiveText,
      activationText,
      `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.AutomationNote", {}, "This generated held item uses rules text plus Item Forge metadata.")}</em></p>`
    ].filter(Boolean).join("\n");
    itemSource.flags = {
      "pf2e-item-forge": {
        generated: true, generator: this.id, seed: request.seed,
        heldItem: {
          mode: "generated", profile: profile.id, variant: variant.id, hands: profile.hands, usage,
          invested: profile.invested, effect, passive, activation: activationRendered.activation,
          physical: clone(profile.physical), automation: profile.automation, balance: clone(profile.balance)
        }
      }
    };
    return { usage, effect, passive, activation: activationRendered.activation, activationSummary: activationRendered.summary };
  }
}
