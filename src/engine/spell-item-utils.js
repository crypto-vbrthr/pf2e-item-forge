function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

/**
 * Return spell ranks at which the spell actually gains a heightened entry.
 * The base rank is always valid. Spells without heightening data are not
 * artificially raised to higher ranks by the Item Forge.
 */
export function getMeaningfulSpellRanks(spell, { maxRank = 10 } = {}) {
  const baseRank = Math.max(1, Math.min(maxRank, Number(spell?.baseRank ?? 1)));
  const ranks = new Set([baseRank]);
  const heightening = spell?.heightening;

  if (heightening?.type === "interval") {
    const interval = Math.max(1, Number(heightening.interval ?? 0));
    for (let rank = baseRank + interval; rank <= maxRank; rank += interval) ranks.add(rank);
  } else if (heightening?.type === "fixed") {
    for (const key of Object.keys(heightening.levels ?? {})) {
      const rank = Number(key);
      if (Number.isInteger(rank) && rank >= baseRank && rank <= maxRank) ranks.add(rank);
    }
  }

  return [...ranks].sort((a, b) => a - b);
}

export function isNormalSlottedSpell(spell) {
  const rank = Number(spell?.baseRank);
  return Number.isInteger(rank)
    && rank >= 1
    && rank <= 10
    && !spell?.cantrip
    && !spell?.focus
    && !spell?.ritual;
}

export function isStaffCantrip(spell) {
  return Boolean(spell?.cantrip) && !spell?.focus && !spell?.ritual;
}

export function spellSourceAtRank(spellDocument, rank, randomId) {
  const source = typeof spellDocument?.toObject === "function"
    ? spellDocument.toObject()
    : clone(spellDocument?._source ?? spellDocument);
  const embeddedSpell = clone(source);
  embeddedSpell._id = randomId();
  embeddedSpell.system ??= {};
  embeddedSpell.system.location ??= {};
  embeddedSpell.system.location.value = null;
  embeddedSpell.system.location.heightenedLevel = rank;
  return embeddedSpell;
}

export function getHighestRarity(rarities = []) {
  const order = { common: 0, uncommon: 1, rare: 2, unique: 3 };
  return [...rarities].sort((a, b) => (order[b] ?? 0) - (order[a] ?? 0))[0] ?? "common";
}
