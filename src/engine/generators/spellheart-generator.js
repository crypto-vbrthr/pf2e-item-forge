import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

/**
 * Spellhearts are highly bespoke PF2e items: each published spellheart can
 * provide different armor/weapon benefits and its own activated spells.  The
 * safe generator strategy is therefore to select and preserve a complete
 * predefined spellheart document rather than trying to synthesize partial rule
 * elements from unrelated spellhearts.
 */
export class SpellheartGenerator {
  constructor({ compendiumIndex } = {}) {
    this.id = "spellheart";
    this.mode = "magic";
    this.priority = 215;
    this.index = compendiumIndex;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.spellheart";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();

    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.spellheart"));
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
      const error = new Error("No predefined spellheart matches the request");
      error.code = "NO_PREDEFINED_SPELLHEART_CANDIDATE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    if (request.level.target != null) {
      const bestDistance = Math.min(...candidates.map((entry) => Math.abs(entry.level - request.level.target)));
      candidates = candidates.filter((entry) => Math.abs(entry.level - request.level.target) === bestDistance);
    }

    const selected = rng.pick(candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined spellheart ${selected.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof document.toObject === "function"
      ? document.toObject()
      : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: false,
      generator: this.id,
      seed: request.seed,
      sourceUuid: selected.uuid,
      spellheart: { mode: "existing" }
    };

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "spellheart-existing",
        sourceItem: {
          name: selected.name,
          uuid: selected.uuid,
          level: selected.level,
          usage: selected.usage ?? null,
          traits: [...(selected.traits ?? [])]
        }
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
        magic: {
          kind: "spellheart",
          spellheartMode: "existing"
        },
        spellheart: {
          mode: "existing",
          usage: selected.usage ?? null,
          traits: [...(selected.traits ?? [])]
        }
      }
    };
  }
}
