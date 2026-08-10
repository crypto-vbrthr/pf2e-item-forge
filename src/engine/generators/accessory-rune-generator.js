import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { addGpToPrice, isAccessoryRuneBaseCompatible, maxRarity } from "../accessory-rune-utils.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function localize(formatter, key, data = {}, fallback = "") {
  if (!key) return fallback;
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback || key;
}

function itemLevel(source) {
  return Number(source?.system?.level?.value ?? 0) || 0;
}

/** Compose a published Accessory Rune rules profile with one compatible base item. */
export class AccessoryRuneGenerator {
  constructor({ compendiumIndex, accessoryRunes, formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key } = {}) {
    this.id = "accessory-rune";
    this.mode = "magic";
    this.priority = 216;
    this.index = compendiumIndex;
    this.runes = accessoryRunes;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.accessory-rune";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    const requestedRune = request.magic?.accessoryRune ?? "automatic";
    const families = requestedRune === "automatic" ? this.runes.getAll() : [this.runes.get(requestedRune)].filter(Boolean);
    if (requestedRune !== "automatic" && !families.length) {
      const error = new Error(`Unknown accessory rune ${requestedRune}`);
      error.code = "UNKNOWN_ACCESSORY_RUNE";
      throw error;
    }

    // Source filters apply to the host item. Accessory-rune mechanics are the
    // module's rules library, sourced from Treasure Vault Remaster.
    const baseRequest = { ...request, category: "item", rarity: [] };
    const sourceEntries = this.index.query(baseRequest);
    const candidates = [];
    for (const family of families) {
      for (const variant of family.variants) {
        for (const base of sourceEntries) {
          if (!isAccessoryRuneBaseCompatible(base, family)) continue;
          const level = Math.max(Number(base.level) || 0, variant.level);
          const rarity = maxRarity(base.rarity, family.rarity);
          if (request.rarity.length && !request.rarity.includes(rarity)) continue;
          candidates.push({ family, variant, base, level, rarity });
        }
      }
    }

    const selection = candidateLevelResolver.resolve(candidates, request, { getLevel: (candidate) => candidate.level });
    if (!selection.candidates.length) {
      const error = new Error("No compatible Accessory Rune and base item match the request");
      error.code = "NO_ACCESSORY_RUNE_CANDIDATE";
      error.details = { rune: requestedRune, level: request.level, source: request.source };
      throw error;
    }

    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected.base);
    if (!document) {
      const error = new Error(`Could not load accessory-rune base item ${selected.base.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    this.#guardBase(itemSource, selected);
    const rendered = this.#applyRune(itemSource, selected, request);

    const familyLabel = localize(this.formatter, selected.family.label, {}, selected.family.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    const usageLabel = localize(this.formatter, selected.family.usageLabel, {}, selected.family.targetKind);

    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: {
        kind: "accessory-rune",
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, type: selected.base.type, level: selected.base.level },
        rune: { id: selected.family.id, label: selected.family.label, variant: selected.variant.id, level: selected.variant.level, priceGp: selected.variant.priceGp },
        effectiveLevel: selected.level
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.base.pack,
        sourceUuid: selected.base.uuid,
        contentSources: [selected.base.pack],
        templateSource: null,
        level: selected.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: { kind: "accessory-rune", accessoryRune: selected.family.id, accessoryRuneLabel: familyLabel, variant: selected.variant.id, variantLabel },
        accessoryRune: {
          family: selected.family.id,
          familyLabel,
          variant: selected.variant.id,
          variantLabel,
          runeLevel: selected.variant.level,
          runePriceGp: selected.variant.priceGp,
          targetKind: selected.family.targetKind,
          usageLabel,
          effect: rendered.effect,
          baseItem: { uuid: selected.base.uuid, name: selected.base.name, type: selected.base.type, level: selected.base.level, usage: selected.base.usage },
          effectiveLevel: selected.level,
          automation: "rules-text",
          source: selected.family.source
        }
      }
    };
  }

  #guardBase(itemSource, selected) {
    const traits = itemSource?.system?.traits?.value ?? [];
    if (traits.includes("invested")) {
      const error = new Error("An item with the invested trait cannot receive an Accessory Rune");
      error.code = "ACCESSORY_RUNE_BASE_INVESTED";
      throw error;
    }
    if (itemSource?.flags?.["pf2e-item-forge"]?.accessoryRune) {
      const error = new Error("An item cannot receive more than one Accessory Rune");
      error.code = "ACCESSORY_RUNE_ALREADY_PRESENT";
      throw error;
    }
    if (!isAccessoryRuneBaseCompatible({ ...selected.base, type: itemSource.type, traits, usage: itemSource.system?.usage?.value }, selected.family)) {
      const error = new Error("The loaded base item no longer matches this Accessory Rune's Usage");
      error.code = "ACCESSORY_RUNE_USAGE_MISMATCH";
      throw error;
    }
  }

  #applyRune(itemSource, selected, request) {
    const { family, variant, base, level, rarity } = selected;
    itemSource._id = null;
    itemSource.system ??= {};
    itemSource.system.level ??= { value: level };
    itemSource.system.level.value = level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = addGpToPrice(itemSource.system.price.value, variant.priceGp);
    itemSource.system.traits ??= { value: [] };
    const traits = new Set(itemSource.system.traits.value ?? []);
    traits.add("invested");
    traits.add("magical");
    itemSource.system.traits.value = [...traits].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;

    const familyLabel = localize(this.formatter, family.label, {}, family.id);
    const variantLabel = localize(this.formatter, variant.label, {}, variant.id);
    const effect = localize(this.formatter, variant.effectText, {}, variant.effectText ?? "");
    const originalName = itemSource.name ?? base.name;
    itemSource.name = localize(this.formatter, "PF2E_ITEM_FORGE.AccessoryRuneText.AppliedName", { baseName: originalName, runeName: familyLabel, variant: variantLabel }, `${originalName} (${familyLabel})`);
    itemSource.system.description ??= { value: "" };
    const originalDescription = itemSource.system.description.value ?? "";
    const ruleNote = localize(this.formatter, "PF2E_ITEM_FORGE.AccessoryRuneText.RuleNote", { baseLevel: itemLevel({ system: { level: { value: base.level } } }), runeLevel: variant.level, effectiveLevel: level }, "The item's level is the higher of the base item and rune levels; the rune does not scale the base item's other abilities.");
    itemSource.system.description.value = [
      originalDescription,
      `<hr><h3>${localize(this.formatter, "PF2E_ITEM_FORGE.AccessoryRuneText.Heading", { runeName: familyLabel }, `Accessory Rune: ${familyLabel}`)}</h3>`,
      `<p>${effect}</p>`,
      `<p><em>${ruleNote}</em></p>`
    ].filter(Boolean).join("\n");

    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: true,
      generator: this.id,
      seed: request.seed,
      accessoryRune: {
        family: family.id,
        variant: variant.id,
        runeLevel: variant.level,
        runePriceGp: variant.priceGp,
        targetKind: family.targetKind,
        baseItem: { uuid: base.uuid, name: base.name, level: base.level, type: base.type },
        effectiveLevel: level,
        automation: "rules-text",
        source: family.source
      }
    };
    return { effect };
  }
}
