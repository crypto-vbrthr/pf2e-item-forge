import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { getMagicTheme } from "../magic-themes.js";
import { RARITY_ORDER } from "../registries/property-rune-registry.js";

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

function themeName(themeId, formatter) {
  if (!themeId) return "";
  const theme = getMagicTheme(themeId);
  if (!theme?.label) return themeId;
  return localize(formatter, theme.label, {}, themeId);
}

function hasShieldRunes(entry) {
  return (Number(entry?.runes?.reinforcing) || 0) > 0;
}

function isMundaneShield(entry) {
  return entry?.type === "shield" && !entry?.traits?.includes?.("magical") && !hasShieldRunes(entry);
}

function rarityMax(...values) {
  return values.filter(Boolean).reduce((current, rarity) =>
    (RARITY_ORDER[rarity] ?? 0) > (RARITY_ORDER[current] ?? 0) ? rarity : current,
  "common");
}

function compatibilityMatches(entry, profile) {
  const traits = new Set(entry.traits ?? []);
  const rules = profile.compatibility ?? {};
  if (rules.baseItems?.length && !rules.baseItems.includes(entry.baseItem) && !rules.baseItems.includes(entry.slug)) return false;
  if (rules.requiredTraits?.some((trait) => !traits.has(trait))) return false;
  if (rules.forbiddenTraits?.some((trait) => traits.has(trait))) return false;
  return true;
}

function setNumeric(system, key, value) {
  const current = system?.[key];
  if (current && typeof current === "object" && !Array.isArray(current) && Object.hasOwn(current, "value")) current.value = value;
  else system[key] = value;
}

function applyDurability(system, durability) {
  setNumeric(system, "hardness", durability.hardness);
  if (system.hp && typeof system.hp === "object" && !Array.isArray(system.hp)) {
    system.hp.value = durability.hp;
    system.hp.max = durability.hp;
    if (Object.hasOwn(system.hp, "brokenThreshold")) system.hp.brokenThreshold = durability.bt;
  } else {
    system.hp = { value: durability.hp, max: durability.hp };
  }
  if (Object.hasOwn(system, "brokenThreshold")) setNumeric(system, "brokenThreshold", durability.bt);
}

