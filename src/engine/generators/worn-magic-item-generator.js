import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { hasMagicMarkerTraits, parseWornUsage, wornSlotLabelKey } from "../worn-item-utils.js";

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

function categorySlot(category) {
  if (!String(category ?? "").startsWith("magic.worn.")) return null;
  return String(category).slice("magic.worn.".length) || null;
}

/**
 * Selects published PF2e worn magic items or builds an Item Forge-owned worn
 * item from a validated profile. Published items are copied whole to preserve
 * native Rule Elements and activations. Generated items deliberately use rules
 * text plus structured metadata until an exact PF2e automation builder exists.
 */
export class WornMagicItemGenerator {
  constructor({
    compendiumIndex,
    wornMagicProfiles,
    templateResolver,
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "worn-magic-item";
    this.mode = "magic";
    this.priority = 217;
    this.index = compendiumIndex;
    this.profiles = wornMagicProfiles;
    this.templateResolver = templateResolver;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && (request.category === "magic.worn" || String(request.category).startsWith("magic.worn."));
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.wornMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.worn"));
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined worn magic item matches the request");
      error.code = "NO_PREDEFINED_WORN_ITEM_CANDIDATE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined worn magic item ${selected.uuid}`);
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
      wornItem: { mode: "existing", slot: selected.wornSlot, usage: selected.usage }
    };

    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: { kind: "worn-existing", sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level, slot: selected.wornSlot } },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.pack,
        sourceUuid: selected.uuid,
        level: selected.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "native" },
        magic: { kind: "worn", wornMode: "existing", slot: selected.wornSlot },
        wornItem: {
          mode: "existing",
          slot: selected.wornSlot,
          slotLabel: wornSlotLabelKey(selected.wornSlot),
          usage: selected.usage,
          invested: selected.traits?.includes?.("invested") ?? false,
          automation: "native"
        }
      }
    };
  }

  async #generateCustom(request) {
    const requestedProfile = request.magic?.wornProfile ?? "automatic";
    let profiles = requestedProfile === "automatic" ? this.profiles.getAll() : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && !profiles.length) {
      const error = new Error(`Unknown worn magic profile ${requestedProfile}`);
      error.code = "UNKNOWN_WORN_ITEM_PROFILE";
      throw error;
    }

    const requestedSlot = categorySlot(request.category);
    if (requestedSlot) profiles = profiles.filter((profile) => profile.slot === requestedSlot);

    const structural = [];
    for (const profile of profiles) {
      for (const variant of profile.variants) {
        if (request.rarity.length && !request.rarity.includes(profile.rarity)) continue;
        structural.push({ profile, variant });
      }
    }

    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) {
      const error = new Error("No generated worn magic item profile matches the request");
      error.code = "NO_WORN_ITEM_PROFILE_CANDIDATE";
      error.details = { category: request.category, level: request.level, profile: requestedProfile };
      throw error;
    }

    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const templateEntry = this.templateResolver?.resolveWornTemplateEntry?.(selected.profile.slot, { allowedTypes: ["equipment"] }) ?? null;
    if (!templateEntry) {
      const error = new Error(`No PF2e worn-item implementation template is available for slot ${selected.profile.slot}`);
      error.code = "NO_WORN_ITEM_TEMPLATE";
      error.details = { slot: selected.profile.slot };
      throw error;
    }
    const document = await this.index.getDocument(templateEntry);
    if (!document) {
      const error = new Error(`Could not load worn-item template ${templateEntry.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    if (itemSource.type !== "equipment") {
      const error = new Error(`Worn-item implementation template ${templateEntry.uuid} has unsafe document type ${itemSource.type}`);
      error.code = "INVALID_WORN_ITEM_TEMPLATE_TYPE";
      error.details = { slot: selected.profile.slot, type: itemSource.type, uuid: templateEntry.uuid };
      throw error;
    }
    const parsedUsage = parseWornUsage(itemSource.system?.usage?.value);
    if (!parsedUsage.worn || parsedUsage.slot !== selected.profile.slot) {
      const error = new Error(`Worn-item implementation template ${templateEntry.uuid} usage does not match slot ${selected.profile.slot}`);
      error.code = "WORN_ITEM_TEMPLATE_USAGE_MISMATCH";
      error.details = { slot: selected.profile.slot, usage: itemSource.system?.usage?.value ?? null, uuid: templateEntry.uuid };
      throw error;
    }
    const rendered = this.#composeCustomItem(itemSource, selected, request);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);

    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: {
        kind: "worn-generated",
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        slot: selected.profile.slot,
        usage: rendered.usage,
        effect: rendered.effect,
        template: { uuid: templateEntry.uuid, name: templateEntry.name }
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: null,
        sourceUuid: null,
        contentSources: [],
        templateSource: this.templateResolver?.templateMetadata?.(templateEntry, { kind: "worn" }) ?? null,
        level: selected.variant.level,
        rarity: selected.profile.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: { kind: "worn", wornMode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel, slot: selected.profile.slot },
        wornItem: {
          mode: "generated",
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          slot: selected.profile.slot,
          slotLabel: wornSlotLabelKey(selected.profile.slot),
          usage: rendered.usage,
          effect: rendered.effect,
          priceGp: selected.variant.price,
          invested: selected.profile.invested,
          automation: selected.profile.automation,
          balance: clone(selected.profile.balance)
        }
      }
    };
  }

  #renderData(selected) {
    return Object.fromEntries(Object.entries(selected.variant.values ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)]));
  }

  #composeCustomItem(itemSource, selected, request) {
    const { profile, variant } = selected;
    const data = this.#renderData(selected);
    const effect = localize(this.formatter, profile.effectText, data, profile.effectText ?? "");
    const usage = itemSource.system?.usage?.value ?? null;

    itemSource.name = localize(this.formatter, profile.nameTemplate, data, profile.id);
    itemSource.img = "systems/pf2e/icons/default-icons/equipment.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    const traits = new Set(profile.traits ?? []);
    if (profile.invested) traits.add("invested");
    if (!hasMagicMarkerTraits([...traits])) traits.add("magical");
    itemSource.system.traits.value = [...traits].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = profile.rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = profile.rarity;
    itemSource.system.rules = [];
    if (Object.hasOwn(itemSource.system, "slug")) itemSource.system.slug = null;
    if (Object.hasOwn(itemSource.system, "apex")) delete itemSource.system.apex;
    if (Object.hasOwn(itemSource.system, "publication")) delete itemSource.system.publication;
    if (Object.hasOwn(itemSource.system, "subitems")) itemSource.system.subitems = [];

    const description = localize(this.formatter, profile.description, data, "");
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.WornText.SpecialAbility", {}, "Effect:")}</strong> ${effect}</p>`,
      `<p><em>${localize(this.formatter, profile.invested ? "PF2E_ITEM_FORGE.WornText.InvestmentNote" : "PF2E_ITEM_FORGE.WornText.NonInvestmentNote", {}, profile.invested
        ? "This generated item has the invested trait and uses the listed worn usage. Its custom ability is rules text plus Item Forge metadata."
        : "This generated item uses the listed worn usage without requiring investment. Its custom ability is rules text plus Item Forge metadata.")}</em></p>`
    ].filter(Boolean).join("\n");

    itemSource.flags = {};
    itemSource.flags["pf2e-item-forge"] = {
      generated: true,
      generator: this.id,
      seed: request.seed,
      wornItem: {
        mode: "generated",
        profile: profile.id,
        variant: variant.id,
        slot: profile.slot,
        usage,
        invested: profile.invested,
        effect,
        automation: profile.automation,
        balance: clone(profile.balance)
      }
    };

    return { effect, usage };
  }
}
