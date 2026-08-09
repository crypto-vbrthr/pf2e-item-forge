import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";

export class ExistingItemGenerator {
  constructor({ compendiumIndex }) {
    this.id = "existing-item";
    this.mode = "existing";
    this.priority = 0;
    this.index = compendiumIndex;
  }

  supports(request) {
    return request.mode === "existing";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    // Generic scroll compendium entries are templates rather than complete
    // generated items. The dedicated ScrollGenerator attaches a spell first.
    const pool = this.index.query(request).filter((entry) => entry.consumableCategory !== "scroll");
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
      const error = new Error("No item candidate matches the request");
      error.code = "NO_ITEM_IN_LEVEL_RANGE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    const candidate = rng.pick(candidates);
    const document = await this.index.getDocument(candidate);
    if (!document) {
      const error = new Error(`Could not load selected item ${candidate.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    return {
      request,
      itemSource: document.toObject(),
      warnings,
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: candidate.pack,
        sourceUuid: candidate.uuid,
        level: candidate.level,
        rarity: candidate.rarity,
        category: request.category,
        candidateCount: candidates.length
      }
    };
  }
}
