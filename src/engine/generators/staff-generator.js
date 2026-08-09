import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";
import { getHighestRarity, getMeaningfulSpellRanks, isNormalSlottedSpell, isStaffCantrip } from "../spell-item-utils.js";
import { MAGIC_THEME_DEFINITIONS, getMagicTheme, spellMatchesMagicTheme } from "../magic-themes.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

const STAFF_PROFILES = [
  { level: 3, maxRank: 1, price: 60 },
  { level: 4, maxRank: 1, price: 90 },
  { level: 6, maxRank: 2, price: 230 },
  { level: 8, maxRank: 3, price: 450 },
  { level: 10, maxRank: 4, price: 900 },
  { level: 12, maxRank: 5, price: 1800 },
  { level: 14, maxRank: 6, price: 4000 },
  { level: 16, maxRank: 7, price: 9200 },
  { level: 18, maxRank: 8, price: 24000 },
  { level: 20, maxRank: 9, price: 70000 }
];

function weightedPick(rng, entries, weightFn) {
  if (!entries.length) return null;
  const weighted = entries.map((entry) => ({ entry, weight: Math.max(0, Number(weightFn(entry)) || 0) }));
  const total = weighted.reduce((sum, current) => sum + current.weight, 0);
  if (total <= 0) return rng.pick(entries);
  let cursor = rng.random() * total;
  for (const current of weighted) {
    cursor -= current.weight;
    if (cursor <= 0) return current.entry;
  }
  return weighted.at(-1).entry;
}

function staffThemeName(themeId, formatter) {
  const theme = getMagicTheme(themeId);
  const label = theme?.label ? formatter?.(theme.label, {}) : null;
  if (label && label !== theme.label) return label;
  return themeId;
}

