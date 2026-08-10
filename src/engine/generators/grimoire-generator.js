import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { GENERATED_GRIMOIRE_TEMPLATE_TYPES, hasGrimoireMagicMarkerTraits, isGrimoireTraits } from "../grimoire-utils.js";

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

function frequencyLabel(formatter, frequency) {
  if (!frequency) return "";
  const count = Number(frequency.max);
  const oneKey = {
    day: "PF2E_ITEM_FORGE.GrimoireText.OncePerDay",
    hour: "PF2E_ITEM_FORGE.GrimoireText.OncePerHour",
    "10-minutes": "PF2E_ITEM_FORGE.GrimoireText.OncePerTenMinutes",
    week: "PF2E_ITEM_FORGE.GrimoireText.OncePerWeek"
  }[frequency.period];
  const manyKey = {
    day: "PF2E_ITEM_FORGE.GrimoireText.TimesPerDay",
    hour: "PF2E_ITEM_FORGE.GrimoireText.TimesPerHour",
    "10-minutes": "PF2E_ITEM_FORGE.GrimoireText.TimesPerTenMinutes",
    week: "PF2E_ITEM_FORGE.GrimoireText.TimesPerWeek"
  }[frequency.period];
  const key = count === 1 ? oneKey : manyKey;
  return key ? localize(formatter, key, { count }, `${count}/${frequency.period}`) : `${count}/${frequency.period}`;
}

function activationTypeLabel(formatter, activation) {
  if (activation.type === "reaction") return localize(formatter, "PF2E_ITEM_FORGE.GrimoireText.Reaction", {}, "Reaction");
  if (activation.type === "free-action") return localize(formatter, "PF2E_ITEM_FORGE.GrimoireText.FreeAction", {}, "Free Action");
  if (activation.actions === 1) return localize(formatter, "PF2E_ITEM_FORGE.GrimoireText.OneAction", {}, "1 action");
  return localize(formatter, "PF2E_ITEM_FORGE.GrimoireText.MultipleActions", { count: activation.actions }, `${activation.actions} actions`);
}

