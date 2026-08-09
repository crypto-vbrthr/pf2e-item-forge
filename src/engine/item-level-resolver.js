/**
 * Resolve the effective PF2e item level for a composed item.
 * GM Core: the level of a rune-etched item is the highest level among
 * the base item and all runes etched onto it. Materials can participate
 * in the same way once precious-material generation is added.
 */
export class ItemLevelResolver {
  resolve({ baseLevel = 0, runeLevels = [], materialLevel = 0, componentLevels = [] } = {}) {
    const levels = [baseLevel, materialLevel, ...runeLevels, ...componentLevels]
      .map((value) => Number(value))
      .filter(Number.isFinite)
      .map((value) => Math.max(0, Math.trunc(value)));
    return Math.max(0, ...levels);
  }
}

export function levelAllowed(level, request) {
  const { min, max } = request.level;
  if (request.levelPolicy === "notAbove") return level <= max;
  if (request.levelPolicy === "notBelow") return level >= min;
  return level >= min && level <= max;
}

export function distanceToLevelRequest(level, { min, max, target }) {
  if (target != null) return Math.abs(level - target);
  if (level < min) return min - level;
  if (level > max) return level - max;
  return 0;
}
