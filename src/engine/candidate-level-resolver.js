import { distanceToLevelRequest, levelAllowed } from "./item-level-resolver.js";

/**
 * Centralize the level-policy portion of candidate selection.
 * Generators remain responsible for constructing semantically valid candidates;
 * this service only applies Item Forge level constraints and nearest fallback.
 */
export class CandidateLevelResolver {
  resolve(candidates, request, { getLevel = (candidate) => candidate?.level, preferTarget = true } = {}) {
    const all = Array.isArray(candidates) ? candidates : [];
    let selected = all.filter((candidate) => levelAllowed(Number(getLevel(candidate)), request));
    const warnings = [];
    let exact = selected.length > 0;

    if (!selected.length && request?.levelPolicy === "nearest" && all.length) {
      const distances = all
        .map((candidate) => distanceToLevelRequest(Number(getLevel(candidate)), request.level))
        .filter(Number.isFinite);
      if (distances.length) {
        const bestDistance = Math.min(...distances);
        selected = all.filter((candidate) => distanceToLevelRequest(Number(getLevel(candidate)), request.level) === bestDistance);
        warnings.push({
          code: "LEVEL_TARGET_APPROXIMATED",
          requested: { ...request.level },
          actualLevels: [...new Set(selected.map((candidate) => Number(getLevel(candidate))))].sort((a, b) => a - b)
        });
        exact = false;
      }
    }

    if (preferTarget && selected.length && request?.level?.target != null) {
      const target = Number(request.level.target);
      const best = Math.min(...selected.map((candidate) => Math.abs(Number(getLevel(candidate)) - target)));
      selected = selected.filter((candidate) => Math.abs(Number(getLevel(candidate)) - target) === best);
    }

    return { candidates: selected, warnings, exact };
  }
}

export const candidateLevelResolver = new CandidateLevelResolver();
