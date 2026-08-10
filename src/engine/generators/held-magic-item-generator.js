import { SeededRng } from "../seeded-rng.js";
import { candidateLevelResolver } from "../candidate-level-resolver.js";
import { hasHeldMagicMarkerTraits, heldHandsLabelKey, parseHeldUsage } from "../held-item-utils.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}
function localize(formatter, key, data = {}, fallback = "") {
  if (!key) return fallback;
  const value = formatter?.(key, data);
  return value && value !== key ? value : fallback || key;
}
function resolveValue(value, formatter) {
  if (typeof value !== "string") return value;
  const localized = formatter?.(value, {});
  return localized && localized !== value ? localized : value;
}
function requestedHands(category) {
  if (category === "magic.held.one-hand") return 1;
  if (category === "magic.held.two-hands") return 2;
  return null;
}

export class HeldMagicItemGenerator {
  constructor({ compendiumIndex, heldMagicProfiles, templateResolver, formatter = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key } = {}) {
    this.id = "held-magic-item";
    this.mode = "magic";
    this.priority = 214;
    this.index = compendiumIndex;
    this.profiles = heldMagicProfiles;
    this.templateResolver = templateResolver;
    this.formatter = formatter;
  }

  supports(request) {
    return request.mode === "magic" && ["magic.held", "magic.held.one-hand", "magic.held.two-hands"].includes(request.category);
  }

  async generate(request) {
    if (!this.index.ready) await this.index.refresh();
    return request.magic?.heldMode === "generated" ? this.#generateCustom(request) : this.#generateExisting(request);
  }

