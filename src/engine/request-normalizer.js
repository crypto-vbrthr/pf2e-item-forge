import {
  DEFAULT_LEVEL_MAX,
  DEFAULT_LEVEL_MIN,
  DEFAULT_SOLVER_ATTEMPTS,
  ABSOLUTE_SOLVER_ATTEMPTS
} from "../constants.js";
import { createSeed } from "./seeded-rng.js";

const LEVEL_POLICIES = new Set(["strict", "nearest", "notAbove", "notBelow"]);
const SOURCE_MODES = new Set(["all", "system", "selected"]);
const FUNDAMENTAL_RUNE_MODES = new Set(["automatic", "none"]);
const PROPERTY_RUNE_MODES = new Set(["automatic", "random", "fixed", "none"]);
const STAFF_MODES = new Set(["generated", "existing"]);

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decimal(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function uniqueStrings(values) {
  return [...new Set(Array.isArray(values) ? values.filter((value) => typeof value === "string" && value) : [])];
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

/**
 * Produce the canonical request understood by the engine. This is the single
 * hydration path used by validation, generation, the embedded editor, and API
 * consumers so that omitted fields always receive identical defaults.
 */
export function normalizeRequest(request = {}, options = {}) {
  const level = normalizeLevel(request.level);
  const value = normalizeValue(request.value);
  const source = request.source ?? {};
  const sourceMode = SOURCE_MODES.has(source.mode) ? source.mode : options.defaultSourceMode ?? "all";
  const policy = LEVEL_POLICIES.has(request.levelPolicy) ? request.levelPolicy : "strict";
  const configuredAttempts = integer(request.solver?.maxAttempts, options.defaultSolverAttempts ?? DEFAULT_SOLVER_ATTEMPTS);
  const rawMode = typeof request.mode === "string" && request.mode.trim() ? request.mode.trim() : "existing";

  return {
    mode: rawMode,
    category: typeof request.category === "string" && request.category ? request.category : "item",
    level,
    value,
    levelPolicy: policy,
    rarity: uniqueStrings(request.rarity),
    source: {
      mode: sourceMode,
      includePacks: uniqueStrings(source.includePacks),
      excludePacks: uniqueStrings(source.excludePacks)
    },
    solver: {
      maxAttempts: Math.max(1, Math.min(ABSOLUTE_SOLVER_ATTEMPTS, configuredAttempts))
    },
    treasure: {
      type: typeof request.treasure?.type === "string" && request.treasure.type ? request.treasure.type : "any",
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
        selected: uniqueStrings(request.equipment?.propertyRunes?.selected)
      }
    },
    magic: {
      theme: typeof request.magic?.theme === "string" && request.magic.theme ? request.magic.theme : "automatic",
      allowHeightened: boolean(request.magic?.allowHeightened, true),
      staffMode: STAFF_MODES.has(request.magic?.staffMode) ? request.magic.staffMode : "generated",
      staffProfile: typeof request.magic?.staffProfile === "string" && request.magic.staffProfile ? request.magic.staffProfile : "automatic"
    },
    seed: String(request.seed ?? createSeed()),
    filters: request.filters && typeof request.filters === "object" ? request.filters : {},
    metadata: request.metadata && typeof request.metadata === "object" ? request.metadata : {}
  };
}

/**
 * Hydrate a request for the embedded editor. The engine shape remains canonical
 * while levelMode is UI-only state.
 */
export function hydrateEditorRequest(request = {}, options = {}) {
  const normalized = normalizeRequest(request, options);
  const requestedMode = request.levelMode;
  const levelMode = requestedMode === "range" || requestedMode === "single"
    ? requestedMode
    : normalized.level.min === normalized.level.max ? "single" : "range";

  if (levelMode === "single") {
    normalized.level.max = normalized.level.min;
    normalized.level.target = normalized.level.min;
  }

  return { ...normalized, levelMode };
}

export function validateRequest(request, {
  categories,
  generationModes = null,
  defaultOptions = {}
} = {}) {
  const errors = [];
  let normalized;
  try {
    normalized = normalizeRequest(request, defaultOptions);
  } catch (error) {
    return { valid: false, errors: [{ code: "INVALID_REQUEST", message: error.message }] };
  }

  if (generationModes) {
    const supportedModes = generationModes instanceof Set ? generationModes : new Set(generationModes);
    if (supportedModes.size && !supportedModes.has(normalized.mode)) {
      errors.push({ code: "UNKNOWN_GENERATION_MODE", field: "mode", value: normalized.mode });
    }
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
  if (normalized.mode === "magic") {
    const category = normalized.category;
    const supported = category === "magic.wand" || category === "magic.staff" || category === "magic.spellheart";
    if (!supported) errors.push({ code: "UNSUPPORTED_MAGIC_CATEGORY", field: "category", value: category });
  }
  return { valid: errors.length === 0, errors, request: normalized };
}
