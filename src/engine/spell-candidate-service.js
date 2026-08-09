import { getMeaningfulSpellRanks, isNormalSlottedSpell, isStaffCantrip } from "./spell-item-utils.js";
import { spellMatchesMagicTheme } from "./magic-themes.js";

/** Shared spell eligibility helpers for spell-bearing magic-item generators. */
export class SpellCandidateService {
  getEligibleSpells(index, request, {
    allowCantrips = false,
    allowSlotted = true,
    theme = "automatic",
    predicate = null
  } = {}) {
    const spells = index.querySpells(request).filter((spell) => {
      const baseEligible = (allowSlotted && isNormalSlottedSpell(spell)) || (allowCantrips && isStaffCantrip(spell));
      if (!baseEligible || spell.ritual || spell.focus) return false;
      if (!spellMatchesMagicTheme(spell, theme)) return false;
      return predicate ? Boolean(predicate(spell)) : true;
    });
    return spells;
  }

  getAvailableRanks(spell, { maxRank = 10, allowHeightened = true, allowCantrip = false } = {}) {
    if (allowCantrip && isStaffCantrip(spell)) return [0];
    if (!isNormalSlottedSpell(spell)) return [];
    if (!allowHeightened) {
      const rank = Number(spell.baseRank);
      return Number.isInteger(rank) && rank >= 1 && rank <= maxRank ? [rank] : [];
    }
    return getMeaningfulSpellRanks(spell, { maxRank });
  }

  matchesTheme(spell, theme) {
    return spellMatchesMagicTheme(spell, theme);
  }
}

export const spellCandidateService = new SpellCandidateService();
