import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { spellCandidateService } from "../spell-candidate-service.js";
import { MagicItemTemplateResolver } from "../magic-item-template-resolver.js";
import { getHighestRarity, spellSourceAtRank } from "../spell-item-utils.js";

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
    templateResolver = null,
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
    this.templateResolver = templateResolver ?? new MagicItemTemplateResolver({ compendiumIndex, configProvider, uuidResolver });
    this.randomId = randomId;
    this.formatter = formatter;
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
    const spellPool = spellCandidateService.getEligibleSpells(this.index, request, {
      allowSlotted: true,
      theme
    });
    const allCandidates = [];

    for (const spell of spellPool) {
      const ranks = spellCandidateService.getAvailableRanks(spell, { maxRank: 9, allowHeightened });
      for (const rank of ranks) {
        if (rank < 1 || rank > 9) continue;
        const template = await this.templateResolver.resolveWandTemplate(rank);
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

    const selection = candidateLevelResolver.resolve(allCandidates, request, { getLevel: (candidate) => candidate.itemLevel });
    const candidates = selection.candidates;
    const warnings = selection.warnings;

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
        template: this.templateResolver.templateMetadata(candidate.template, { kind: "wand" }),
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
        contentSources: [candidate.spell.pack],
        templateSource: this.templateResolver.templateMetadata(candidate.template, { kind: "wand" }),
        level: candidate.itemLevel,
        rarity: candidate.spell.rarity,
        category: request.category,
        candidateCount: candidates.length,
        automation: { level: candidate.profile ? "rules-text" : "native" },
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