  async #generateExisting(request) {
    const pool = this.index.query(request).filter((entry) => entry.categories?.includes?.("magic.held"));
    const selection = candidateLevelResolver.resolve(pool, request, { getLevel: (entry) => entry.level });
    if (!selection.candidates.length) {
      const error = new Error("No predefined held magic item matches the request");
      error.code = "NO_PREDEFINED_HELD_ITEM_CANDIDATE";
      throw error;
    }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const document = await this.index.getDocument(selected);
    if (!document) { const error = new Error(`Could not load held magic item ${selected.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    itemSource.flags ??= {};
    itemSource.flags["pf2e-item-forge"] = { ...(itemSource.flags["pf2e-item-forge"] ?? {}), generated: false, generator: this.id, seed: request.seed, sourceUuid: selected.uuid, heldItem: { mode: "existing", hands: selected.heldHands, usage: selected.usage } };
    return {
      request, itemSource, warnings: selection.warnings,
      plan: { kind: "held-existing", sourceItem: { uuid: selected.uuid, name: selected.name, level: selected.level, hands: selected.heldHands } },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: selected.pack, sourceUuid: selected.uuid,
        contentSources: [selected.pack], templateSource: null, level: selected.level, rarity: selected.rarity, category: request.category,
        candidateCount: selection.candidates.length, automation: { level: "native" },
        magic: { kind: "held", heldMode: "existing", hands: selected.heldHands },
        heldItem: { mode: "existing", hands: selected.heldHands, handsLabel: heldHandsLabelKey(selected.heldHands), usage: selected.usage, invested: selected.traits?.includes?.("invested") ?? false, automation: "native" }
      }
    };
  }

  async #generateCustom(request) {
    const requestedProfile = request.magic?.heldProfile ?? "automatic";
    let profiles = requestedProfile === "automatic" ? this.profiles.getAll() : [this.profiles.get(requestedProfile)].filter(Boolean);
    if (requestedProfile !== "automatic" && !profiles.length) { const error = new Error(`Unknown held magic profile ${requestedProfile}`); error.code = "UNKNOWN_HELD_ITEM_PROFILE"; throw error; }
    const hands = requestedHands(request.category);
    if (hands) profiles = profiles.filter((profile) => profile.hands === hands);
    const structural = [];
    for (const profile of profiles) for (const variant of profile.variants) {
      if (request.rarity.length && !request.rarity.includes(profile.rarity)) continue;
      structural.push({ profile, variant });
    }
    const selection = candidateLevelResolver.resolve(structural, request, { getLevel: (candidate) => candidate.variant.level });
    if (!selection.candidates.length) { const error = new Error("No generated held magic item profile matches the request"); error.code = "NO_HELD_ITEM_PROFILE_CANDIDATE"; throw error; }
    const selected = new SeededRng(request.seed).pick(selection.candidates);
    const templateEntry = this.templateResolver?.resolveHeldTemplateEntry?.(selected.profile.hands, { allowedTypes: ["equipment"] }) ?? null;
    if (!templateEntry) { const error = new Error(`No PF2e held-item implementation template is available for ${selected.profile.hands} hand(s)`); error.code = "NO_HELD_ITEM_TEMPLATE"; throw error; }
    const document = await this.index.getDocument(templateEntry);
    if (!document) { const error = new Error(`Could not load held-item template ${templateEntry.uuid}`); error.code = "ITEM_DOCUMENT_NOT_FOUND"; throw error; }
    const itemSource = typeof document.toObject === "function" ? document.toObject() : clone(document._source ?? document);
    itemSource._id = null;
    if (itemSource.type !== "equipment") { const error = new Error(`Unsafe held-item template type ${itemSource.type}`); error.code = "INVALID_HELD_ITEM_TEMPLATE_TYPE"; throw error; }
    const parsed = parseHeldUsage(itemSource.system?.usage?.value);
    if (!parsed.held || parsed.hands !== selected.profile.hands) { const error = new Error("Held-item template usage mismatch"); error.code = "HELD_ITEM_TEMPLATE_USAGE_MISMATCH"; throw error; }
    const rendered = this.#compose(itemSource, selected, request);
    const profileLabel = localize(this.formatter, selected.profile.label, {}, selected.profile.id);
    const variantLabel = localize(this.formatter, selected.variant.label, {}, selected.variant.id);
    return {
      request, itemSource, warnings: selection.warnings,
      plan: { kind: "held-generated", profile: { id: selected.profile.id, label: selected.profile.label }, variant: { id: selected.variant.id, label: selected.variant.label, level: selected.variant.level, price: selected.variant.price }, hands: selected.profile.hands, usage: rendered.usage, effect: rendered.effect, template: { uuid: templateEntry.uuid, name: templateEntry.name } },
      metadata: {
        seed: request.seed, generator: this.id, sourcePack: null, sourceUuid: null, contentSources: [],
        templateSource: this.templateResolver?.templateMetadata?.(templateEntry, { kind: "held" }) ?? null,
        level: selected.variant.level, rarity: selected.profile.rarity, category: request.category, candidateCount: selection.candidates.length,
        automation: { level: "rules-text" },
        magic: { kind: "held", heldMode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel, hands: selected.profile.hands },
        heldItem: { mode: "generated", profile: selected.profile.id, profileLabel, variant: selected.variant.id, variantLabel, hands: selected.profile.hands, handsLabel: heldHandsLabelKey(selected.profile.hands), usage: rendered.usage, effect: rendered.effect, priceGp: selected.variant.price, invested: selected.profile.invested, automation: selected.profile.automation, balance: clone(selected.profile.balance) }
      }
    };
  }

  #compose(itemSource, selected, request) {
    const { profile, variant } = selected;
    const data = Object.fromEntries(Object.entries(variant.values ?? {}).map(([key, value]) => [key, resolveValue(value, this.formatter)]));
    const effect = localize(this.formatter, profile.effectText, data, profile.effectText ?? "");
    const usage = itemSource.system?.usage?.value ?? null;
    itemSource.name = localize(this.formatter, profile.nameTemplate, data, profile.id);
    itemSource.img = "systems/pf2e/icons/default-icons/equipment.svg";
    itemSource.system ??= {};
    itemSource.system.level ??= { value: variant.level }; itemSource.system.level.value = variant.level;
    itemSource.system.price ??= { value: {} }; itemSource.system.price.value = { gp: variant.price };
    itemSource.system.traits ??= { value: [] };
    const traits = new Set(profile.traits ?? []); if (profile.invested) traits.add("invested"); if (!hasHeldMagicMarkerTraits([...traits])) traits.add("magical");
    itemSource.system.traits.value = [...traits].sort();
    if (Object.hasOwn(itemSource.system.traits, "rarity")) itemSource.system.traits.rarity = profile.rarity;
    if (itemSource.system.rarity?.value !== undefined) itemSource.system.rarity.value = profile.rarity;
    itemSource.system.rules = [];
    if (Object.hasOwn(itemSource.system, "slug")) itemSource.system.slug = null;
    if (Object.hasOwn(itemSource.system, "apex")) delete itemSource.system.apex;
    if (Object.hasOwn(itemSource.system, "publication")) delete itemSource.system.publication;
    if (Object.hasOwn(itemSource.system, "subitems")) itemSource.system.subitems = [];
    const description = localize(this.formatter, profile.description, data, "");
    itemSource.system.description ??= { value: "" };
    itemSource.system.description.value = [description ? `<p>${description}</p>` : "", `<p><strong>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.SpecialAbility", {}, "Effect:")}</strong> ${effect}</p>`, `<p><em>${localize(this.formatter, "PF2E_ITEM_FORGE.HeldText.AutomationNote", {}, "This generated held item uses rules text plus Item Forge metadata.")}</em></p>`].filter(Boolean).join("\n");
    itemSource.flags = { "pf2e-item-forge": { generated: true, generator: this.id, seed: request.seed, heldItem: { mode: "generated", profile: profile.id, variant: variant.id, hands: profile.hands, usage, invested: profile.invested, effect, automation: profile.automation, balance: clone(profile.balance) } } };
    return { usage, effect };
  }
}
