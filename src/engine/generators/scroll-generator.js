import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { spellCandidateService } from "../spell-candidate-service.js";
import { MagicItemTemplateResolver } from "../magic-item-template-resolver.js";
import { spellSourceAtRank } from "../spell-item-utils.js";

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

export { getMeaningfulSpellRanks } from "../spell-item-utils.js";

export class ScrollGenerator {
  constructor({
    compendiumIndex,
    templateResolver = null,
    configProvider = () => globalThis.CONFIG,
    uuidResolver = (uuid) => globalThis.fromUuid?.(uuid),
    randomId = () => globalThis.foundry?.utils?.randomID?.() ?? fallbackRandomId(),
    formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? null
  } = {}) {
    this.id = "scroll";
    this.mode = "existing";
    this.priority = 200;
    this.index = compendiumIndex;
    this.templateResolver = templateResolver ?? new MagicItemTemplateResolver({ compendiumIndex, configProvider, uuidResolver });
    this.configProvider = configProvider;
    this.randomId = randomId;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "existing" && request.category === "consumable.scroll";
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();

    const spellPool = spellCandidateService.getEligibleSpells(this.index, request, { allowSlotted: true });
    const allCandidates = [];
    for (const spell of spellPool) {
      for (const rank of spellCandidateService.getAvailableRanks(spell, { maxRank: 10, allowHeightened: true })) {
        const template = await this.templateResolver.resolveScrollTemplate(rank);
        if (!template) continue;
        allCandidates.push({ spell, rank, template, itemLevel: Number(template.source?.system?.level?.value ?? 0) });
      }
    }

    const selection = candidateLevelResolver.resolve(allCandidates, request, { getLevel: (candidate) => candidate.itemLevel });
    const candidates = selection.candidates;
    const warnings = selection.warnings;

    if (!candidates.length) {
      const error = new Error("No scroll spell candidate matches the request");
      error.code = allCandidates.length === 0 ? "NO_SCROLL_SPELL_CANDIDATE" : "NO_ITEM_IN_LEVEL_RANGE";
      error.details = { category: request.category, level: request.level, source: request.source };
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
    const itemSource = this.#composeScroll(candidate, spellSource);
    const template = this.templateResolver.templateMetadata(candidate.template, { kind: "scroll" });

    return {
      request,
      itemSource,
      warnings,
      plan: {
        spell: {
          name: candidate.spell.name,
          sourceUuid: candidate.spell.uuid,
          baseRank: candidate.spell.baseRank,
          rank: candidate.rank,
          heightened: candidate.rank > candidate.spell.baseRank
        },
        template
      },
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: candidate.spell.pack,
        sourceUuid: candidate.spell.uuid,
        contentSources: [candidate.spell.pack],
        templateSource: template,
        templateUuid: candidate.template.uuid,
        level: candidate.itemLevel,
        rarity: candidate.spell.rarity,
        category: request.category,
        candidateCount: candidates.length,
        automation: { level: "native" },
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

  #composeScroll(candidate, spellSource) {
    const itemSource = clone(candidate.template.source);
    itemSource._id = null;
    itemSource.system ??= {};
    itemSource.system.traits ??= { value: [] };
    itemSource.system.traits.value ??= [];

    const spellTraits = spellSource.system?.traits?.value ?? [];
    itemSource.system.traits.value = [...new Set([...itemSource.system.traits.value, ...spellTraits])].sort();

    const rarity = candidate.spell.rarity ?? "common";
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = rarity;

    const config = this.configProvider?.();
    const scrollConfig = config?.PF2E?.spellcastingItems?.scroll;
    const formattedName = scrollConfig?.nameTemplate
      ? this.formatter?.(scrollConfig.nameTemplate, { name: candidate.spell.name, level: candidate.rank })
      : null;
    itemSource.name = formattedName || `Scroll of ${candidate.spell.name} (Rank ${candidate.rank})`;

    const genericDescription = itemSource.system.description?.value ?? "";
    const spellLink = `@UUID[${candidate.spell.uuid}]{${candidate.spell.name}}`;
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = `<p>${spellLink}</p><hr>${genericDescription}`;
    itemSource.system.spell = spellSourceAtRank({ toObject: () => spellSource }, candidate.rank, this.randomId);
    return itemSource;
  }
}