/** Generates or copies specific magic shields. */
export class SpecificMagicShieldGenerator {
  constructor({
    compendiumIndex,
    specificShieldProfiles,
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "specific-magic-shield";
    this.mode = "magic";
    this.priority = 219;
    this.index = compendiumIndex;
    this.profiles = specificShieldProfiles;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.shield";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.specificMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.type === "shield" && entry.categories?.includes?.("magic.shield"));
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined specific magic shield matches the request");
      error.code = "NO_PREDEFINED_SPECIFIC_SHIELD_CANDIDATE";
      error.details = { level: request.level, source: request.source };
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined specific shield ${selected.uuid}`);
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
      specificShield: { mode: "existing" }
    };
    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: { kind: "specific-shield-existing", sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level } },
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
        magic: { kind: "specific-shield", specificMode: "existing" },
        specificItem: {
          mode: "existing",
          itemType: "shield",
          automation: "native",
          durability: { hardness: selected.hardness, hp: selected.hp, bt: selected.brokenThreshold },
          runes: { reinforcing: Number(selected.runes?.reinforcing) || 0, property: [] },
          propertyRunes: []
        }
      }
    };
  }

  async #generateCustom(request) {
    const requestedProfile = request.magic?.specificProfile ?? "automatic";
    let profiles = requestedProfile === "automatic" ? this.profiles.getAll() : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && !profiles.length) {
      const error = new Error(`Unknown specific shield profile ${requestedProfile}`);
      error.code = "UNKNOWN_SPECIFIC_SHIELD_PROFILE";
      throw error;
    }

    const bases = this.index.query({ ...request, category: "shield", rarity: [] }).filter(isMundaneShield);
    if (!bases.length) {
      const error = new Error("No mundane shield base item is available");
      error.code = "NO_SPECIFIC_SHIELD_BASE_ITEM";
      error.details = { source: request.source };
      throw error;
    }

    const structural = [];
    for (const profile of profiles) {
      const themes = this.#themesFor(profile, request.magic?.theme ?? "automatic");
      for (const variant of profile.variants) {
        for (const themeId of themes) {
          for (const base of bases) {
            if (base.level > variant.level || !compatibilityMatches(base, profile)) continue;
            const rarity = rarityMax(base.rarity ?? "common", profile.rarity ?? "common");
            if (request.rarity.length && !request.rarity.includes(rarity)) continue;
            structural.push({ profile, variant, themeId, base, rarity });
          }
        }
      }
    }

    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) {
      const error = new Error("No generated specific magic shield matches the request");
      error.code = "NO_SPECIFIC_SHIELD_PROFILE_CANDIDATE";
      error.details = { level: request.level, profile: requestedProfile, theme: request.magic?.theme };
      throw error;
    }

    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected.base);
    if (!document) {
      const error = new Error(`Could not load selected shield base ${selected.base.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    this.#composeCustomItem(itemSource, selected, request);
    const effect = this.#renderEffect(selected);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    const runes = { reinforcing: selected.variant.reinforcing ?? 0, property: [] };

    return {
      request,
      itemSource,
      warnings: selection.warnings,
      plan: {
        kind: "specific-shield-generated",
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        theme: selected.themeId,
        durability: { ...selected.variant.durability },
        reinforcing: selected.variant.reinforcing ?? 0,
        effect,
        automation: selected.profile.automation
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.base.pack,
        sourceUuid: selected.base.uuid,
        baseLevel: selected.base.level,
        level: selected.variant.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: {
          kind: "specific-shield",
          specificMode: "generated",
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          theme: selected.themeId
        },
        specificItem: {
          mode: "generated",
          itemType: "shield",
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          theme: selected.themeId,
          effect,
          automation: selected.profile.automation,
          baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
          durability: { ...selected.variant.durability },
          runes,
          propertyRunes: [],
          priceGp: selected.variant.price
        }
      }
    };
  }

  #themesFor(profile, requestedTheme) {
    if (!profile.allowedThemes?.length) return requestedTheme === "automatic" ? [null] : [];
    if (requestedTheme === "automatic") return [...profile.allowedThemes];
    return profile.allowedThemes.includes(requestedTheme) ? [requestedTheme] : [];
  }

  #renderData(selected) {
    return {
      base: selected.base.name,
      theme: themeName(selected.themeId, this.formatter),
      ...Object.fromEntries(Object.entries(selected.variant.values ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)])),
      ...Object.fromEntries(Object.entries(selected.profile.valuesByTheme?.[selected.themeId] ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)]))
    };
  }

  #renderEffect(selected) {
    return localize(this.formatter, selected.profile.effectText, this.#renderData(selected), selected.profile.effectText ?? "");
  }

  #composeCustomItem(itemSource, selected, request) {
    const { profile, variant, themeId, rarity } = selected;
    const data = this.#renderData(selected);
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];
    itemSource.system.traits.value = [...new Set([...itemSource.system.traits.value, "magical", ...(themeId ? profile.itemTraitsByTheme?.[themeId] ?? [] : [])])].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;
    itemSource.system.runes ??= {};
    itemSource.system.runes.reinforcing = variant.reinforcing ?? 0;
    applyDurability(itemSource.system, variant.durability);

    itemSource.name = localize(this.formatter, profile.nameTemplate, data, `${selected.base.name} (${profile.id})`);
    const description = localize(this.formatter, profile.description, data, "");
    const effect = this.#renderEffect(selected);
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.SpecificItemText.SpecialAbility", {}, "Special Ability")}</strong> ${effect}</p>`,
      `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.SpecificShieldText.DurabilityNote", {}, "Its listed Hardness, Hit Points, and Broken Threshold are part of this specific shield profile.")}</em></p>`
    ].filter(Boolean).join("\n");

    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: true,
      generator: this.id,
      seed: request.seed,
      specificShield: {
        mode: "generated",
        profile: profile.id,
        variant: variant.id,
        theme: themeId,
        baseItem: { uuid: selected.base.uuid, name: selected.base.name },
        durability: { ...variant.durability },
        reinforcing: variant.reinforcing ?? 0,
        effect,
        automation: profile.automation,
        balance: clone(profile.balance)
      }
    };
  }
}