function activationTraitLabel(formatter, trait) {
  const suffix = String(trait ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return localize(formatter, `PF2E_ITEM_FORGE.GrimoireActivationTraits.${suffix}`, {}, trait);
}

function normalizeMaterial(system) {
  if (!Object.hasOwn(system, "material")) return;
  system.material = { type: null, grade: null };
}

function setBulk(system, bulk) {
  if (system.bulk && typeof system.bulk === "object" && !Array.isArray(system.bulk)) system.bulk.value = bulk;
  else system.bulk = { value: bulk };
}

function clearTemplateIdentity(system) {
  normalizeMaterial(system);
  if (Object.hasOwn(system, "baseItem")) system.baseItem = null;
  if (Object.hasOwn(system, "containerId")) system.containerId = null;
  if (Object.hasOwn(system, "quantity")) system.quantity = 1;
  if (Array.isArray(system.subitems)) system.subitems = [];
}

export class GrimoireGenerator {
  constructor({ compendiumIndex, grimoireProfiles, templateResolver, formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key } = {}) {
    this.id = "grimoire";
    this.mode = "magic";
    this.priority = 213;
    this.index = compendiumIndex;
    this.profiles = grimoireProfiles;
    this.templateResolver = templateResolver;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.grimoire";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.grimoireMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.grimoire"));
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined grimoire matches the request");
      error.code = "NO_PREDEFINED_GRIMOIRE_CANDIDATE";
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load grimoire ${selected.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: false,
      generator: this.id,
      seed: request.seed,
      sourceUuid: selected.uuid,
      grimoire: { mode: "existing" }
    };
    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: { kind: "grimoire-existing", sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level } },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.pack,
        sourceUuid: selected.uuid,
        contentSources: [selected.pack],
        templateSource: null,
        level: selected.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "native" },
        magic: { kind: "grimoire", grimoireMode: "existing" },
        grimoire: { mode: "existing", automation: "native", rules: this.#rulesContract() }
      }
    };
  }

  async #generateCustom(request) {
    const requestedProfile = request.magic?.grimoireProfile ?? "automatic";
    let profiles = requestedProfile === "automatic" ? this.profiles.getAll() : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && !profiles.length) {
      const error = new Error(`Unknown grimoire profile ${requestedProfile}`);
      error.code = "UNKNOWN_GRIMOIRE_PROFILE";
      throw error;
    }

    const templateEntry = this.templateResolver?.resolveGrimoireTemplateEntry?.({ allowedTypes: GENERATED_GRIMOIRE_TEMPLATE_TYPES, sourcePolicy: "system-only" }) ?? null;
    if (!templateEntry) {
      const error = new Error("No PF2e grimoire implementation template is available");
      error.code = "NO_GRIMOIRE_TEMPLATE";
      throw error;
    }

    const structural = [];
    for (const profile of profiles) for (const variant of profile.variants) {
      if (request.rarity.length && !request.rarity.includes(profile.rarity)) continue;
      structural.push({ profile, variant });
    }
    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) {
      const error = new Error("No generated grimoire profile matches the request");
      error.code = "NO_GRIMOIRE_PROFILE_CANDIDATE";
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(templateEntry);
    if (!document) {
      const error = new Error(`Could not load grimoire template ${templateEntry.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    if (!GENERATED_GRIMOIRE_TEMPLATE_TYPES.includes(itemSource.type)) {
      const error = new Error(`Unsafe grimoire template type ${itemSource.type}`);
      error.code = "INVALID_GRIMOIRE_TEMPLATE_TYPE";
      throw error;
    }
    const loadedTraits = itemSource.system?.traits?.value ?? [];
    if (!isGrimoireTraits(loadedTraits)) {
      const error = new Error("Grimoire template no longer has the grimoire trait");
      error.code = "GRIMOIRE_TEMPLATE_TRAIT_MISMATCH";
      throw error;
    }

    const rendered = this.#compose(itemSource, selected, request);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: {
        kind: "grimoire-generated",
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        effect: rendered.effect,
        activation: rendered.activation,
        physical: clone(selected.profile.physical),
        rules: this.#rulesContract(),
        template: { uuid: templateEntry.uuid, name: templateEntry.name, type: templateEntry.type }
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: null,
        sourceUuid: null,
        contentSources: [],
        templateSource: this.templateResolver?.templateMetadata?.(templateEntry, { kind: "grimoire" }) ?? null,
        level: selected.variant.level,
        rarity: selected.profile.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: { kind: "grimoire", grimoireMode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel },
        grimoire: {
          mode: "generated",
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          effect: rendered.effect,
          activation: rendered.activation,
          activationSummary: rendered.activationSummary,
          physical: clone(selected.profile.physical),
          priceGp: selected.variant.price,
          automation: selected.profile.automation,
          balance: clone(selected.profile.balance),
          rules: this.#rulesContract()
        }
      }
    };
  }

  #rulesContract() {
    return {
      dailyPreparationStudy: true,
      preparedSpells: true,
      spellSlotsOnly: true,
      excludesCantrips: true,
      excludesFocusSpells: true,
      excludesInnateSpells: true,
      oneGrimoirePerCasterPerDay: true,
      oneCasterPerGrimoirePerDay: true,
      possessionAfterPreparationRequired: false
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
    if (frequencyText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.Frequency", { frequency: frequencyText }, `Frequency ${frequencyText}`));
    if (triggerText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.Trigger", { trigger: triggerText }, `Trigger ${triggerText}`));
    if (requirementsText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.Requirements", { requirements: requirementsText }, `Requirements ${requirementsText}`));
    if (durationText) summaryParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.Duration", { duration: durationText }, `Duration ${durationText}`));
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
    const effect = activationRendered.effect || localize(this.formatter, profile.effectText, data, profile.effectText ?? "");
    itemSource.name = localize(this.formatter, profile.nameTemplate, data, profile.id);
    itemSource.img = "systems/pf2e/icons/default-icons/book.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    const traits = new Set(["grimoire", ...(profile.traits ?? [])]);
    if (!hasGrimoireMagicMarkerTraits([...traits])) traits.add("magical");
    itemSource.system.traits.value = [...traits].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = profile.rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = profile.rarity;
    setBulk(itemSource.system, profile.physical.bulk);
    clearTemplateIdentity(itemSource.system);
    itemSource.system.rules = [];
    if (Object.hasOwn(itemSource.system, "slug")) itemSource.system.slug = null;
    if (Object.hasOwn(itemSource.system, "apex")) delete itemSource.system.apex;
    if (Object.hasOwn(itemSource.system, "publication")) delete itemSource.system.publication;

    const description = localize(this.formatter, profile.description, data, "");
    const rulesText = localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.StandardRules", {}, "");
    const activationText = activationRendered.activation
      ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.Activation", {}, "Activate:")}</strong> ${activationRendered.summary}</p><p>${activationRendered.effect}</p>`
      : effect ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.SpecialAbility", {}, "Effect:")}</strong> ${effect}</p>` : "";
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      rulesText ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.GrimoireRules", {}, "Grimoire:")}</strong> ${rulesText}</p>` : "",
      activationText,
      `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.GrimoireText.AutomationNote", {}, "This generated grimoire uses rules text plus Item Forge metadata.")}</em></p>`
    ].filter(Boolean).join("\n");
    itemSource.flags = {
      "pf2e-item-forge": {
        generated: true,
        generator: this.id,
        seed: request.seed,
        grimoire: {
          mode: "generated",
          profile: profile.id,
          variant: variant.id,
          effect,
          activation: activationRendered.activation,
          physical: clone(profile.physical),
          automation: profile.automation,
          balance: clone(profile.balance),
          rules: this.#rulesContract()
        }
      }
    };
    return { effect, activation: activationRendered.activation, activationSummary: activationRendered.summary };
  }
}
