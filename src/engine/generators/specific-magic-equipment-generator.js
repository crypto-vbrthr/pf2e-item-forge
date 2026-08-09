import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";
import {
  ARMOR_FUNDAMENTAL_PROFILES,
  WEAPON_FUNDAMENTAL_PROFILES,
  applyFundamentalProfile,
  propertyRuneCapacity
} from "../equipment-rune-profiles.js";
import { RARITY_ORDER } from "../registries/property-rune-registry.js";
import { getMagicTheme } from "../magic-themes.js";
import { isSpecificSystemValue, setSpecificSystemValue } from "../compendium-index.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

export function isSpecificItemEntry(entry) {
  return isSpecificSystemValue(entry?.specific);
}

function hasRunes(entry) {
  const runes = entry?.runes ?? {};
  if ((Number(runes.potency) || 0) > 0) return true;
  if ((Number(runes.striking) || 0) > 0) return true;
  if ((Number(runes.resilient) || 0) > 0) return true;
  if ((Number(runes.reinforcing) || 0) > 0) return true;
  return Array.isArray(runes.property) && runes.property.length > 0;
}

function isMundaneBase(entry, itemType) {
  if (entry?.type !== itemType) return false;
  if (isSpecificItemEntry(entry)) return false;
  if (entry.categories?.includes?.("magic.staff")) return false;
  return !hasRunes(entry);
}

function rarityMax(values) {
  return values.filter(Boolean).reduce((current, rarity) =>
    (RARITY_ORDER[rarity] ?? 0) > (RARITY_ORDER[current] ?? 0) ? rarity : current,
  "common");
}

function fundamentalById(itemType, id) {
  const list = itemType === "weapon" ? WEAPON_FUNDAMENTAL_PROFILES : ARMOR_FUNDAMENTAL_PROFILES;
  return list.find((profile) => profile.id === id) ?? null;
}

