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
    configProvider = () => globalThis.CONFIG,
    uuidResolver = (uuid) => globalThis.fromUuid?.(uuid),
    randomId = () => globalThis.foundry?.utils?.randomID?.() ?? fallbackRandomId(),
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? null
  } = {}) {
    this.id = "wand";
    this.mode = "magic";
    this.priority = 220;
    this.index = compendiumIndex;
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
        allCandidates.push({
          spell,
          rank,
          template,
          itemLevel: Number(template.source?.system?.level?.value ?? 0)
        });
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
      error.code = allCandidates.length === 0 ? "NO_WAND_SPELL_CANDIDATE" : "NO_ITEM_IN_LEVEL_RANGE";
      error.details = { category: request.category, level: request.level, source: request.source, theme };
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
    const itemSource = this.#composeWand(candidate, spellSource);

    return {
      request,
      itemSource,
      warnings,
      plan: {
        kind: "wand",
        theme,
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
        magic: { kind: "wand", theme },
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

  #composeWand(candidate, spellSource) {
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

    const wandConfig = this.configProvider?.()?.PF2E?.spellcastingItems?.wand;
    const formattedName = wandConfig?.nameTemplate
      ? this.formatter?.(wandConfig.nameTemplate, { name: candidate.spell.name, level: candidate.rank })
      : null;
    itemSource.name = formattedName || `Wand: ${candidate.spell.name} (Rank ${candidate.rank})`;

    const genericDescription = itemSource.system.description?.value ?? "";
    const spellLink = `@UUID[${candidate.spell.uuid}]{${candidate.spell.name}}`;
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = `<p>${spellLink}</p><hr>${genericDescription}`;
    itemSource.system.spell = spellSourceAtRank({ toObject: () => spellSource }, candidate.rank, this.randomId);

    return itemSource;
  }
}