export class StaffGenerator {
  constructor({
    compendiumIndex,
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "staff";
    this.mode = "magic";
    this.priority = 210;
    this.index = compendiumIndex;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.staff";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    const profileSelection = this.#selectProfile(request);
    const profile = profileSelection.profile;
    const warnings = [...profileSelection.warnings];
    const rng = new SeededRng(request.seed);
    const baseEntry = this.#getBaseStaffEntry();
    if (!baseEntry) {
      const error = new Error("No ordinary staff weapon template is available");
      error.code = "NO_STAFF_BASE_ITEM";
      throw error;
    }
    const baseDocument = await this.index.getDocument(baseEntry);
    if (!baseDocument) {
      const error = new Error(`Could not load staff base item ${baseEntry.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const spellPool = this.index.querySpells(request).filter((spell) =>
      (isNormalSlottedSpell(spell) || isStaffCantrip(spell)) && !spell.ritual && !spell.focus
    );
    const themeId = this.#resolveTheme(request.magic?.theme ?? "automatic", spellPool, profile, rng);
    if (!themeId) {
      const error = new Error("No staff theme has enough matching spells");
      error.code = "NO_STAFF_SPELL_CANDIDATE";
      error.details = { theme: request.magic?.theme ?? "automatic", maxRank: profile.maxRank };
      throw error;
    }

    const themedPool = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    const spells = this.#buildSpellManifest(themedPool, profile, request.magic?.allowHeightened !== false, rng);
    if (!spells.some((entry) => !entry.cantrip)) {
      const error = new Error("No staff spell candidate matches the selected theme and level");
      error.code = "NO_STAFF_SPELL_CANDIDATE";
      error.details = { theme: themeId, maxRank: profile.maxRank };
      throw error;
    }

    const itemSource = typeof baseDocument.toObject === "function"
      ? baseDocument.toObject()
      : clone(baseDocument._source ?? baseDocument);
    this.#composeStaff(itemSource, { baseEntry, profile, spells, themeId, request });

    const rarity = getHighestRarity(spells.map((entry) => entry.spell.rarity));
    const spellMetadata = spells.map((entry) => ({
      name: entry.spell.name,
      sourceUuid: entry.spell.uuid,
      sourcePack: entry.spell.pack,
      baseRank: entry.spell.baseRank,
      rank: entry.rank,
      cantrip: entry.cantrip,
      heightened: !entry.cantrip && entry.rank > entry.spell.baseRank
    }));

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "staff",
        theme: themeId,
        profile: { ...profile },
        baseItem: { name: baseEntry.name, uuid: baseEntry.uuid, level: baseEntry.level },
        spells: spellMetadata
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: [...new Set(spells.map((entry) => entry.spell.pack))].join(", "),
        sourceUuid: baseEntry.uuid,
        level: profile.level,
        rarity,
        category: request.category,
        candidateCount: themedPool.length,
        magic: { kind: "staff", theme: themeId, maxRank: profile.maxRank },
        spells: spellMetadata,
        baseItem: { name: baseEntry.name, uuid: baseEntry.uuid, level: baseEntry.level }
      }
    };
  }

  #selectProfile(request) {
    let candidates = STAFF_PROFILES.filter((profile) => levelAllowed(profile.level, request));
    const warnings = [];
    if (!candidates.length && request.levelPolicy === "nearest") {
      const distance = Math.min(...STAFF_PROFILES.map((profile) => distanceToLevelRequest(profile.level, request.level)));
      candidates = STAFF_PROFILES.filter((profile) => distanceToLevelRequest(profile.level, request.level) === distance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: candidates.map((profile) => profile.level)
      });
    }
    if (!candidates.length) {
      const error = new Error("No generated staff profile matches the requested item level");
      error.code = "NO_ITEM_IN_LEVEL_RANGE";
      error.details = { level: request.level, availableLevels: STAFF_PROFILES.map((profile) => profile.level) };
      throw error;
    }
    const target = request.level.target;
    const profile = target == null
      ? candidates[0]
      : [...candidates].sort((a, b) => Math.abs(a.level - target) - Math.abs(b.level - target) || a.level - b.level)[0];
    return { profile, warnings };
  }

  #getBaseStaffEntry() {
    const systemEntries = this.index.entries.filter((entry) => entry.type === "weapon" && (entry.packageType === "system" || entry.packageName === "pf2e"));
    const allEntries = this.index.entries.filter((entry) => entry.type === "weapon");
    const matches = (entry) => {
      const slug = String(entry.slug ?? "");
      const baseItem = String(entry.baseItem ?? "");
      return entry.level === 0 && (baseItem === "staff" || slug === "staff" || slug === "quarterstaff");
    };
    return systemEntries.find(matches) ?? allEntries.find(matches) ?? null;
  }

  #resolveTheme(requestedTheme, spellPool, profile, rng) {
    if (requestedTheme !== "automatic") {
      const theme = getMagicTheme(requestedTheme);
      if (!theme) return null;
      return this.#themeHasCoverage(theme.id, spellPool, profile) ? theme.id : null;
    }

    const themes = MAGIC_THEME_DEFINITIONS
      .filter((theme) => !theme.automatic)
      .filter((theme) => this.#themeHasCoverage(theme.id, spellPool, profile));
    if (!themes.length) return null;

    return weightedPick(rng, themes, (theme) => {
      const pool = spellPool.filter((spell) => spellMatchesMagicTheme(spell, theme));
      const directTraitBonus = theme.traits?.length || theme.traitsAny?.length ? 1.3 : 1;
      return Math.min(8, pool.length) * directTraitBonus;
    })?.id ?? null;
  }

  #themeHasCoverage(themeId, spellPool, profile) {
    const themed = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    const slotted = themed.filter(isNormalSlottedSpell);
    if (!slotted.length) return false;
    const topRankCandidates = slotted.filter((spell) =>
      getMeaningfulSpellRanks(spell, { maxRank: profile.maxRank }).includes(profile.maxRank)
    );
    return topRankCandidates.length > 0;
  }

  #buildSpellManifest(spellPool, profile, allowHeightened, rng) {
    const cantrips = spellPool.filter(isStaffCantrip);
    const slotted = spellPool.filter(isNormalSlottedSpell);
    const manifest = [];
    const used = new Set();

    if (cantrips.length) {
      const cantrip = rng.pick(cantrips);
      manifest.push({ spell: cantrip, rank: 0, cantrip: true });
      used.add(cantrip.uuid);
    }

    for (let rank = 1; rank <= profile.maxRank; rank += 1) {
      const desired = rank >= Math.max(1, profile.maxRank - 1) ? 2 : 1;
      const candidates = slotted
        .filter((spell) => {
          const ranks = allowHeightened ? getMeaningfulSpellRanks(spell, { maxRank: profile.maxRank }) : [spell.baseRank];
          return ranks.includes(rank);
        })
        .map((spell) => ({ spell, rank, cantrip: false, heightened: rank > spell.baseRank }));

      const rankUsed = new Set();
      for (let slot = 0; slot < desired && candidates.length; slot += 1) {
        const available = candidates.filter((candidate) => !rankUsed.has(candidate.spell.uuid));
        if (!available.length) break;
        const selected = weightedPick(rng, available, (candidate) => {
          let weight = used.has(candidate.spell.uuid) ? 0.45 : 1;
          if (candidate.heightened && used.has(candidate.spell.uuid)) weight *= 1.6;
          if (rank === profile.maxRank) weight *= 1.3;
          return weight;
        });
        if (!selected) break;
        manifest.push(selected);
        used.add(selected.spell.uuid);
        rankUsed.add(selected.spell.uuid);
      }
    }

    return manifest.sort((a, b) => a.rank - b.rank || a.spell.name.localeCompare(b.spell.name));
  }

  #composeStaff(itemSource, { baseEntry, profile, spells, themeId, request }) {
    itemSource._id = null;
    itemSource.system ??= {};
    itemSource.system.level ??= { value: profile.level };
    itemSource.system.level.value = profile.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: profile.price };
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];
    itemSource.system.traits.value = [...new Set([...itemSource.system.traits.value, "magical", "staff"])].sort();
    const rarity = getHighestRarity(spells.map((entry) => entry.spell.rarity));
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;
    if (itemSource.system.runes) {
      itemSource.system.runes = { potency: 0, striking: 0, property: [] };
    }
    if (itemSource.system.specific?.value !== undefined) itemSource.system.specific.value = false;

    const themeName = staffThemeName(themeId, this.formatter);
    const localizedName = this.formatter?.("PF2E_ITEM_FORGE.Magic.StaffName", { theme: themeName });
    itemSource.name = localizedName && localizedName !== "PF2E_ITEM_FORGE.Magic.StaffName"
      ? localizedName
      : `Staff of ${themeName}`;

    const byRank = new Map();
    for (const entry of spells) {
      const key = entry.cantrip ? 0 : entry.rank;
      if (!byRank.has(key)) byRank.set(key, []);
      byRank.get(key).push(entry);
    }
    const rows = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([rank, entries]) => {
      const label = rank === 0
        ? this.formatter?.("PF2E_ITEM_FORGE.Magic.Cantrip", {}) ?? "Cantrip"
        : this.formatter?.("PF2E_ITEM_FORGE.Magic.SpellRankLabel", { rank }) ?? `Rank ${rank}`;
      const links = entries.map((entry) => {
        const suffix = entry.rank > entry.spell.baseRank
          ? ` (${this.formatter?.("PF2E_ITEM_FORGE.Magic.HeightenedShort", { rank: entry.rank }) ?? `heightened ${entry.rank}`})`
          : "";
        return `@UUID[${entry.spell.uuid}]{${entry.spell.name}}${suffix}`;
      }).join(", ");
      return `<li><strong>${label}</strong>: ${links}</li>`;
    }).join("");

    const generic = itemSource.system.description?.value ?? "";
    const intro = this.formatter?.("PF2E_ITEM_FORGE.Magic.GeneratedStaffDescription", { theme: themeName })
      ?? `A generated thematic staff of ${themeName}.`;
    const activation = this.formatter?.("PF2E_ITEM_FORGE.Magic.StaffActivation", {})
      ?? "Cast a Spell; expend charges equal to the spell rank.";
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = `<p>${intro}</p><p><strong>${activation}</strong></p><ul>${rows}</ul>${generic ? `<hr>${generic}` : ""}`;

    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      generated: true,
      generator: "staff",
      seed: request.seed,
      baseItemUuid: baseEntry.uuid,
      staff: {
        theme: themeId,
        level: profile.level,
        maxRank: profile.maxRank,
        priceGp: profile.price,
        spells: spells.map((entry) => ({
          uuid: entry.spell.uuid,
          name: entry.spell.name,
          baseRank: entry.spell.baseRank,
          rank: entry.rank,
          cantrip: entry.cantrip,
          heightened: !entry.cantrip && entry.rank > entry.spell.baseRank
        }))
      }
    };
  }
}

export { STAFF_PROFILES };
