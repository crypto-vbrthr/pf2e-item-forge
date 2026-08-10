const MAGIC_MARKERS = new Set(["magical", "arcane", "divine", "occult", "primal"]);

export const HELD_HAND_DEFINITIONS = Object.freeze([
  { id: "one-hand", hands: 1, label: "PF2E_ITEM_FORGE.HeldHands.One" },
  { id: "two-hands", hands: 2, label: "PF2E_ITEM_FORGE.HeldHands.Two" }
]);

export function hasHeldMagicMarkerTraits(traits = []) {
  return (Array.isArray(traits) ? traits : []).some((trait) => MAGIC_MARKERS.has(String(trait).toLowerCase()));
}

export function parseHeldUsage(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return { held: false, hands: null, id: null, raw };

  if (/\bheld\s+in\s+(?:1|one)\s+hand\b/.test(normalized) || /\bheld\s+(?:1|one)\s+hand\b/.test(normalized)) {
    return { held: true, hands: 1, id: "one-hand", raw };
  }
  if (/\bheld\s+in\s+(?:2|two)\s+hands?\b/.test(normalized) || /\bheld\s+(?:2|two)\s+hands?\b/.test(normalized)) {
    return { held: true, hands: 2, id: "two-hands", raw };
  }
  return { held: false, hands: null, id: null, raw };
}

export function heldCategoryForHands(hands) {
  return Number(hands) === 1 ? "magic.held.one-hand" : Number(hands) === 2 ? "magic.held.two-hands" : "magic.held";
}

export function heldHandsLabelKey(hands) {
  return Number(hands) === 1 ? "PF2E_ITEM_FORGE.HeldHands.One" : Number(hands) === 2 ? "PF2E_ITEM_FORGE.HeldHands.Two" : null;
}
