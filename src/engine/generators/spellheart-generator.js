import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";
import { getHighestRarity, getMeaningfulSpellRanks, isNormalSlottedSpell, isStaffCantrip } from "../spell-item-utils.js";
import { getMagicTheme, spellMatchesMagicTheme } from "../magic-themes.js";
import { registerCoreSpellheartProfiles, SpellheartProfileRegistry } from "../registries/spellheart-profile-registry.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function localize(formatter, key, fallback, data = {}) {
  if (!key) return fallback;
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback;
}

function profileVariantLabel(variant, formatter) {
  return localize(formatter, variant.label, variant.id, {});
}

function themeName(themeId, formatter) {
  const theme = getMagicTheme(themeId);
  return theme?.label ? localize(formatter, theme.label, themeId) : themeId;
}

function themeValue(profile, themeId, key, formatter) {
  const raw = profile.valuesByTheme?.[themeId]?.[key];
  if (typeof raw !== "string") return raw ?? null;
  return localize(formatter, raw, raw);
}

function multiplicities(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

/**
 * Spellheart generation has two deliberately separate paths:
 *  - existing: preserve a complete published PF2e spellheart unchanged
 *  - generated: compose a homebrew spellheart from a validated profile whose
 *    armor/weapon benefits and level progression are kept together as one
 *    balance unit.  Effects are rules text rather than mixed-and-matched Rule
 *    Elements, avoiding accidental combinations that published spellhearts do
 *    not support.
 */
export class SpellheartGenerator {
  constructor({
    compendiumIndex,
    spellheartProfiles = registerCoreSpellheartProfiles(new SpellheartProfileRegistry()),
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key
  } = {}) {
    this.id = "spellheart";
    this.mode = "magic";
    this.priority = 215;
    this.index = compendiumIndex;
    this.spellheartProfiles = spellheartProfiles;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.spellheart";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.spellheartMode === "generated"
      ? this.#generateCustom(request)
      : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.spellheart"));
    let candidates = pool.filter((entry) => levelAllowed(entry.level, request));
    const warnings = [];

    if (candidates.length === 0 && request.levelPolicy === "nearest" && pool.length > 0) {
      const bestDistance = Math.min(...pool.map((entry) => distanceToLevelRequest(entry.level, request.level)));
      candidates = pool.filter((entry) => distanceToLevelRequest(entry.level, request.level) === bestDistance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((entry) => entry.level))]
      });
    }

    if (candidates.length === 0) {
      const error = new Error("No predefined spellheart matches the request");
      error.code = "NO_PREDEFINED_SPELLHEART_CANDIDATE";
      error.details = { category: request.category, level: request.level, source: request.source };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    if (request.level.target != null) {
      const bestDistance = Math.min(...candidates.map((entry) => Math.abs(entry.level - request.level.target)));
      candidates = candidates.filter((entry) => Math.abs(entry.level - request.level.target) === bestDistance);
    }

    const selected = rng.pick(candidates);
    const document = await this.index.getDocument(selected);
    if (!document) {
      const error = new Error(`Could not load predefined spellheart ${selected.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof document.toObject === "function"
      ? document.toObject()
      : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      ...(itemSource.flags["pf2e-item-forge"] ?? {}),
      generated: false,
      generator: this.id,
      seed: request.seed,
      sourceUuid: selected.uuid,
      spellheart: { mode: "existing" }
    };

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "spellheart-existing",
        sourceItem: {
          name: selected.name,
          uuid: selected.uuid,
          level: selected.level,
          usage: selected.usage ?? null,
          traits: [...(selected.traits ?? [])]
        }
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
        magic: {
          kind: "spellheart",
          spellheartMode: "existing"
        },
        spellheart: {
          mode: "existing",
          usage: selected.usage ?? null,
          traits: [...(selected.traits ?? [])]
        }
      }
    };
  }

  async #generateCustom(request) {
    const spellPool = this.index.querySpells(request).filter((spell) =>
      (isNormalSlottedSpell(spell) || isStaffCantrip(spell)) && !spell.ritual && !spell.focus
    );
    const rng = new SeededRng(request.seed);
    const selection = this.#selectProfileVariantTheme(request, spellPool, rng);
    const { profile, variant, variantIndex, themeId, candidates, warnings } = selection;
    const spells = this.#selectSpells({ request, profile, variant, themeId, spellPool });

    const templateEntry = this.#getStructuralTemplate();
    if (!templateEntry) {
      const error = new Error("No PF2e spellheart template is available");
      error.code = "NO_SPELLHEART_TEMPLATE";
      throw error;
    }
    const templateDocument = await this.index.getDocument(templateEntry);
    if (!templateDocument) {
      const error = new Error(`Could not load spellheart template ${templateEntry.uuid}`);
      error.code = "ITEM_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const itemSource = typeof templateDocument.toObject === "function"
      ? templateDocument.toObject()
      : clone(templateDocument._source ?? templateDocument);
    const spellMetadata = spells.map((entry) => ({
      name: entry.spell.name,
      sourceUuid: entry.spell.uuid,
      sourcePack: entry.spell.pack,
      baseRank: entry.spell.baseRank,
      rank: entry.rank,
      cantrip: entry.cantrip,
      heightened: !entry.cantrip && entry.rank > entry.spell.baseRank
    }));
    const rarity = getHighestRarity(spells.map((entry) => entry.spell.rarity));
    const effects = this.#renderEffects(profile, variant, themeId);
    this.#composeGeneratedItem(itemSource, { request, profile, variant, variantIndex, themeId, spells, rarity, effects });

    const profileLabel = localize(this.formatter, profile.label, profile.id);
    const variantLabel = profileVariantLabel(variant, this.formatter);
    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "spellheart-generated",
        profile: { id: profile.id, label: profile.label },
        variant: { id: variant.id, label: variant.label, index: variantIndex, level: variant.level, price: variant.price },
        theme: themeId,
        effects,
        spells: spellMetadata
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: [...new Set(spells.map((entry) => entry.spell.pack))].join(", "),
        sourceUuid: templateEntry.uuid,
        level: variant.level,
        rarity,
        category: request.category,
        candidateCount: candidates.length,
        magic: {
          kind: "spellheart",
          spellheartMode: "generated",
          theme: themeId,
          profile: profile.id,
          profileLabel,
          variant: variant.id,
          variantLabel,
          spellDC: variant.spellDC,
          spellAttack: variant.spellAttack
        },
        spellheart: {
          mode: "generated",
          profile: profile.id,
          profileLabel,
          variant: variant.id,
          variantLabel,
          theme: themeId,
          level: variant.level,
          priceGp: variant.price,
          spellDC: variant.spellDC,
          spellAttack: variant.spellAttack,
          armorEffect: effects.armor,
          weaponEffect: effects.weapon,
          automation: "rules-text",
          spells: spellMetadata
        },
        spells: spellMetadata
      }
    };
  }

  #selectProfileVariantTheme(request, spellPool, rng) {
    const requestedProfile = request.magic?.spellheartProfile ?? "automatic";
    const requestedTheme = request.magic?.theme ?? "automatic";
    const profiles = requestedProfile === "automatic"
      ? this.spellheartProfiles.getAll()
      : [this.spellheartProfiles.get(requestedProfile)].filter(Boolean);
    if (!profiles.length) {
      const error = new Error(`Unknown spellheart profile ${requestedProfile}`);
      error.code = "UNKNOWN_SPELLHEART_PROFILE";
      throw error;
    }

    const structural = [];
    const all = [];
    for (const profile of profiles) {
      const themes = requestedTheme === "automatic"
        ? profile.allowedThemes
        : profile.allowedThemes.includes(requestedTheme) ? [requestedTheme] : [];
      for (let variantIndex = 0; variantIndex < profile.variants.length; variantIndex += 1) {
        const variant = profile.variants[variantIndex];
        for (const themeId of themes) {
          const candidate = { profile, variant, variantIndex, themeId };
          structural.push(candidate);
          if (this.#themeHasCoverage(themeId, variant, spellPool, request.magic?.allowHeightened !== false)) {
            all.push(candidate);
          }
        }
      }
    }

    if (!structural.length) {
      const error = new Error("No custom spellheart profile supports the requested theme");
      error.code = "NO_SPELLHEART_SPELL_CANDIDATE";
      error.details = { profile: requestedProfile, theme: requestedTheme, source: request.source };
      throw error;
    }

    const structuralAtLevel = structural.filter(({ variant }) => levelAllowed(variant.level, request));
    let candidates = all.filter(({ variant }) => levelAllowed(variant.level, request));
    const warnings = [];
    if (!candidates.length && structuralAtLevel.length > 0 && request.levelPolicy !== "nearest") {
      const error = new Error("No matching spells are available for the requested custom spellheart variant");
      error.code = "NO_SPELLHEART_SPELL_CANDIDATE";
      error.details = { profile: requestedProfile, theme: requestedTheme, level: request.level, source: request.source };
      throw error;
    }
    if (!candidates.length && request.levelPolicy === "nearest" && all.length > 0) {
      const distance = Math.min(...all.map(({ variant }) => distanceToLevelRequest(variant.level, request.level)));
      candidates = all.filter(({ variant }) => distanceToLevelRequest(variant.level, request.level) === distance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map(({ variant }) => variant.level))]
      });
    }
    if (!candidates.length) {
      const error = new Error(all.length ? "No custom spellheart variant matches the requested level" : "No custom spellheart profile has enough matching spells");
      error.code = all.length ? "NO_ITEM_IN_LEVEL_RANGE" : "NO_SPELLHEART_SPELL_CANDIDATE";
      error.details = { profile: requestedProfile, theme: requestedTheme, level: request.level, source: request.source };
      throw error;
    }

    if (request.level.target != null) {
      const bestDistance = Math.min(...candidates.map(({ variant }) => Math.abs(variant.level - request.level.target)));
      candidates = candidates.filter(({ variant }) => Math.abs(variant.level - request.level.target) === bestDistance);
    }

    const chosen = rng.pick(candidates);
    return { ...chosen, candidates, warnings };
  }

  #themeHasCoverage(themeId, variant, spellPool, allowHeightened) {
    const themed = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    if (!themed.some(isStaffCantrip)) return false;
    const slotted = themed.filter(isNormalSlottedSpell);
    const required = multiplicities(variant.dailyRanks);
    for (const [rank, count] of required) {
      const candidates = slotted.filter((spell) => {
        const ranks = allowHeightened ? getMeaningfulSpellRanks(spell, { maxRank: rank }) : [spell.baseRank];
        return ranks.includes(rank);
      });
      if (new Set(candidates.map((spell) => spell.uuid)).size < count) return false;
    }
    return true;
  }

  #selectSpells({ request, profile, variant, themeId, spellPool }) {
    const rng = new SeededRng(`${request.seed}:${profile.id}:${variant.id}:${themeId}`);
    const themed = spellPool.filter((spell) => spellMatchesMagicTheme(spell, themeId));
    const cantrips = themed.filter(isStaffCantrip);
    const slotted = themed.filter(isNormalSlottedSpell);
    const cantrip = rng.pick(cantrips);
    if (!cantrip) {
      const error = new Error("No themed cantrip is available for the custom spellheart");
      error.code = "NO_SPELLHEART_SPELL_CANDIDATE";
      throw error;
    }

    const selected = [{ spell: cantrip, rank: 0, cantrip: true, heightened: false }];
    const usedAtRank = new Map();
    for (const rank of variant.dailyRanks) {
      const available = slotted.filter((spell) => {
        const ranks = request.magic?.allowHeightened !== false
          ? getMeaningfulSpellRanks(spell, { maxRank: rank })
          : [spell.baseRank];
        return ranks.includes(rank) && !usedAtRank.get(rank)?.has(spell.uuid);
      });
      if (!available.length) {
        const error = new Error(`No themed spell is available at rank ${rank}`);
        error.code = "NO_SPELLHEART_SPELL_CANDIDATE";
        error.details = { profile: profile.id, variant: variant.id, theme: themeId, rank };
        throw error;
      }
      const spell = rng.pick(available);
      if (!usedAtRank.has(rank)) usedAtRank.set(rank, new Set());
      usedAtRank.get(rank).add(spell.uuid);
      selected.push({ spell, rank, cantrip: false, heightened: rank > spell.baseRank });
    }
    return selected;
  }

  #getStructuralTemplate() {
    const entries = (this.index.entries ?? []).filter((entry) => entry.categories?.includes?.("magic.spellheart"));
    const system = entries.filter((entry) => entry.packageType === "system" || entry.packageName === "pf2e");
    return system[0] ?? entries[0] ?? null;
  }

  #renderEffects(profile, variant, themeId) {
    const theme = themeName(themeId, this.formatter);
    const variantLabel = profileVariantLabel(variant, this.formatter);
    const data = {
      theme,
      variant: variantLabel,
      spellDC: variant.spellDC ?? "—",
      spellAttack: variant.spellAttack == null ? "—" : `+${variant.spellAttack}`,
      ...variant.values,
      damage: themeValue(profile, themeId, "damageLabel", this.formatter) ?? theme,
      rune: themeValue(profile, themeId, "runeLabel", this.formatter) ?? variant.values.weaponRune ?? "",
      weaponCondition: variant.values.weaponCondition
        ? localize(this.formatter, variant.values.weaponCondition, variant.values.weaponCondition)
        : ""
    };
    return {
      armor: localize(this.formatter, profile.armorText, "", data),
      weapon: localize(this.formatter, profile.weaponText, "", data),
      activation: localize(this.formatter, profile.activationText, "", data),
      description: localize(this.formatter, profile.description, "", data),
      data
    };
  }

  #composeGeneratedItem(itemSource, { request, profile, variant, variantIndex, themeId, spells, rarity, effects }) {
    itemSource._id = null;
    itemSource.name = localize(this.formatter, profile.nameTemplate,
      `Spellheart — ${themeName(themeId, this.formatter)}`,
      { theme: themeName(themeId, this.formatter), variant: profileVariantLabel(variant, this.formatter) });
    itemSource.img = "systems/pf2e/icons/default-icons/equipment.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level };
    itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} };
    itemSource.system.price.value = { gp: variant.price };
    itemSource.system.usage ??= { value: "affixed-to-armor-or-a-weapon" };
    itemSource.system.usage.value = "affixed-to-armor-or-a-weapon";
    itemSource.system.traits ??= { value: [], rarity: "common", otherTags: [] };
    itemSource.system.traits.value = [...new Set([
      "magical",
      "spellheart",
      ...(profile.itemTraitsByTheme?.[themeId] ?? [])
    ])].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;
    if (Array.isArray(itemSource.system.rules)) itemSource.system.rules = [];
    if (Object.hasOwn(itemSource.system, "slug")) itemSource.system.slug = null;

    const introParts = [];
    if (variant.spellAttack != null || variant.spellDC != null) {
      introParts.push(localize(this.formatter, "PF2E_ITEM_FORGE.SpellheartText.SpellStatistics",
        `Spells cast by activating this item use spell attack ${variant.spellAttack ?? "—"} and DC ${variant.spellDC ?? "—"}.`,
        { spellAttack: variant.spellAttack == null ? "—" : `+${variant.spellAttack}`, spellDC: variant.spellDC ?? "—" }));
    }
    const spellRows = spells.map((entry) => {
      const label = entry.cantrip
        ? localize(this.formatter, "PF2E_ITEM_FORGE.Magic.Cantrip", "Cantrip")
        : localize(this.formatter, "PF2E_ITEM_FORGE.Magic.SpellRankLabel", `Rank ${entry.rank}`, { rank: entry.rank });
      const suffix = entry.heightened
        ? ` (${localize(this.formatter, "PF2E_ITEM_FORGE.Magic.HeightenedShort", `heightened to rank ${entry.rank}`, { rank: entry.rank })})`
        : "";
      const frequency = entry.cantrip ? "" : ` <em>${localize(this.formatter, "PF2E_ITEM_FORGE.SpellheartText.OncePerDay", "once per day")}</em>`;
      return `<li><strong>${label}</strong>${frequency}: @UUID[${entry.spell.uuid}]{${entry.spell.name}}${suffix}</li>`;
    }).join("");

    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [
      `<p>${effects.description}</p>`,
      ...introParts.map((part) => `<p>${part}</p>`),
      `<ul><li><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.SpellheartText.Armor", "Armor")}</strong> ${effects.armor}</li><li><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.SpellheartText.Weapon", "Weapon")}</strong> ${effects.weapon}</li></ul>`,
      `<p><strong>${effects.activation}</strong></p>`,
      `<ul>${spellRows}</ul>`,
      `<p class="item-forge-note">${localize(this.formatter, "PF2E_ITEM_FORGE.SpellheartText.AutomationNote", "Attachment-specific benefits are stored as rules text; the generated item does not copy Rule Elements from an unrelated published spellheart.")}</p>`
    ].join("");

    const spellData = spells.map((entry) => ({
      uuid: entry.spell.uuid,
      name: entry.spell.name,
      baseRank: entry.spell.baseRank,
      rank: entry.rank,
      cantrip: entry.cantrip,
      heightened: entry.heightened
    }));
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = {
      generated: true,
      generator: this.id,
      seed: request.seed,
      spellheart: {
        mode: "generated",
        profile: profile.id,
        variant: variant.id,
        variantIndex,
        theme: themeId,
        level: variant.level,
        priceGp: variant.price,
        spellDC: variant.spellDC,
        spellAttack: variant.spellAttack,
        armorEffect: effects.armor,
        weaponEffect: effects.weapon,
        automation: "rules-text",
        spells: spellData
      }
    };
  }
}
