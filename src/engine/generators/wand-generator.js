import { SeededRng } from "../seeded-rng.js";
import { distanceToLevelRequest, levelAllowed } from "../item-level-resolver.js";
import { getMeaningfulSpellRanks, getHighestRarity, isNormalSlottedSpell, spellSourceAtRank } from "../spell-item-utils.js";
import { spellMatchesMagicTheme } from "../magic-themes.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function fallbackRandomId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

export class WandGenerator {
  constructor({
    compendiumIndex,
    wandProfiles = null,
    configProvider = () => globalThis.CONFIG,
    uuidResolver = (uuid) => globalThis.fromUuid?.(uuid),
    randomId = () => globalThis.foundry?.utils?.randomID?.() ?? fallbackRandomId(),
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? null
  } = {}) {
    this.id = "wand";
    this.mode = "magic";
    this.priority = 220;
    this.index = compendiumIndex;
    this.wandProfiles = wandProfiles;
    this.configProvider = configProvider;
    this.uuidResolver = uuidResolver;
    this.randomId = randomId;
    this.formatter = formatter;
    this.templateCache = new Map();
  }

  supports(request) {
    return request.mode === "magic" && request.category === "magic.wand";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();

    const theme = request.magic?.theme ?? "automatic";
    const allowHeightened = request.magic?.allowHeightened !== false;
    const wandMode = request.magic?.wandMode === "special" ? "special" : "standard";
    const selectedProfileId = request.magic?.wandProfile ?? "automatic";
    const profiles = this.#resolveProfiles(wandMode, selectedProfileId);
    const spellPool = this.index.querySpells(request)
      .filter(isNormalSlottedSpell)
      .filter((spell) => spellMatchesMagicTheme(spell, theme));
    const allCandidates = [];

    for (const spell of spellPool) {
      const ranks = allowHeightened ? getMeaningfulSpellRanks(spell, { maxRank: 9 }) : [spell.baseRank];
      for (const rank of ranks) {
        if (rank < 1 || rank > 9) continue;
        const template = await this.#getTemplate(rank);
        if (!template) continue;

        if (wandMode === "standard") {
          allCandidates.push({
            spell,
            rank,
            template,
            profile: null,
            variant: null,
            itemLevel: Number(template.source?.system?.level?.value ?? 0)
          });
          continue;
        }

        for (const profile of profiles) {
          const variant = profile.variants.find((entry) => entry.rank === rank);
          if (!variant || !this.#spellCompatibleWithProfile(spell, profile)) continue;
          allCandidates.push({ spell, rank, template, profile, variant, itemLevel: variant.level });
        }
      }
    }

    let candidates = allCandidates.filter((candidate) => levelAllowed(candidate.itemLevel, request));
    const warnings = [];
    if (candidates.length === 0 && request.levelPolicy === "nearest" && allCandidates.length > 0) {
      const bestDistance = Math.min(...allCandidates.map((candidate) => distanceToLevelRequest(candidate.itemLevel, request.level)));
      candidates = allCandidates.filter((candidate) => distanceToLevelRequest(candidate.itemLevel, request.level) === bestDistance);
      warnings.push({
        code: "LEVEL_TARGET_APPROXIMATED",
        requested: { ...request.level },
        actualLevels: [...new Set(candidates.map((candidate) => candidate.itemLevel))]
      });
    }

    if (candidates.length === 0) {
      const error = new Error("No wand spell candidate matches the request");
      error.code = allCandidates.length === 0
        ? (wandMode === "special" ? "NO_SPECIAL_WAND_SPELL_CANDIDATE" : "NO_WAND_SPELL_CANDIDATE")
        : "NO_ITEM_IN_LEVEL_RANGE";
      error.details = {
        category: request.category,
        level: request.level,
        source: request.source,
        theme,
        wandMode,
        wandProfile: selectedProfileId
      };
      throw error;
    }

    const rng = new SeededRng(request.seed);
    const candidate = rng.pick(candidates);
    const spellDocument = await this.index.getSpellDocument(candidate.spell);
    if (!spellDocument) {
      const error = new Error(`Could not load selected spell ${candidate.spell.uuid}`);
      error.code = "SPELL_DOCUMENT_NOT_FOUND";
      throw error;
    }

    const spellSource = typeof spellDocument.toObject === "function"
      ? spellDocument.toObject()
      : clone(spellDocument._source ?? spellDocument);
    const itemSource = this.#composeWand(candidate, spellSource, { wandMode, theme });
    const profileMetadata = candidate.profile
      ? {
          profile: candidate.profile.id,
          profileLabel: candidate.profile.label,
          effect: this.#formatText(candidate.profile.effectText, { spell: candidate.spell.name, rank: candidate.rank }),
          automation: candidate.profile.automation,
          priceGp: candidate.variant.price
        }
      : {};

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "wand",
        wandMode,
        theme,
        ...profileMetadata,
        spell: {
          name: candidate.spell.name,
          sourceUuid: candidate.spell.uuid,
          baseRank: candidate.spell.baseRank,
          rank: candidate.rank,
          heightened: candidate.rank > candidate.spell.baseRank
        }
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: candidate.spell.pack,
        sourceUuid: candidate.spell.uuid,
        templateUuid: candidate.template.uuid,
        level: candidate.itemLevel,
        rarity: candidate.spell.rarity,
        category: request.category,
        candidateCount: candidates.length,
        magic: {
          kind: "wand",
          wandMode,
          theme,
          profile: candidate.profile?.id ?? null,
          profileLabel: candidate.profile?.label ?? null
        },
        wand: candidate.profile
          ? {
              mode: "special",
              profile: candidate.profile.id,
              profileLabel: candidate.profile.label,
              effect: profileMetadata.effect,
              automation: candidate.profile.automation,
              rank: candidate.rank,
              level: candidate.itemLevel,
              priceGp: candidate.variant.price
            }
          : { mode: "standard", rank: candidate.rank, level: candidate.itemLevel },
        spell: {
          name: candidate.spell.name,
          sourcePack: candidate.spell.pack,
          sourceUuid: candidate.spell.uuid,
          baseRank: candidate.spell.baseRank,
          rank: candidate.rank,
          heightened: candidate.rank > candidate.spell.baseRank
        }
      }
    };
  }

  #resolveProfiles(wandMode, selectedProfileId) {
    if (wandMode !== "special") return [];
    const all = this.wandProfiles?.getAll?.() ?? [];
    if (selectedProfileId === "automatic") return all;
    const profile = this.wandProfiles?.get?.(selectedProfileId) ?? null;
    if (!profile) {
      const error = new Error(`Unknown wand profile: ${selectedProfileId}`);
      error.code = "UNKNOWN_WAND_PROFILE";
      error.details = { wandProfile: selectedProfileId };
      throw error;
    }
    return [profile];
  }

  #spellCompatibleWithProfile(spell, profile) {
    const rules = profile.compatibility ?? {};
    if (rules.requiresDamage && !spell.hasDamage) return false;
    if (rules.castActions?.length && !rules.castActions.includes(spell.castActions)) return false;
    const traits = new Set(spell.traits ?? []);
    if ((rules.forbiddenTraits ?? []).some((trait) => traits.has(trait))) return false;
    return true;
  }

  async #getTemplate(rank) {
    if (this.templateCache.has(rank)) return this.templateCache.get(rank);
    const config = this.configProvider?.();
    const wandConfig = config?.PF2E?.spellcastingItems?.wand;
    const uuid = wandConfig?.compendiumUuids?.[rank] ?? wandConfig?.compendiumUuids?.[String(rank)] ?? null;
    if (!uuid) {
      this.templateCache.set(rank, null);
      return null;
    }
    const document = await this.uuidResolver?.(uuid);
    const source = document?.type === "consumable" && typeof document.toObject === "function"
      ? document.toObject()
      : null;
    const template = source ? { uuid, source } : null;
    this.templateCache.set(rank, template);
    return template;
  }

  #composeWand(candidate, spellSource, { wandMode }) {
    const itemSource = clone(candidate.template.source);
    itemSource._id = null;
    itemSource.system ??= {};
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];

    const spellTraits = spellSource.system?.traits?.value ?? [];
    itemSource.system.traits.value = [...new Set([...itemSource.system.traits.value, ...spellTraits])].sort();
    const rarity = getHighestRarity([candidate.spell.rarity]);
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;

    if (wandMode === "special" && candidate.profile && candidate.variant) {
      itemSource.system.level ??= { value: candidate.variant.level };
      itemSource.system.level.value = candidate.variant.level;
      itemSource.system.price ??= { value: {} };
      itemSource.system.price.value = { gp: candidate.variant.price };
      itemSource.name = this.#formatText(candidate.profile.nameTemplate, {
        spell: candidate.spell.name,
        rank: candidate.rank
      }) || `${candidate.profile.id}: ${candidate.spell.name} (Rank ${candidate.rank})`;
    } else {
      const wandConfig = this.configProvider?.()?.PF2E?.spellcastingItems?.wand;
      const formattedName = wandConfig?.nameTemplate
        ? this.formatter?.(wandConfig.nameTemplate, { name: candidate.spell.name, level: candidate.rank })
        : null;
      itemSource.name = formattedName || `Wand: ${candidate.spell.name} (Rank ${candidate.rank})`;
    }

    const genericDescription = itemSource.system.description?.value ?? "";
    const spellLink = `@UUID[${candidate.spell.uuid}]{${candidate.spell.name}}`;
    itemSource.system.description ??= { value: "" };
    if (wandMode === "special" && candidate.profile) {
      const description = this.#formatText(candidate.profile.description, { spell: candidate.spell.name, rank: candidate.rank });
      const effect = this.#formatText(candidate.profile.effectText, { spell: candidate.spell.name, rank: candidate.rank });
      itemSource.system.description.value = [
        description ? `<p>${description}</p>` : "",
        `<p><strong>${spellLink}</strong></p>`,
        effect ? `<p>${effect}</p>` : "",
        genericDescription ? `<hr>${genericDescription}` : ""
      ].filter(Boolean).join("");
    } else {
      itemSource.system.description.value = `<p>${spellLink}</p><hr>${genericDescription}`;
    }
    itemSource.system.spell = spellSourceAtRank({ toObject: () => spellSource }, candidate.rank, this.randomId);

    if (wandMode === "special" && candidate.profile && candidate.variant) {
      itemSource.flags ??= {};
      itemSource.flags["pf2e-item-forge"] ??= {};
      itemSource.flags["pf2e-item-forge"].wand = {
        mode: "special",
        profile: candidate.profile.id,
        rank: candidate.rank,
        level: candidate.variant.level,
        priceGp: candidate.variant.price,
        effect: this.#formatText(candidate.profile.effectText, { spell: candidate.spell.name, rank: candidate.rank }),
        automation: candidate.profile.automation,
        spell: {
          sourceUuid: candidate.spell.uuid,
          name: candidate.spell.name,
          baseRank: candidate.spell.baseRank,
          rank: candidate.rank,
          heightened: candidate.rank > candidate.spell.baseRank
        }
      };
    }

    return itemSource;
  }

  #formatText(value, data = {}) {
    if (!value) return "";
    const formatted = this.formatter?.(value, data);
    return formatted && formatted !== value ? formatted : value;
  }
}
