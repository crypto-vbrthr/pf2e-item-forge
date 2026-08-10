import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { APEX_ATTRIBUTE_LABEL_KEYS, APEX_ATTRIBUTES } from "../apex-item-utils.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}
function localize(formatter, key, data = {}, fallback = "") {
  if (!key) return fallback;
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback || key;
}
function frequencyLabel(formatter, frequency) {
  if (!frequency) return "";
  const count = Number(frequency.max);
  const oneKey = { day: "PF2E_ITEM_FORGE.HeldText.OncePerDay", hour: "PF2E_ITEM_FORGE.HeldText.OncePerHour", "10-minutes": "PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes", minute: "PF2E_ITEM_FORGE.ApexText.OncePerMinute", round: "PF2E_ITEM_FORGE.ApexText.OncePerRound" }[frequency.period];
  const manyKey = { day: "PF2E_ITEM_FORGE.HeldText.TimesPerDay", hour: "PF2E_ITEM_FORGE.HeldText.TimesPerHour", "10-minutes": "PF2E_ITEM_FORGE.HeldText.TimesPerTenMinutes" }[frequency.period];
  const key = count === 1 ? oneKey : manyKey;
  return key ? localize(formatter, key, { count }, `${count}/${frequency.period}`) : `${count}/${frequency.period}`;
}
function activationTypeLabel(formatter, activation) {
  if (activation.type === "reaction") return localize(formatter, "PF2E_ITEM_FORGE.HeldText.Reaction", {}, "Reaction");
  if (activation.type === "free-action") return localize(formatter, "PF2E_ITEM_FORGE.HeldText.FreeAction", {}, "Free Action");
  if (activation.actions === 1) return localize(formatter, "PF2E_ITEM_FORGE.HeldText.OneAction", {}, "1 action");
  return localize(formatter, "PF2E_ITEM_FORGE.HeldText.MultipleActions", { count: activation.actions }, `${activation.actions} actions`);
}
function activationTraitLabel(formatter, trait) {
  const suffix = String(trait ?? "").split(/[-_\s]+/).filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join("");
  return localize(formatter, `PF2E_ITEM_FORGE.HeldActivationTraits.${suffix}`, {}, trait);
}
function setBulk(system, bulk) {
  if (system.bulk && typeof system.bulk === "object" && !Array.isArray(system.bulk)) system.bulk.value = bulk;
  else system.bulk = { value: bulk };
}
function normalizeMaterial(system) {
  if (Object.hasOwn(system, "material")) system.material = { type: null, grade: null };
}
function clearTemplateIdentity(system) {
  normalizeMaterial(system);
  if (Object.hasOwn(system, "baseItem")) system.baseItem = null;
  if (Object.hasOwn(system, "containerId")) system.containerId = null;
  if (Object.hasOwn(system, "quantity")) system.quantity = 1;
  if (Object.hasOwn(system, "slug")) system.slug = null;
  if (Object.hasOwn(system, "publication")) delete system.publication;
  if (Object.hasOwn(system, "subitems")) system.subitems = [];
}

