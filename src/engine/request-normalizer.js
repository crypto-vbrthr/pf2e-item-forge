import {
  DEFAULT_LEVEL_MAX,
  DEFAULT_LEVEL_MIN,
  DEFAULT_SOLVER_ATTEMPTS,
  ABSOLUTE_SOLVER_ATTEMPTS
} from "../constants.js";
import { createSeed } from "./seeded-rng.js";

const LEVEL_POLICIES = new Set(["strict", "nearest", "notAbove", "notBelow"]);
const SOURCE_MODES = new Set(["all", "system", "selected"]);
const GENERATION_MODES = new Set(["existing", "equipment", "treasure"]);
const FUNDAMENTAL_RUNE_MODES = new Set(["automatic", "none"]);
const PROPERTY_RUNE_MODES = new Set(["automatic", "random", "fixed", "none"]);

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}


function decimal(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeValue(value = {}) {
  const mode = value?.mode === "range" ? "range" : "target";
  if (mode === "range") {
    let min = Math.max(0.1, decimal(value.min, 10));
    let max = Math.max(0.1, decimal(value.max, Math.max(min, 50)));
    if (min > max) [min, max] = [max, min];
    return { mode, min, max, target: (min + max) / 2, tolerance: 0 };
  }
  return {
    mode,
    target: Math.max(0.1, decimal(value.target, 25)),
    min: null,
    max: null,
    tolerance: Math.max(0, Math.min(1, decimal(value.tolerance, 0.15)))
  };
}

function normalizeLevel(level) {
  if (Number.isInteger(level)) {
    return { min: level, max: level, target: level };
  }

  const raw = level ?? {};
  let min = integer(raw.min, DEFAULT_LEVEL_MIN);
  let max = integer(raw.max, min);
  min = Math.max(DEFAULT_LEVEL_MIN, Math.min(DEFAULT_LEVEL_MAX, min));
  max = Math.max(DEFAULT_LEVEL_MIN, Math.min(DEFAULT_LEVEL_MAX, max));
  if (min > max) [min, max] = [max, min];

  let target = raw.target == null ? null : integer(raw.target, null);
  if (target != null) target = Math.max(min, Math.min(max, target));
  return { min, max, target };
}

export function normalizeRequest(request = {}, options = {}) {
  const level = normalizeLevel(request.level);
  const value = normalizeValue(request.value);
  const source = request.source ?? {};
  const sourceMode = SOURCE_MODES.has(source.mode) ? source.mode : options.defaultSourceMode ?? "all";
  const policy = LEVEL_POLICIES.has(request.levelPolicy) ? request.levelPolicy : "strict";
  const configuredAttempts = integer(request.solver?.maxAttempts, options.defaultSolverAttempts ?? DEFAULT_SOLVER_ATTEMPTS);

  return {
    mode: GENERATION_MODES.has(request.mode) ? request.mode : "existing",
    category: request.category ?? "item",
    level,
    value,
    levelPolicy: policy,
    rarity: Array.isArray(request.rarity) ? [...new Set(request.rarity.filter(Boolean))] : [],
    source: {
      mode: sourceMode,
      includePacks: [...new Set(source.includePacks ?? [])],
      excludePacks: [...new Set(source.excludePacks ?? [])]
    },
    solver: {
      maxAttempts: Math.max(1, Math.min(ABSOLUTE_SOLVER_ATTEMPTS, configuredAttempts))
    },
    treasure: {
      material: typeof request.treasure?.material === "string" && request.treasure.material ? request.treasure.material : "any",
      condition: typeof request.treasure?.condition === "string" && request.treasure.condition ? request.treasure.condition : "any",
      craftsmanship: typeof request.treasure?.craftsmanship === "string" && request.treasure.craftsmanship ? request.treasure.craftsmanship : "any",
      motif: typeof request.treasure?.motif === "string" && request.treasure.motif ? request.treasure.motif : "any",
      style: typeof request.treasure?.style === "string" && request.treasure.style ? request.treasure.style : "any"
    },
    equipment: {
      fundamentalRunes: FUNDAMENTAL_RUNE_MODES.has(request.equipment?.fundamentalRunes)
        ? request.equipment.fundamentalRunes
        : "automatic",
      propertyRunes: {
        mode: PROPERTY_RUNE_MODES.has(request.equipment?.propertyRunes?.mode)
          ? request.equipment.propertyRunes.mode
          : "automatic",
        selected: [...new Set(
          Array.isArray(request.equipment?.propertyRunes?.selected)
            ? request.equipment.propertyRunes.selected.filter((slug) => typeof slug === "string" && slug)
            : []
        )]
      }
    },
    seed: String(request.seed ?? createSeed()),
    filters: request.filters ?? {},
    metadata: request.metadata ?? {}
  };
}

export function validateRequest(request, { categories } = {}) {
  const errors = [];
  let normalized;
  try {
    normalized = normalizeRequest(request);
  } catch (error) {
    return { valid: false, errors: [{ code: "INVALID_REQUEST", message: error.message }] };
  }

  if (categories && !categories.has(normalized.category)) {
    errors.push({ code: "UNKNOWN_CATEGORY", field: "category", value: normalized.category });
  }
  if (normalized.mode !== "treasure" && normalized.source.mode === "selected" && normalized.source.includePacks.length === 0) {
    errors.push({ code: "NO_SOURCE_PACKS", field: "source.includePacks" });
  }
  if (normalized.mode === "equipment") {
    const category = normalized.category;
    const supported = ["weapon", "armor", "shield"].some((root) =>
      category === root || categories?.isDescendant?.(category, root)
    );
    if (!supported) errors.push({ code: "UNSUPPORTED_EQUIPMENT_CATEGORY", field: "category", value: category });
  }
  if (normalized.mode === "treasure") {
    const category = normalized.category;
    const supported = category === "treasure" || categories?.isDescendant?.(category, "treasure");
    if (!supported) errors.push({ code: "UNSUPPORTED_TREASURE_CATEGORY", field: "category", value: category });
  }
  return { valid: errors.length === 0, errors, request: normalized };
}
