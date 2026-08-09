import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, ItemLevelResolver, levelAllowed } from "../item-level-resolver.js";
import { applyFundamentalProfile, getFundamentalProfiles, propertyRuneCapacity } from "../equipment-rune-profiles.js";

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
  if (entry.specific) return false;
  return !hasRunes(entry);
}

function cloneSource(document) {
  const source = document.toObject();
  delete source._id;
  return source;
}

export class EquipmentGenerator {
  constructor({ compendiumIndex, levelResolver = new ItemLevelResolver() }) {
    this.id = "equipment-composed";
    this.index = compendiumIndex;
    this.levelResolver = levelResolver;
  }

  supports(request) {
    return request.mode === "equipment";
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
    const plans = [];
    for (const base of pool) {
      for (const profile of getFundamentalProfiles(base.type, runeMode)) {
        const effectiveLevel = this.levelResolver.resolve({ baseLevel: base.level, runeLevels: [profile.level] });
        plans.push({ base, profile, effectiveLevel });
      }
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

    const potency = Number(selected.profile.potency) || 0;
    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "equipment",
        baseItem: { uuid: selected.base.uuid, name: selected.base.name, level: selected.base.level },
        fundamentalRunes: { ...selected.profile },
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
        rarity: selected.base.rarity,
        category: request.category,
        candidateCount: candidates.length,
        runeProfile: selected.profile.id,
        runes: { ...selected.profile },
        propertyRuneCapacity: propertyRuneCapacity(selected.base.type, potency)
      }
    };
  }
}