export class ApexItemGenerator {
  constructor({ compendiumIndex, apexProfiles, templateResolver, formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key } = {}) {
    this.id = "apex-item";
    this.mode = "magic";
    this.priority = 212;
    this.index = compendiumIndex;
    this.profiles = apexProfiles;
    this.templateResolver = templateResolver;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.apex";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.apexMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    let pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.apex"));
    const requestedAttribute = request.magic?.apexAttribute;
    if (APEX_ATTRIBUTES.includes(requestedAttribute)) pool = pool.filter((entry) => entry.apexAttribute === requestedAttribute);
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined apex item matches the request");
      error.code = "NO_PREDEFINED_APEX_ITEM_CANDIDATE";
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) { const error = new Error(`Could not load apex item ${selected.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: { kind: "apex-existing", source: { uuid: selected.uuid, pack: selected.pack, name: selected.name }, attribute: selected.apexAttribute ?? null },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: selected.pack, sourceUuid: selected.uuid, contentSources: [selected.pack], templateSource: null,
        level: selected.level, rarity: selected.rarity, category: request.category, candidateCount: selection.candidates.length,
        automation: { level: "native" },
        magic: { kind: "apex", apexMode: "existing", attribute: selected.apexAttribute ?? null, attributeLabel: APEX_ATTRIBUTE_LABEL_KEYS[selected.apexAttribute] ?? null },
        apexItem: { mode: "existing", attribute: selected.apexAttribute ?? null, attributeLabel: APEX_ATTRIBUTE_LABEL_KEYS[selected.apexAttribute] ?? null, automation: "native", coreAutomation: "native", secondaryAutomation: "native" }
      }
    };
  }

  async #generateCustom(request) {
    const templateEntry = this.templateResolver?.resolveApexTemplateEntry?.({ allowedTypes: ["equipment"], sourcePolicy: "system-only" }) ?? null;
    if (!templateEntry) { const error = new Error("No PF2e system apex equipment template is available"); error.code = "NO_APEX_ITEM_TEMPLATE"; throw error; }

    let profiles = this.profiles?.getAll?.() ?? [];
    if (request.magic?.apexProfile && request.magic.apexProfile !== "automatic") {
      const profile = this.profiles?.get?.(request.magic.apexProfile);
      if (!profile) { const error = new Error(`Unknown apex profile ${request.magic.apexProfile}`); error.code = "UNKNOWN_APEX_PROFILE"; throw error; }
      profiles = [profile];
    }
    if (APEX_ATTRIBUTES.includes(request.magic?.apexAttribute)) profiles = profiles.filter((profile) => profile.attribute === request.magic.apexAttribute);

    const structural = [];
    for (const profile of profiles) for (const variant of profile.variants) {
      if (request.rarity.length && !request.rarity.includes(profile.rarity)) continue;
      structural.push({ profile, variant });
    }
    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) { const error = new Error("No generated apex profile matches the request"); error.code = "NO_APEX_PROFILE_CANDIDATE"; throw error; }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(templateEntry);
    if (!document) { const error = new Error(`Could not load apex template ${templateEntry.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    if (itemSource.type !== "equipment") { const error = new Error(`Unsafe apex template type ${itemSource.type}`); error.code = "INVALID_APEX_TEMPLATE_TYPE"; throw error; }

    const rendered = this.#compose(itemSource, selected, request);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    const attributeLabel = APEX_ATTRIBUTE_LABEL_KEYS[selected.profile.attribute] ?? selected.profile.attribute;
    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: {
        kind: "apex-generated",
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        attribute: selected.profile.attribute,
        passive: rendered.passive,
        activation: rendered.activation,
        template: { uuid: templateEntry.uuid, name: templateEntry.name }
      },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: null, sourceUuid: null, contentSources: [],
        templateSource: this.templateResolver?.templateMetadata?.(templateEntry, { kind: "apex" }) ?? null,
        level: selected.variant.level, rarity: selected.profile.rarity, category: request.category, candidateCount: selection.candidates.length,
        automation: { level: "rules-text", nativeParts: ["apex-attribute"] },
        magic: { kind: "apex", apexMode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel, attribute: selected.profile.attribute, attributeLabel },
        apexItem: {
          mode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel,
          attribute: selected.profile.attribute, attributeLabel, priceGp: selected.variant.price,
          passive: rendered.passive, activation: rendered.activation, activationSummary: rendered.activationSummary,
          automation: selected.profile.automation, coreAutomation: "native", secondaryAutomation: "rules-text", balance: clone(selected.profile.balance)
        }
      }
    };
  }

  #renderActivation(activation, data) {
    if (!activation) return { activation: null, summary: null, effect: null };
    const rendered = clone(activation);
    const frequency = frequencyLabel(this.formatter, rendered.frequency);
    const renderData = { ...data, frequency };
    const effect = localize(this.formatter, rendered.effectText, renderData, rendered.effectText);
    const triggerText = rendered.trigger ? localize(this.formatter, rendered.trigger, renderData, rendered.trigger) : null;
    const requirementsText = rendered.requirements ? localize(this.formatter, rendered.requirements, renderData, rendered.requirements) : null;
    const durationText = rendered.duration ? localize(this.formatter, rendered.duration, renderData, rendered.duration) : null;
    const traitLabels = (rendered.traits ?? []).map((trait) => activationTraitLabel(this.formatter, trait));
    const actionText = activationTypeLabel(this.formatter, rendered);
    const parts = [traitLabels.length ? `${actionText} (${traitLabels.join(", ")})` : actionText];
    if (frequency) parts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Frequency", { frequency }, `Frequency ${frequency}`));
    if (triggerText) parts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Trigger", { trigger: triggerText }, `Trigger ${triggerText}`));
    if (requirementsText) parts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Requirements", { requirements: requirementsText }, `Requirements ${requirementsText}`));
    if (durationText) parts.push(localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Duration", { duration: durationText }, `Duration ${durationText}`));
    rendered.effect = effect;
    rendered.frequencyLabel = frequency || null;
    rendered.triggerText = triggerText;
    rendered.requirementsText = requirementsText;
    rendered.durationText = durationText;
    rendered.summary = parts.join("; ");
    return { activation: rendered, summary: rendered.summary, effect };
  }

  #compose(itemSource, selected, request) {
    const { profile, variant } = selected;
    const data = { ...(variant.values ?? {}), attribute: localize(this.formatter, APEX_ATTRIBUTE_LABEL_KEYS[profile.attribute], {}, profile.attribute) };
    const passive = localize(this.formatter, profile.passiveText, data, profile.passiveText);
    const activationRendered = this.#renderActivation(variant.activation, data);
    itemSource.name = localize(this.formatter, profile.nameTemplate, data, profile.id);
    itemSource.img = "systems/pf2e/icons/default-icons/equipment.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level }; itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} }; itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value = [...new Set([...(profile.traits ?? []), "apex", "invested", "magical"])].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = profile.rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = profile.rarity;
    itemSource.system.usage ??= { value: "worn" }; itemSource.system.usage.value = "worn";
    setBulk(itemSource.system, "L");
    clearTemplateIdentity(itemSource.system);
    itemSource.system.rules = [];
    const existingApex = itemSource.system.apex && typeof itemSource.system.apex === "object" && !Array.isArray(itemSource.system.apex) ? itemSource.system.apex : {};
    itemSource.system.apex = { ...clone(existingApex), attribute: profile.attribute };
    const description = localize(this.formatter, profile.description, data, "");
    const apexRule = localize(this.formatter, "PF2E_ITEM_FORGE.ApexText.CoreRule", data, `This apex item improves ${data.attribute}.`);
    const activationText = activationRendered.activation
      ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.Activation", {}, "Activate:")}</strong> ${activationRendered.summary}</p><p>${activationRendered.effect}</p>`
      : "";
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.ApexText.ApexBenefit", {}, "Apex:")}</strong> ${apexRule}</p>`,
      `<p>${passive}</p>`,
      activationText,
      `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.ApexText.AutomationNote", {}, "The apex attribute benefit uses PF2e native data; secondary abilities use rules text plus Item Forge metadata.")}</em></p>`
    ].filter(Boolean).join("\n");
    itemSource.flags = {
      "pf2e-item-forge": {
        generated: true, generator: this.id, seed: request.seed,
        apexItem: { mode: "generated", profile: profile.id, variant: variant.id, attribute: profile.attribute, passive, activation: activationRendered.activation, coreAutomation: "native", secondaryAutomation: "rules-text", balance: clone(profile.balance) }
      }
    };
    return { passive, activation: activationRendered.activation, activationSummary: activationRendered.summary };
  }
}
