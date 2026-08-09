import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, ItemLevelResolver, levelAllowed } from "../item-level-resolver.js";
import { applyFundamentalProfile, getFundamentalProfiles, propertyRuneCapacity } from "../equipment-rune-profiles.js";
import { RARITY_ORDER } from "../registries/property-rune-registry.js";
import { isSpecificSystemValue } from "../compendium-index.js";

function hasRunes(entry) {
  const runes = entry.runes ?? {};
  if ((Number(runes.potency) || 0) > 0) return true;
  if ((Number(runes.striking) || 0) > 0) return true;
  if ((Number(runes.resilient) || 0) > 0) return true;
  if ((Number(runes.reinforcing) || 0) > 0) return true;
  return Array.isArray(runes.property) && runes.property.length > 0;
}

function isUsableBase(entry) {
  if (!["weapon", "armor", "shield"].includes(entry.type)) return false;
  if (isSpecificSystemValue(entry.specific)) return false;
  return !hasRunes(entry);
}

function cloneSource(document) {
  const source = document.toObject();
  delete source._id;
  return source;
}

function combinations(values, size) {
  if (size === 0) return [[]];
  if (size > values.length) return [];
  const result = [];
  const walk = (start, picked) => {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }
    for (let i = start; i <= values.length - (size - picked.length); i += 1) {
      picked.push(values[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return result;
}

function allCombinations(values, minSize, maxSize) {
  const result = [];
  for (let size = minSize; size <= maxSize; size += 1) result.push(...combinations(values, size));
  return result;
}

function highestRarity(baseRarity, propertyRunes) {
  return propertyRunes.reduce((current, rune) =>
    (RARITY_ORDER[rune.rarity] ?? 0) > (RARITY_ORDER[current] ?? 0) ? rune.rarity : current,
  baseRarity ?? "common");
}

export class EquipmentGenerator {
  constructor({ compendiumIndex, propertyRunes, levelResolver = new ItemLevelResolver() }) {
    this.id = "equipment-composed";
    this.mode = "equipment";
    this.priority = 150;
    this.index = compendiumIndex;
    this.propertyRunes = propertyRunes;
    this.levelResolver = levelResolver;
  }

  supports(request) {
    return request.mode === "equipment";
  }

  #propertyRuneSelections(base, profile, request) {
    if (!["weapon", "armor"].includes(base.type)) return [[]];

    const capacity = propertyRuneCapacity(base.type, Number(profile.potency) || 0);
    const settings = request.equipment?.propertyRunes ?? { mode: "automatic", selected: [] };

    // Fixed selections are a hard constraint. Validate them before the
    // capacity shortcut so a requested property rune cannot silently vanish
    // on a profile with no available property-rune slots.
    if (settings.mode === "fixed") {
      if (settings.selected.length === 0) return [[]];
      if (capacity === 0) return [];

      const available = this.propertyRunes.getCompatible(base, {
        maxLevel: request.levelPolicy === "notBelow" ? Infinity : request.level.max,
        allowedRarities: request.rarity
      });
      const selected = settings.selected.map((slug) => this.propertyRunes.getBySlug(base.type, slug));
      if (selected.some((rune) => !rune)) return [];
      if (selected.length > capacity) return [];
      if (new Set(selected.map((rune) => rune.slug)).size !== selected.length) return [];
      if (selected.some((rune) => !available.some((candidate) => candidate.id === rune.id))) return [];
      return [selected];
    }

    if (settings.mode === "none" || capacity === 0) return [[]];

    const available = this.propertyRunes.getCompatible(base, {
      maxLevel: request.levelPolicy === "notBelow" ? Infinity : request.level.max,
      allowedRarities: request.rarity
    });

    if (!available.length) return [[]];

    if (settings.mode === "automatic") {
      const count = Math.min(capacity, available.length);
      return combinations(available, count);
    }

    // Random mode deliberately includes different rune counts. Every generated
    // plan remains valid and the request seed chooses one deterministically.
    return allCombinations(available, 0, Math.min(capacity, available.length));
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();

    const pool = this.index.query(request).filter(isUsableBase);
    if (pool.length === 0) {
      const error = new Error("No mundane base equipment matches the request");
      error.code = "NO_BASE_EQUIPMENT";
      error.details = { category: request.category, source: request.source };
      throw error;
    }

    const runeMode = request.equipment?.fundamentalRunes ?? "automatic";
    const propertyMode = request.equipment?.propertyRunes?.mode ?? "automatic";
    const plans = [];
    for (const base of pool) {
      for (const profile of getFundamentalProfiles(base.type, runeMode)) {
        const selections = this.#propertyRuneSelections(base, profile, request);
        for (const propertyRunes of selections) {
          const runeLevels = [profile.level, ...propertyRunes.map((rune) => rune.level)];
          const effectiveLevel = this.levelResolver.resolve({ baseLevel: base.level, runeLevels });
          plans.push({
            base,
            profile,
            propertyRunes,
            effectiveLevel,
            effectiveRarity: highestRarity(base.rarity, propertyRunes)
          });
        }
      }
    }

    if (propertyMode === "fixed" && plans.length === 0) {
      const error = new Error("The selected property runes are not compatible with any valid base item or rune capacity");
      error.code = "INVALID_PROPERTY_RUNE_SELECTION";
      error.details = {
        category: request.category,
        selected: request.equipment?.propertyRunes?.selected ?? []
      };
      throw error;
    }

    let candidates = plans.filter((plan) => levelAllowed(plan.effectiveLevel, request));
    const warnings = [];
    if (candidates.length === 0 && request.levelPolicy === "nearest" && plans.length > 0) {
      const bestDistance = Math.min(...plans.map((plan) => distanceToLevelRequest(plan.effectiveLevel, request.level)));
      candidates = plans.filter((plan) => distanceToLevelRequest(plan.effectiveLevel, request.level) === bestDistance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((plan) => plan.effectiveLevel))]
      });
    }

    if (candidates.length === 0) {
      const error = new Error("No composed equipment candidate matches the requested level");
      error.code = "NO_ITEM_IN_LEVEL_RANGE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    const selected = rng.pick(candidates);
    const document = await this.index.getDocument(selected.base);
    if (!document) {
      const error = new Error(`Could not load selected base item ${selected.base.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = cloneSource(document);
    applyFundamentalProfile(itemSource, selected.profile);
    itemSource.system ??= {};
    itemSource.system.level ??= {};
    itemSource.system.level.value = selected.effectiveLevel;
    itemSource.system.rarity ??= {};
    itemSource.system.rarity.value = selected.effectiveRarity;

    if (["weapon", "armor"].includes(selected.base.type)) {
      itemSource.system.runes ??= {};
      itemSource.system.runes.property = selected.propertyRunes.map((rune) => rune.slug);
    }

    const potency = Number(selected.profile.potency) || 0;
    const propertyRuneData = selected.propertyRunes.map((rune) => ({
      id: rune.id,
      slug: rune.slug,
      label: rune.label,
      level: rune.level,
      rarity: rune.rarity
    }));

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "equipment",
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
        fundamentalRunes: { ...selected.profile },
        propertyRunes: propertyRuneData,
        propertyRuneCapacity: propertyRuneCapacity(selected.base.type, potency),
        effectiveLevel: selected.effectiveLevel
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.base.pack,
        sourceUuid: selected.base.uuid,
        baseLevel: selected.base.level,
        level: selected.effectiveLevel,
        rarity: selected.effectiveRarity,
        category: request.category,
        candidateCount: candidates.length,
        runeProfile: selected.profile.id,
        runes: { ...selected.profile, property: selected.propertyRunes.map((rune) => rune.slug) },
        propertyRunes: propertyRuneData,
        propertyRuneMode: propertyMode,
        propertyRuneCapacity: propertyRuneCapacity(selected.base.type, potency)
      }
    };
  }
}
