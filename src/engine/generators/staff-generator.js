import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";
import { getHighestRarity, getMeaningfulSpellRanks, isNormalSlottedSpell, isStaffCantrip } from "../spell-item-utils.js";
import { MAGIC_THEME_DEFINITIONS, getMagicTheme, spellMatchesMagicTheme } from "../magic-themes.js";
import { registerCoreStaffProfiles, StaffProfileRegistry } from "../registries/staff-profile-registry.js";
import { setSpecificSystemValue } from "../compendium-index.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

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

function localize(formatter, key, fallback, data = {}) {
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback;
}

function staffThemeName(themeId, formatter) {
  const theme = getMagicTheme(themeId);
  return theme?.label ? localize(formatter, theme.label, themeId) : themeId;
}

function variantRanks(profile, variantIndex) {
  return profile.variants
    .slice(0, variantIndex + 1)
    .flatMap((variant) => variant.ranks.map((rank) => rank.rank));
}

function maxRankForVariant(profile, variantIndex) {
  return Math.max(0, ...variantRanks(profile, variantIndex));
}

function profileLevels(profile) {
  return profile.variants.map((variant) => variant.level);
}

export class StaffGenerator {
  constructor({
    compendiumIndex,
    staffProfiles = registerCoreStaffProfiles(new StaffProfileRegistry()),
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "staff";
    this.mode = "magic";
    this.priority = 210;
    this.index = compendiumIndex;
    this.staffProfiles = staffProfiles;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.staff";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.staffMode === "existing"
      ? this.#generateExisting(request)
      : this.#generateFamily(request);
  }

  async #generateExisting(request) {
    const allCandidates = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.staff"));
    let candidates = allCandidates.filter((entry) => levelAllowed(entry.level, request));
    const warnings = [];

    if (!candidates.length && request.levelPolicy === "nearest" && allCandidates.length) {
      const distance = Math.min(...allCandidates.map((entry) => distanceToLevelRequest(entry.level, request.level)));
      candidates = allCandidates.filter((entry) => distanceToLevelRequest(entry.level, request.level) === distance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((entry) => entry.level))]
      });
    }

    if (!candidates.length) {
      const error = new Error("No predefined staff matches the request");
      error.code = allCandidates.length ? "NO_ITEM_IN_LEVEL_RANGE" : "NO_PREDEFINED_STAFF_CANDIDATE";
      error.details = { level: request.level, source: request.source };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    const target = request.level.target;
    const closest = target == null
      ? candidates
      : candidates.filter((entry) => {
          const best = Math.min(...candidates.map((candidate) => Math.abs(candidate.level - target)));
          return Math.abs(entry.level - target) === best;
        });
    const selected = rng.pick(closest);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined staff ${selected.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: false,
      generator: "staff",
      seed: request.seed,
      sourceUuid: selected.uuid,
      staff: { mode: "existing" }
    };

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "staff-existing",
        sourceItem: { name: selected.name, uuid: selected.uuid, level: selected.level }
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: selected.pack,
        sourceUuid: selected.uuid,
        level: selected.level,
        rarity: selected.rarity,
        category: request.category,
        candidateCount: candidates.length,
        magic: { kind: "staff", staffMode: "existing", theme: null },
        baseItem: { name: selected.name, uuid: selected.uuid, level: selected.level }
      }
    };
  }

  async #generateFamily(request) {
    const rng = new SeededRng(request.seed);
    const selection = this.#selectFamilyVariant(request, rng);
    const { profile, variantIndex, variant } = selection;
    const warnings = [...selection.warnings];
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
    const themeId = this.#resolveTheme(request.magic?.theme ?? "automatic", spellPool, profile, variantIndex, rng);
    if (!themeId) {
      const error = new Error("No staff theme has enough matching spells for the selected family profile");
      error.code = "NO_STAFF_SPELL_CANDIDATE";
      error.details = {
        theme: request.magic?.theme ?? "automatic",
        profile: profile.id,
        variant: variant.id,
        requiredRanks: variantRanks(profile, variantIndex)
      };
      throw error;
    }

    const themedPool = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    const family = this.#buildFamilyManifest({
      spellPool: themedPool,
      profile,
      variantIndex,
      allowHeightened: request.magic?.allowHeightened !== false,
      seed: request.seed
    });
    const spells = family.flatMap((tier) => tier.spells);

    const itemSource = typeof baseDocument.toObject === "function"
      ? baseDocument.toObject()
      : clone(baseDocument._source ?? baseDocument);
    this.#composeStaff(itemSource, { baseEntry, profile, variantIndex, variant, family, spells, themeId, request });

    const rarity = getHighestRarity(spells.map((entry) => entry.spell.rarity));
    const spellMetadata = spells.map((entry) => this.#spellMetadata(entry, variantIndex));
    const familyMetadata = family.map((tier) => ({
      variant: tier.variant.id,
      variantLabel: tier.variant.label,
      level: tier.variant.level,
      price: tier.variant.price,
      inherited: tier.tierIndex < variantIndex,
      spells: tier.spells.map((entry) => this.#spellMetadata(entry, variantIndex))
    }));

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "staff-family",
        theme: themeId,
        profile: { id: profile.id, label: profile.label, levels: profileLevels(profile) },
        variant: { id: variant.id, label: variant.label, index: variantIndex, level: variant.level, price: variant.price },
        baseItem: { name: baseEntry.name, uuid: baseEntry.uuid, level: baseEntry.level },
        family: familyMetadata,
        spells: spellMetadata
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: [...new Set(spells.map((entry) => entry.spell.pack))].join(", "),
        sourceUuid: baseEntry.uuid,
        level: variant.level,
        rarity,
        category: request.category,
        candidateCount: themedPool.length,
        magic: {
          kind: "staff",
          staffMode: "generated",
          theme: themeId,
          profile: profile.id,
          profileLevels: profileLevels(profile),
          variant: variant.id,
          variantLabel: variant.label,
          maxRank: maxRankForVariant(profile, variantIndex)
        },
        spells: spellMetadata,
        staffFamily: familyMetadata,
        baseItem: { name: baseEntry.name, uuid: baseEntry.uuid, level: baseEntry.level }
      }
    };
  }

  #selectFamilyVariant(request, rng) {
    const requestedProfile = request.magic?.staffProfile ?? "automatic";
    const profiles = requestedProfile === "automatic"
      ? this.staffProfiles.getAll()
      : [this.staffProfiles.get(requestedProfile)].filter(Boolean);

    if (!profiles.length) {
      const error = new Error(`Unknown staff family profile ${requestedProfile}`);
      error.code = "UNKNOWN_STAFF_PROFILE";
      throw error;
    }

    const all = profiles.flatMap((profile) => profile.variants.map((variant, variantIndex) => ({ profile, variant, variantIndex })));
    let candidates = all.filter(({ variant }) => levelAllowed(variant.level, request));
    const warnings = [];

    if (!candidates.length && request.levelPolicy === "nearest" && all.length) {
      const distance = Math.min(...all.map(({ variant }) => distanceToLevelRequest(variant.level, request.level)));
      candidates = all.filter(({ variant }) => distanceToLevelRequest(variant.level, request.level) === distance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map(({ variant }) => variant.level))]
      });
    }

    if (!candidates.length) {
      const error = new Error("No generated staff family variant matches the requested item level");
      error.code = "NO_ITEM_IN_LEVEL_RANGE";
      error.details = {
        level: request.level,
        profile: requestedProfile,
        availableLevels: [...new Set(all.map(({ variant }) => variant.level))].sort((a, b) => a - b)
      };
      throw error;
    }

    const target = request.level.target;
    if (target != null) {
      const distance = Math.min(...candidates.map(({ variant }) => Math.abs(variant.level - target)));
      candidates = candidates.filter(({ variant }) => Math.abs(variant.level - target) === distance);
    }

    const selected = rng.pick(candidates);
    return { ...selected, warnings };
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

  #resolveTheme(requestedTheme, spellPool, profile, variantIndex, rng) {
    if (requestedTheme !== "automatic") {
      const theme = getMagicTheme(requestedTheme);
      if (!theme) return null;
      return this.#themeHasCoverage(theme.id, spellPool, profile, variantIndex) ? theme.id : null;
    }

    const themes = MAGIC_THEME_DEFINITIONS
      .filter((theme) => !theme.automatic)
      .filter((theme) => this.#themeHasCoverage(theme.id, spellPool, profile, variantIndex));
    if (!themes.length) return null;

    return weightedPick(rng, themes, (theme) => {
      const pool = spellPool.filter((spell) => spellMatchesMagicTheme(spell, theme));
      const directTraitBonus = theme.traits?.length || theme.traitsAny?.length ? 1.3 : 1;
      return Math.min(10, pool.length) * directTraitBonus;
    })?.id ?? null;
  }

  #themeHasCoverage(themeId, spellPool, profile, variantIndex) {
    const themed = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    const slotted = themed.filter(isNormalSlottedSpell);
    const maxRank = maxRankForVariant(profile, variantIndex);
    return variantRanks(profile, variantIndex).every((rank) => slotted.some((spell) =>
      getMeaningfulSpellRanks(spell, { maxRank }).includes(rank)
    ));
  }

  #buildFamilyManifest({ spellPool, profile, variantIndex, allowHeightened, seed }) {
    const cantrips = spellPool.filter(isStaffCantrip);
    const slotted = spellPool.filter(isNormalSlottedSpell);
    const family = [];
    const usedAtLowerRank = new Set();
    const maxRank = maxRankForVariant(profile, variantIndex);

    for (let tierIndex = 0; tierIndex <= variantIndex; tierIndex += 1) {
      const variant = profile.variants[tierIndex];
      const tierRng = new SeededRng(`${seed}:${profile.id}:${tierIndex}`);
      const tierSpells = [];

      if (tierIndex === 0 && variant.cantrip && cantrips.length) {
        const cantrip = tierRng.pick(cantrips);
        tierSpells.push({ spell: cantrip, rank: 0, cantrip: true, tierIndex, variantId: variant.id });
        usedAtLowerRank.add(cantrip.uuid);
      }

      for (const rankSpec of variant.ranks) {
        const candidates = slotted
          .filter((spell) => {
            const ranks = allowHeightened ? getMeaningfulSpellRanks(spell, { maxRank }) : [spell.baseRank];
            return ranks.includes(rankSpec.rank);
          })
          .map((spell) => ({ spell, rank: rankSpec.rank, cantrip: false, heightened: rankSpec.rank > spell.baseRank }));

        if (!candidates.length) {
          const error = new Error(`No spell candidate for staff rank ${rankSpec.rank}`);
          error.code = "NO_STAFF_SPELL_CANDIDATE";
          error.details = { profile: profile.id, variant: variant.id, rank: rankSpec.rank };
          throw error;
        }

        const availableCount = Math.min(rankSpec.max, candidates.length);
        let desired = Math.min(rankSpec.min, availableCount);
        for (let count = desired; count < availableCount; count += 1) {
          if (tierRng.random() < 0.55) desired += 1;
          else break;
        }

        const rankUsed = new Set();
        for (let slot = 0; slot < desired; slot += 1) {
          const available = candidates.filter((candidate) => !rankUsed.has(candidate.spell.uuid));
          if (!available.length) break;
          const selected = weightedPick(tierRng, available, (candidate) => {
            let weight = 1;
            if (usedAtLowerRank.has(candidate.spell.uuid) && candidate.heightened) weight *= 2.25;
            else if (usedAtLowerRank.has(candidate.spell.uuid)) weight *= 0.35;
            if (candidate.spell.baseRank === candidate.rank) weight *= 1.15;
            return weight;
          });
          if (!selected) break;
          tierSpells.push({ ...selected, tierIndex, variantId: variant.id });
          rankUsed.add(selected.spell.uuid);
        }

        for (const selected of tierSpells.filter((entry) => entry.rank === rankSpec.rank)) {
          usedAtLowerRank.add(selected.spell.uuid);
        }
      }

      family.push({ tierIndex, variant, spells: tierSpells });
    }

    return family;
  }

  #spellMetadata(entry, selectedVariantIndex) {
    return {
      name: entry.spell.name,
      sourceUuid: entry.spell.uuid,
      sourcePack: entry.spell.pack,
      baseRank: entry.spell.baseRank,
      rank: entry.rank,
      cantrip: entry.cantrip,
      heightened: !entry.cantrip && entry.rank > entry.spell.baseRank,
      introducedIn: entry.variantId,
      inherited: entry.tierIndex < selectedVariantIndex
    };
  }

  #composeStaff(itemSource, { baseEntry, profile, variantIndex, variant, family, spells, themeId, request }) {
    itemSource._id = null;
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];
    itemSource.system.traits.value = [...new Set([...itemSource.system.traits.value, "magical", "staff"])].sort();
    const rarity = getHighestRarity(spells.map((entry) => entry.spell.rarity));
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;
    if (itemSource.system.runes) itemSource.system.runes = { potency: 0, striking: 0, property: [] };
    setSpecificSystemValue(itemSource.system);

    const themeName = staffThemeName(themeId, this.formatter);
    const variantNameKey = variantIndex === 0
      ? "PF2E_ITEM_FORGE.Magic.StaffName"
      : variantIndex === 1
        ? "PF2E_ITEM_FORGE.Magic.GreaterStaffName"
        : "PF2E_ITEM_FORGE.Magic.MajorStaffName";
    const fallback = `${variantIndex === 1 ? "Greater " : variantIndex >= 2 ? "Major " : ""}Staff — ${themeName}`;
    itemSource.name = localize(this.formatter, variantNameKey, fallback, { theme: themeName });

    const byRank = new Map();
    for (const entry of spells) {
      const key = entry.cantrip ? 0 : entry.rank;
      if (!byRank.has(key)) byRank.set(key, []);
      byRank.get(key).push(entry);
    }
    const rows = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([rank, entries]) => {
      const label = rank === 0
        ? localize(this.formatter, "PF2E_ITEM_FORGE.Magic.Cantrip", "Cantrip")
        : localize(this.formatter, "PF2E_ITEM_FORGE.Magic.SpellRankLabel", `Rank ${rank}`, { rank });
      const links = entries.map((entry) => {
        const suffix = entry.rank > entry.spell.baseRank
          ? ` (${localize(this.formatter, "PF2E_ITEM_FORGE.Magic.HeightenedShort", `heightened ${entry.rank}`, { rank: entry.rank })})`
          : "";
        return `@UUID[${entry.spell.uuid}]{${entry.spell.name}}${suffix}`;
      }).join(", ");
      return `<li><strong>${label}</strong>: ${links}</li>`;
    }).join("");

    const generic = itemSource.system.description?.value ?? "";
    const intro = localize(this.formatter, "PF2E_ITEM_FORGE.Magic.GeneratedStaffFamilyDescription",
      `This generated staff belongs to a rulebook-style staff family themed around ${themeName}. The selected variant includes the spells introduced by all earlier variants in the family.`,
      { theme: themeName, levels: profileLevels(profile).join(" → ") });
    const activation = localize(this.formatter, "PF2E_ITEM_FORGE.Magic.StaffActivation",
      "Activate — Cast a Spell: Expend charges equal to the spell rank to cast a spell from the list. Cantrips expend no charges.");
    const profileText = localize(this.formatter, "PF2E_ITEM_FORGE.Magic.StaffFamilyProfileDescription",
      `Family progression: ${profileLevels(profile).join(" → ")}.`, { levels: profileLevels(profile).join(" → ") });
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = `<p>${intro}</p><p>${profileText}</p><p><strong>${activation}</strong></p><ul>${rows}</ul>${generic ? `<hr>${generic}` : ""}`;

    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      generated: true,
      generator: "staff",
      seed: request.seed,
      baseItemUuid: baseEntry.uuid,
      staff: {
        mode: "generated-family",
        theme: themeId,
        profile: profile.id,
        profileLevels: profileLevels(profile),
        variant: variant.id,
        variantIndex,
        level: variant.level,
        maxRank: maxRankForVariant(profile, variantIndex),
        priceGp: variant.price,
        family: family.map((tier) => ({
          variant: tier.variant.id,
          level: tier.variant.level,
          priceGp: tier.variant.price,
          spells: tier.spells.map((entry) => ({
            uuid: entry.spell.uuid,
            name: entry.spell.name,
            baseRank: entry.spell.baseRank,
            rank: entry.rank,
            cantrip: entry.cantrip,
            heightened: !entry.cantrip && entry.rank > entry.spell.baseRank
          }))
        })),
        spells: spells.map((entry) => ({
          uuid: entry.spell.uuid,
          name: entry.spell.name,
          baseRank: entry.spell.baseRank,
          rank: entry.rank,
          cantrip: entry.cantrip,
          heightened: !entry.cantrip && entry.rank > entry.spell.baseRank,
          introducedIn: entry.variantId
        }))
      }
    };
  }
}

export const CORE_STAFF_PROFILE_LEVELS = {
  "core.3-8-12": [3, 8, 12],
  "core.4-8-12": [4, 8, 12],
  "core.6-10-14": [6, 10, 14]
};