function themeName(themeId, formatter) {
  if (!themeId) return "";
  const theme = getMagicTheme(themeId);
  if (!theme?.label) return themeId;
  const value = formatter?.(theme.label, {});
  return value && value !== theme.label ? value : themeId;
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

function compatibilityMatches(entry, profile) {
  const rules = profile.compatibility ?? {};
  const traits = new Set(entry.traits ?? []);
  const isRanged = entry.range != null && entry.range !== "" && entry.range !== false;
  if (rules.meleeOnly && isRanged) return false;
  if (rules.rangedOnly && !isRanged) return false;
  if (rules.armorCategories?.length && !rules.armorCategories.includes(entry.armorCategory)) return false;
  if (rules.groups?.length && !rules.groups.includes(entry.group)) return false;
  if (rules.requiredTraits?.some((trait) => !traits.has(trait))) return false;
  if (rules.forbiddenTraits?.some((trait) => traits.has(trait))) return false;
  return true;
}

/**
 * Generates or copies PF2e specific magic weapons and armor.
 *
 * Published specific items are copied whole so their native PF2e automation is
 * preserved. Generated specific items intentionally keep their unique ability
 * as rules text plus structured Item Forge metadata. Their fundamental runes
 * remain ordinary PF2e runes, while property runes are exclusively those
 * declared by the selected profile, matching the specific-item restriction.
 */
export class SpecificMagicEquipmentGenerator {
  constructor({
    compendiumIndex,
    specificItemProfiles,
    propertyRunes,
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "specific-magic-equipment";
    this.mode = "magic";
    this.priority = 218;
    this.index = compendiumIndex;
    this.profiles = specificItemProfiles;
    this.propertyRunes = propertyRunes;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && ["magic.weapon", "magic.armor"].includes(request.category);
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.specificMode === "generated"
      ? this.#generateCustom(request)
      : this.#generateExisting(request);
  }

  #itemType(request) {
    return request.category === "magic.weapon" ? "weapon" : "armor";
  }

  async #generateExisting(request) {
    const itemType = this.#itemType(request);
    const pool = this.index.query(request)
      .filter((entry) => entry.type === itemType && isSpecificItemEntry(entry))
      .filter((entry) => !entry.categories?.includes?.("magic.staff"));
    let candidates = pool.filter((entry) => levelAllowed(entry.level, request));
    const warnings = [];

    if (candidates.length === 0 && request.levelPolicy === "nearest" && pool.length > 0) {
      const bestDistance = Math.min(...pool.map((entry) => distanceToLevelRequest(entry.level, request.level)));
      candidates = pool.filter((entry) => distanceToLevelRequest(entry.level, request.level) === bestDistance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((entry) => entry.level))]
      });
    }
    if (candidates.length === 0) {
      const error = new Error("No predefined specific magic item matches the request");
      error.code = "NO_PREDEFINED_SPECIFIC_ITEM_CANDIDATE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    if (request.level.target != null) {
      const bestDistance = Math.min(...candidates.map((entry) => Math.abs(entry.level - request.level.target)));
      candidates = candidates.filter((entry) => Math.abs(entry.level - request.level.target) === bestDistance);
    }

    const rng = new SeededRng(request.seed);
    const selected = rng.pick(candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined specific item ${selected.uuid}`);
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
      specificItem: { mode: "existing", itemType }
    };

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: `specific-${itemType}-existing`,
        sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level }
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.pack,
        sourceUuid: selected.uuid,
        level: selected.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: candidates.length,
        magic: { kind: `specific-${itemType}`, specificMode: "existing" },
        specificItem: { mode: "existing", itemType }
      }
    };
  }

  async #generateCustom(request) {
    const itemType = this.#itemType(request);
    const requestedProfile = request.magic?.specificProfile ?? "automatic";
    let profiles = requestedProfile === "automatic"
      ? this.profiles.getForItemType(itemType)
      : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && profiles.length === 0) {
      const error = new Error(`Unknown specific item profile ${requestedProfile}`);
      error.code = "UNKNOWN_SPECIFIC_ITEM_PROFILE";
      error.details = { specificProfile: requestedProfile };
      throw error;
    }
    profiles = profiles.filter((profile) => profile.itemType === itemType);
    if (!profiles.length) {
      const error = new Error(`No specific item profiles are registered for ${itemType}`);
      error.code = "NO_SPECIFIC_PROFILE_CANDIDATE";
      throw error;
    }

    const baseRequest = { ...request, category: itemType, rarity: [] };
    const bases = this.index.query(baseRequest).filter((entry) => isMundaneBase(entry, itemType));
    if (!bases.length) {
      const error = new Error(`No mundane ${itemType} base item is available`);
      error.code = "NO_SPECIFIC_BASE_ITEM";
      error.details = { itemType, source: request.source };
      throw error;
    }

    const structural = [];
    for (const profile of profiles) {
      const themes = this.#themesFor(profile, request.magic?.theme ?? "automatic");
      for (const variant of profile.variants) {
        const fundamental = fundamentalById(itemType, variant.fundamentalProfile);
        if (!fundamental) continue;
        for (const themeId of themes) {
          for (const base of bases) {
            if (base.level > variant.level || !compatibilityMatches(base, profile)) continue;
            const propertyRunes = this.#resolveProfilePropertyRunes({ base, profile, variant, themeId });
            if (propertyRunes == null) continue;
            const rarity = rarityMax([base.rarity, profile.rarity, ...propertyRunes.map((rune) => rune.rarity)]);
            if (request.rarity.length && !request.rarity.includes(rarity)) continue;
            structural.push({ profile, variant, fundamental, themeId, base, propertyRunes, rarity });
          }
        }
      }
    }

    let candidates = structural.filter((candidate) => levelAllowed(candidate.variant.level, request));
    const warnings = [];
    if (candidates.length === 0 && request.levelPolicy === "nearest" && structural.length > 0) {
      const bestDistance = Math.min(...structural.map((candidate) => distanceToLevelRequest(candidate.variant.level, request.level)));
      candidates = structural.filter((candidate) => distanceToLevelRequest(candidate.variant.level, request.level) === bestDistance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((candidate) => candidate.variant.level))]
      });
    }
    if (!candidates.length) {
      const error = new Error("No generated specific magic item matches the request");
      error.code = "NO_SPECIFIC_PROFILE_CANDIDATE";
      error.details = { itemType, level: request.level, profile: requestedProfile, theme: request.magic?.theme };
      throw error;
    }

    if (request.level.target != null) {
      const bestDistance = Math.min(...candidates.map((candidate) => Math.abs(candidate.variant.level - request.level.target)));
      candidates = candidates.filter((candidate) => Math.abs(candidate.variant.level - request.level.target) === bestDistance);
    }

    const rng = new SeededRng(request.seed);
    const selected = rng.pick(candidates);
    const document = await this.index.getDocument(selected.base);
    if (!document) {
      const error = new Error(`Could not load selected base item ${selected.base.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    this.#composeCustomItem(itemSource, selected, request);

    const effect = this.#renderEffect(selected);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    const propertyRuneData = selected.propertyRunes.map((rune) => ({
      id: rune.id, slug: rune.slug, label: rune.label, level: rune.level, rarity: rune.rarity
    }));

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: `specific-${itemType}-generated`,
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
        profile: { id: selected.profile.id, label: selected.profile.label },
        variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price },
        theme: selected.themeId,
        fundamentalRunes: { ...selected.fundamental },
        propertyRunes: propertyRuneData,
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
        candidateCount: candidates.length,
        magic: {
          kind: `specific-${itemType}`,
          specificMode: "generated",
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          theme: selected.themeId
        },
        specificItem: {
          mode: "generated",
          itemType,
          profile: selected.profile.id,
          profileLabel,
          variant: selected.variant.id,
          variantLabel,
          theme: selected.themeId,
          effect,
          automation: selected.profile.automation,
          baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
          runes: { ...selected.fundamental, property: selected.propertyRunes.map((rune) => rune.slug) },
          propertyRunes: propertyRuneData,
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

  #resolveProfilePropertyRunes({ base, profile, variant, themeId }) {
    const slugs = [...new Set([
      ...(variant.propertyRunes ?? []),
      ...(themeId ? profile.propertyRunesByTheme?.[themeId] ?? [] : [])
    ])];
    const capacity = propertyRuneCapacity(base.type, variant.fundamentalProfile ? (fundamentalById(base.type, variant.fundamentalProfile)?.potency ?? 0) : 0);
    if (slugs.length > capacity) return null;
    const runes = slugs.map((slug) => this.propertyRunes?.getBySlug?.(base.type, slug)).filter(Boolean);
    if (runes.length !== slugs.length) return null;
    if (runes.some((rune) => rune.level > variant.level || !rune.matches(base))) return null;
    return runes;
  }

  #renderData(selected) {
    const theme = themeName(selected.themeId, this.formatter);
    const data = {
      base: selected.base.name,
      theme,
      ...Object.fromEntries(Object.entries(selected.variant.values ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)])),
      ...Object.fromEntries(Object.entries(selected.profile.valuesByTheme?.[selected.themeId] ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)]))
    };
    return data;
  }

  #renderEffect(selected) {
    return localize(this.formatter, selected.profile.effectText, this.#renderData(selected), selected.profile.effectText ?? "");
  }

  #composeCustomItem(itemSource, selected, request) {
    const { profile, variant, fundamental, themeId, propertyRunes, rarity } = selected;
    const data = this.#renderData(selected);
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];
    itemSource.system.traits.value = [...new Set([
      ...itemSource.system.traits.value,
      "magical",
      ...(themeId ? profile.itemTraitsByTheme?.[themeId] ?? [] : [])
    ])].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;

    applyFundamentalProfile(itemSource, fundamental);
    itemSource.system.runes ??= {};
    itemSource.system.runes.property = propertyRunes.map((rune) => rune.slug);
    setSpecificSystemValue(itemSource.system);

    const name = localize(this.formatter, profile.nameTemplate, data, `${selected.base.name} (${profile.id})`);
    itemSource.name = name;
    const baseDescription = itemSource.system.description?.value ?? "";
    const description = localize(this.formatter, profile.description, data, "");
    const effect = this.#renderEffect(selected);
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      description ? `<p>${description}</p>` : "",
      effect ? `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.SpecificItemText.SpecialAbility", {}, "Special Ability")}</strong> ${effect}</p>` : "",
      `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.SpecificItemText.PropertyRuneRestriction", {}, "This specific item can only retain the property runes already built into it.")}</em></p>`,
      baseDescription ? `<hr>${baseDescription}` : ""
    ].filter(Boolean).join("");

    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: true,
      generator: this.id,
      seed: request.seed,
      specificItem: {
        mode: "generated",
        itemType: selected.base.type,
        profile: profile.id,
        variant: variant.id,
        theme: themeId,
        level: variant.level,
        priceGp: variant.price,
        effect,
        automation: profile.automation,
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
        fundamentalRunes: { ...fundamental },
        propertyRunes: propertyRunes.map((rune) => ({ slug: rune.slug, level: rune.level, rarity: rune.rarity }))
      }
    };
  }
}
