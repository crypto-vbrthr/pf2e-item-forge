/**
 * Canonical Remaster fundamental-rune progressions from GM Core.
 * The profile level is the highest rune level in that profile.
 * Property runes are deliberately separate: they will be registered as
 * individual components and can raise the final level independently.
 */
export const WEAPON_FUNDAMENTAL_PROFILES = Object.freeze([
  { id: "mundane", level: 0, potency: 0, striking: 0 },
  { id: "potency-1", level: 2, potency: 1, striking: 0 },
  { id: "potency-1-striking", level: 4, potency: 1, striking: 1 },
  { id: "potency-2-striking", level: 10, potency: 2, striking: 1 },
  { id: "potency-2-greater-striking", level: 12, potency: 2, striking: 2 },
  { id: "potency-3-greater-striking", level: 16, potency: 3, striking: 2 },
  { id: "potency-3-major-striking", level: 19, potency: 3, striking: 3 }
]);

export const ARMOR_FUNDAMENTAL_PROFILES = Object.freeze([
  { id: "mundane", level: 0, potency: 0, resilient: 0 },
  { id: "potency-1", level: 5, potency: 1, resilient: 0 },
  { id: "potency-1-resilient", level: 8, potency: 1, resilient: 1 },
  { id: "potency-2-resilient", level: 11, potency: 2, resilient: 1 },
  { id: "potency-2-greater-resilient", level: 14, potency: 2, resilient: 2 },
  { id: "potency-3-greater-resilient", level: 18, potency: 3, resilient: 2 },
  { id: "potency-3-major-resilient", level: 20, potency: 3, resilient: 3 }
]);

export const SHIELD_REINFORCING_PROFILES = Object.freeze([
  { id: "mundane", level: 0, reinforcing: 0 },
  { id: "minor", level: 4, reinforcing: 1 },
  { id: "lesser", level: 7, reinforcing: 2 },
  { id: "moderate", level: 10, reinforcing: 3 },
  { id: "greater", level: 13, reinforcing: 4 },
  { id: "major", level: 16, reinforcing: 5 },
  { id: "supreme", level: 19, reinforcing: 6 }
]);

export function getFundamentalProfiles(type, runeMode = "automatic") {
  if (runeMode === "none") {
    if (type === "weapon") return [WEAPON_FUNDAMENTAL_PROFILES[0]];
    if (type === "armor") return [ARMOR_FUNDAMENTAL_PROFILES[0]];
    if (type === "shield") return [SHIELD_REINFORCING_PROFILES[0]];
    return [];
  }
  if (type === "weapon") return WEAPON_FUNDAMENTAL_PROFILES;
  if (type === "armor") return ARMOR_FUNDAMENTAL_PROFILES;
  if (type === "shield") return SHIELD_REINFORCING_PROFILES;
  return [];
}

export function propertyRuneCapacity(type, potency = 0) {
  if (!['weapon', 'armor'].includes(type)) return 0;
  return Math.max(0, Math.min(3, Number(potency) || 0));
}

export function applyFundamentalProfile(source, profile) {
  source.system ??= {};
  source.system.runes ??= {};

  if (source.type === "weapon") {
    source.system.runes.potency = profile.potency ?? 0;
    source.system.runes.striking = profile.striking ?? 0;
    source.system.runes.property ??= [];
  } else if (source.type === "armor") {
    source.system.runes.potency = profile.potency ?? 0;
    source.system.runes.resilient = profile.resilient ?? 0;
    source.system.runes.property ??= [];
  } else if (source.type === "shield") {
    // PF2e models the shield fundamental rune as a reinforcing rune.
    // Keep this isolated here so a future schema migration needs one change.
    source.system.runes.reinforcing = profile.reinforcing ?? 0;
  }
  return source;
}
