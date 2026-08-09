import { MODULE_ID } from "../constants.js";
import { createSeed } from "../engine/seeded-rng.js";
import { hydrateEditorRequest } from "../engine/request-normalizer.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : structuredClone(value);
}

function localizeMaybe(key) {
  const localized = game.i18n.localize(key);
  return localized === key ? key : localized;
}

async function enrichHtml(html) {
  if (!html) return "";
  const implementation = globalThis.foundry?.applications?.ux?.TextEditor?.implementation
    ?? globalThis.TextEditor?.implementation
    ?? globalThis.TextEditor;
  if (typeof implementation?.enrichHTML !== "function") return html;
  try {
    return await implementation.enrichHTML(html, { async: true });
  } catch (error) {
    console.warn("PF2E Item Forge | Could not enrich preview description", error);
    return html;
  }
}

export class ItemForgeEditor extends HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-editor-{id}`,
    classes: [MODULE_ID, "item-forge-editor"],
    window: { frame: false },
    position: { width: "auto", height: "auto" }
  };

  static PARTS = {
    editor: { template: `modules/${MODULE_ID}/templates/item-forge-editor.hbs` }
  };

  constructor({ api, request = {}, onChange = null, onPreview = null, ...options } = {}) {
    const uniqueId = globalThis.foundry?.utils?.randomID?.(8) ?? Math.random().toString(36).slice(2, 10);
    super({ id: `${MODULE_ID}-editor-${uniqueId}`, ...options });
    this.api = api;
    this.request = this.#hydrateRequest(request);
    this.#ensureModeCategory();
    this.previewResult = null;
    this.error = null;
    this.busy = false;
    this.onChange = onChange;
    this.onPreview = onPreview;
  }

  getRequest() {
    const request = clone(this.request);
    delete request.levelMode;
    return request;
  }

  setRequest(request) {
    this.request = this.#hydrateRequest(request);
    this.#ensureModeCategory();
    this.previewResult = null;
    this.error = null;
    return this.render();
  }

  getPreview() {
    return this.previewResult;
  }

  clearPreview() {
    this.previewResult = null;
    this.error = null;
    return this.render();
  }

  async generatePreview() {
    this.#syncFromDom();
    this.busy = true;
    this.error = null;
    await this.render();
    try {
      this.previewResult = await this.api.preview(this.getRequest());
      this.onPreview?.(this.previewResult, this);
      return this.previewResult;
    } catch (error) {
      console.error("PF2E Item Forge | Preview failed", error);
      const code = error.code ?? "GENERATION_FAILED";
      const errorKey = {
        NO_BASE_EQUIPMENT: "PF2E_ITEM_FORGE.Errors.NoBaseEquipment",
        UNSUPPORTED_EQUIPMENT_CATEGORY: "PF2E_ITEM_FORGE.Errors.UnsupportedEquipmentCategory",
        NO_ITEM_IN_LEVEL_RANGE: "PF2E_ITEM_FORGE.Errors.NoItemInLevelRange",
        ITEM_DOCUMENT_NOT_FOUND: "PF2E_ITEM_FORGE.Errors.ItemDocumentNotFound",
        INVALID_PROPERTY_RUNE_SELECTION: "PF2E_ITEM_FORGE.Errors.InvalidPropertyRuneSelection",
        NO_SCROLL_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoScrollSpellCandidate",
        SPELL_DOCUMENT_NOT_FOUND: "PF2E_ITEM_FORGE.Errors.SpellDocumentNotFound",
        UNSUPPORTED_TREASURE_CATEGORY: "PF2E_ITEM_FORGE.Errors.UnsupportedTreasureCategory",
        NO_TREASURE_TYPE: "PF2E_ITEM_FORGE.Errors.NoTreasureType",
        NO_TREASURE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoTreasureCandidate",
        UNKNOWN_TREASURE_CONTENT: "PF2E_ITEM_FORGE.Errors.UnknownTreasureContent"
      }[code];
      this.error = { code, message: errorKey ? localizeMaybe(errorKey) : error.message };
      this.previewResult = null;
      throw error;
    } finally {
      this.busy = false;
      await this.render();
    }
  }

  async reroll() {
    this.#syncFromDom();
    this.request.seed = createSeed();
    return this.generatePreview();
  }

  validate() {
    this.#syncFromDom();
    return this.api.validate(this.getRequest());
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selectedPacks = new Set(this.request.source.includePacks ?? []);
    const rarity = new Set(this.request.rarity ?? []);
    this.#ensureModeCategory();
    const categories = this.api.categories.getAll()
      .filter((category) => {
        if (this.request.mode === "equipment") return this.#isEquipmentCategory(category.id);
        if (this.request.mode === "treasure") return this.#isTreasureCategory(category.id);
        return true;
      })
      .map((category) => {
        const depth = this.api.categories.getAncestors(category.id).length;
        return {
          id: category.id,
          label: `${"  ".repeat(depth)}${localizeMaybe(category.label)}`,
          selected: category.id === this.request.category
        };
      });

    const isScrollCategory = this.request.mode === "existing" && this.request.category === "consumable.scroll";
    const packs = this.api.getAvailableItemPacks({ includeSpellPacks: isScrollCategory }).map((pack) => ({
      ...pack,
      checked: selectedPacks.has(pack.id),
      contentSummary: [
        pack.physicalCount ? `${pack.physicalCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Items")}` : null,
        pack.spellCount ? `${pack.spellCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Spells")}` : null
      ].filter(Boolean).join(" · ")
    }));

    const levelPolicies = ["strict", "nearest", "notAbove", "notBelow"].map((id) => ({
      id,
      selected: this.request.levelPolicy === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.LevelPolicy.${{ strict: "Strict", nearest: "Nearest", notAbove: "NotAbove", notBelow: "NotBelow" }[id]}`)
    }));
    const modeLabelKeys = { existing: "Existing", equipment: "Equipment", treasure: "Treasure" };
    const availableModes = this.api.getCapabilities?.().generationModes ?? ["existing", "equipment", "treasure"];
    const generationModes = availableModes.map((id) => ({
      id,
      selected: this.request.mode === id,
      label: modeLabelKeys[id] ? localizeMaybe(`PF2E_ITEM_FORGE.GenerationMode.${modeLabelKeys[id]}`) : id
    }));
    const fundamentalRuneModes = ["automatic", "none"].map((id) => ({
      id,
      selected: this.request.equipment?.fundamentalRunes === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.FundamentalRunes.${id === "automatic" ? "Automatic" : "None"}`)
    }));
    const propertyRuneModes = ["automatic", "random", "fixed", "none"].map((id) => ({
      id,
      selected: this.request.equipment?.propertyRunes?.mode === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.PropertyRuneMode.${{ automatic: "Automatic", random: "Random", fixed: "Fixed", none: "None" }[id]}`)
    }));
    const propertyRuneType = this.#equipmentType(this.request.category);
    const selectedPropertyRunes = new Set(this.request.equipment?.propertyRunes?.selected ?? []);
    const propertyRunes = propertyRuneType && propertyRuneType !== "shield"
      ? this.api.propertyRunes.getForItemType(propertyRuneType).map((rune) => ({
          slug: rune.slug,
          level: rune.level,
          rarity: rune.rarity,
          rarityLabel: localizeMaybe(`PF2E_ITEM_FORGE.Rarity.${{ common: "Common", uncommon: "Uncommon", rare: "Rare", unique: "Unique" }[rune.rarity] ?? "Common"}`),
          label: localizeMaybe(rune.label),
          checked: selectedPropertyRunes.has(rune.slug)
        }))
      : [];
    const sourceModes = ["all", "system", "selected"].map((id) => ({
      id,
      selected: this.request.source.mode === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.SourceMode.${{ all: "All", system: "System", selected: "Selected" }[id]}`)
    }));

    const categoryTreasureTypes = this.request.mode === "treasure"
      ? this.api.treasure.types.getAll().filter((type) => this.api.categories.matches(type.categories ?? [], this.request.category))
      : [];
    if (this.request.mode === "treasure" && this.request.treasure.type !== "any" && !categoryTreasureTypes.some((type) => type.id === this.request.treasure.type)) {
      this.request.treasure.type = "any";
    }
    const matchingTreasureTypes = this.request.treasure.type !== "any"
      ? categoryTreasureTypes.filter((type) => type.id === this.request.treasure.type)
      : categoryTreasureTypes;
    const allowedMaterials = this.api.treasure.materials.getAll().filter((material) => {
      const tags = new Set(material.tags ?? []);
      return matchingTreasureTypes.some((type) => (type.materialTags ?? []).some((tag) => tags.has(tag)));
    });
    if (this.request.mode === "treasure" && this.request.treasure.material !== "any" && !allowedMaterials.some((entry) => entry.id === this.request.treasure.material)) {
      this.request.treasure.material = "any";
    }
    if (this.request.mode === "treasure" && matchingTreasureTypes.length && matchingTreasureTypes.every((type) => !type.supportsMotif)) {
      this.request.treasure.motif = "any";
    }
    if (this.request.mode === "treasure" && matchingTreasureTypes.length && matchingTreasureTypes.every((type) => type.usesCraftsmanship === false)) {
      this.request.treasure.craftsmanship = "any";
    }
    const treasureOption = (registry, selectedId, entries = registry.getAll()) => [
      { id: "any", label: localizeMaybe("PF2E_ITEM_FORGE.Treasure.Any"), selected: !selectedId || selectedId === "any" },
      ...entries.map((entry) => ({
        id: entry.id,
        label: typeof entry.label === "object" ? (entry.label[game.i18n.lang?.startsWith("de") ? "de" : "en"] ?? entry.label.en ?? entry.label.de ?? entry.id) : localizeMaybe(entry.label),
        selected: entry.id === selectedId
      }))
    ];
    const treasureTypes = treasureOption(this.api.treasure.types, this.request.treasure?.type, categoryTreasureTypes);
    const treasureMaterials = treasureOption(this.api.treasure.materials, this.request.treasure?.material, allowedMaterials);
    const treasureConditions = treasureOption(this.api.treasure.conditions, this.request.treasure?.condition);
    const treasureCraftsmanship = treasureOption(this.api.treasure.craftsmanship, this.request.treasure?.craftsmanship);
    const treasureMotifs = treasureOption(this.api.treasure.motifs, this.request.treasure?.motif);
    const treasureStyles = treasureOption(this.api.treasure.styles, this.request.treasure?.style);

    const preview = this.previewResult
      ? {
          name: this.previewResult.itemSource?.name,
          img: this.previewResult.itemSource?.img,
          type: this.previewResult.itemSource?.type,
          level: this.previewResult.metadata?.level,
          rarity: this.previewResult.metadata?.rarity,
          sourcePack: this.previewResult.metadata?.sourcePack,
          candidateCount: this.previewResult.metadata?.candidateCount,
          warnings: this.previewResult.warnings ?? [],
          description: await enrichHtml(this.previewResult.itemSource?.system?.description?.value ?? ""),
          spell: this.previewResult.metadata?.spell ?? null,
          baseItem: this.previewResult.plan?.baseItem ?? null,
          runeProfile: this.previewResult.metadata?.runeProfile ?? null,
          runes: this.previewResult.metadata?.runes ?? null,
          propertyRuneCapacity: this.previewResult.metadata?.propertyRuneCapacity ?? null,
          propertyRunes: (this.previewResult.metadata?.propertyRunes ?? []).map((rune) => ({
            ...rune,
            displayLabel: localizeMaybe(rune.label)
          })),
          runeSummary: this.#formatRuneSummary(this.previewResult.metadata?.runes),
          treasure: this.previewResult.metadata?.treasure
            ? {
                ...this.previewResult.metadata.treasure,
                attributeEntries: Object.values(this.previewResult.metadata.treasure.attributes ?? {}),
                valuation: this.previewResult.metadata.treasure.valuation ?? null
              }
            : null,
          value: this.previewResult.metadata?.value ?? null,
          solverAttempts: this.previewResult.metadata?.solverAttempts ?? null,
          solverExact: this.previewResult.metadata?.solverExact ?? null
        }
      : null;

    return {
      ...context,
      request: this.request,
      categories,
      generationModes,
      fundamentalRuneModes,
      propertyRuneModes,
      propertyRunes,
      isEquipmentMode: this.request.mode === "equipment",
      isTreasureMode: this.request.mode === "treasure",
      treasureValueRange: this.request.value?.mode === "range",
      treasureTypes,
      treasureMaterials,
      treasureConditions,
      treasureCraftsmanship,
      treasureMotifs,
      treasureStyles,
      treasureSupportsMaterial: allowedMaterials.length > 0,
      treasureSupportsMotif: matchingTreasureTypes.some((type) => type.supportsMotif),
      treasureSupportsCraftsmanship: matchingTreasureTypes.some((type) => type.usesCraftsmanship !== false),
      supportsPropertyRunes: ["weapon", "armor"].includes(propertyRuneType),
      fixedPropertyRunes: this.request.equipment?.propertyRunes?.mode === "fixed",
      packs,
      levelPolicies,
      sourceModes,
      isRange: this.request.levelMode === "range",
      selectedSources: this.request.source.mode === "selected",
      isScrollCategory,
      rarity: {
        common: rarity.has("common"),
        uncommon: rarity.has("uncommon"),
        rare: rarity.has("rare"),
        unique: rarity.has("unique")
      },
      preview,
      error: this.error,
      busy: this.busy
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    element.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("change", async () => {
        this.#syncFromDom();
        if (input.name === "mode") this.#ensureModeCategory();
        this.previewResult = null;
        this.error = null;
        this.onChange?.(this.getRequest(), this);
        if (["mode", "category", "levelMode", "source.mode", "equipment.propertyRunes.mode", "value.mode", "treasure.type"].includes(input.name)) {
          await this.#renderPreservingView();
        }
      });
    });
  }

  async #renderPreservingView() {
    if (!this.rendered) return this.render();

    const selectors = [
      ".item-forge-parameters",
      ".item-forge-preview",
      ".pack-list",
      ".property-rune-list",
      ".preview-description__content"
    ];
    const scrollState = selectors.map((selector) => ({
      selector,
      top: this.element.querySelector(selector)?.scrollTop ?? 0,
      left: this.element.querySelector(selector)?.scrollLeft ?? 0
    }));
    const detailState = [...this.element.querySelectorAll("details")].map((details, index) => ({ index, open: details.open }));
    const active = this.element.ownerDocument?.activeElement;
    const activeName = active?.name && this.element.contains?.(active) ? active.name : null;

    await this.render();

    for (const state of scrollState) {
      const node = this.element.querySelector(state.selector);
      if (!node) continue;
      node.scrollTop = state.top;
      node.scrollLeft = state.left;
    }
    const details = [...this.element.querySelectorAll("details")];
    for (const state of detailState) {
      if (details[state.index]) details[state.index].open = state.open;
    }
    if (activeName) this.element.querySelector(`[name="${activeName}"]`)?.focus?.({ preventScroll: true });
    return this;
  }

  #hydrateRequest(request = {}) {
    if (typeof this.api?.normalize === "function") {
      const normalized = this.api.normalize(request);
      const levelMode = request.levelMode === "range" || request.levelMode === "single"
        ? request.levelMode
        : normalized.level.min === normalized.level.max ? "single" : "range";
      if (levelMode === "single") {
        normalized.level.max = normalized.level.min;
        normalized.level.target = normalized.level.min;
      }
      return { ...normalized, levelMode };
    }
    return hydrateEditorRequest(request);
  }

  #isEquipmentCategory(category) {
    return ["weapon", "armor", "shield"].some((root) =>
      category === root || this.api.categories.isDescendant(category, root)
    );
  }

  #isTreasureCategory(category) {
    return category === "treasure" || this.api.categories.isDescendant(category, "treasure");
  }

  #equipmentType(category) {
    for (const root of ["weapon", "armor", "shield"]) {
      if (category === root || this.api.categories.isDescendant(category, root)) return root;
    }
    return null;
  }

  #ensureModeCategory() {
    if (this.request.mode === "equipment" && !this.#isEquipmentCategory(this.request.category)) {
      this.request.category = "weapon";
    }
    if (this.request.mode === "treasure" && !this.#isTreasureCategory(this.request.category)) {
      this.request.category = "treasure";
    }
  }

  #formatRuneSummary(runes) {
    if (!runes) return null;
    const parts = [];
    if ((Number(runes.potency) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Potency")} +${Number(runes.potency)}`);
    }
    if ((Number(runes.striking) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Striking")} ${Number(runes.striking)}`);
    }
    if ((Number(runes.resilient) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Resilient")} ${Number(runes.resilient)}`);
    }
    if ((Number(runes.reinforcing) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Reinforcing")} ${Number(runes.reinforcing)}`);
    }
    return parts.length ? parts.join(" · ") : localizeMaybe("PF2E_ITEM_FORGE.FundamentalRunes.None");
  }

  #syncFromDom() {
    if (!this.rendered) return;
    const root = this.element;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback) => Number.parseInt(value(name, fallback), 10);

    this.request.mode = value("mode", this.request.mode);
    this.request.category = value("category", this.request.category);
    this.request.levelMode = value("levelMode", this.request.levelMode);
    this.request.levelPolicy = value("levelPolicy", this.request.levelPolicy);
    this.request.level.min = number("level.min", this.request.level.min);
    this.request.level.max = this.request.levelMode === "single"
      ? this.request.level.min
      : number("level.max", this.request.level.max);
    this.request.level.target = this.request.levelMode === "single" ? this.request.level.min : null;
    this.request.source.mode = value("source.mode", this.request.source.mode);
    this.request.solver.maxAttempts = number("solver.maxAttempts", this.request.solver.maxAttempts);
    this.request.equipment ??= {};
    this.request.equipment.fundamentalRunes = value("equipment.fundamentalRunes", this.request.equipment.fundamentalRunes ?? "automatic");
    this.request.equipment.propertyRunes ??= { mode: "automatic", selected: [] };
    this.request.equipment.propertyRunes.mode = value("equipment.propertyRunes.mode", this.request.equipment.propertyRunes.mode ?? "automatic");
    this.request.equipment.propertyRunes.selected = [...root.querySelectorAll('[name="propertyRune"]:checked')].map((input) => input.value);
    this.request.value ??= {};
    this.request.value.mode = value("value.mode", this.request.value.mode ?? "target");
    this.request.value.target = Number.parseFloat(value("value.target", this.request.value.target ?? 25));
    this.request.value.min = Number.parseFloat(value("value.min", this.request.value.min ?? 10));
    this.request.value.max = Number.parseFloat(value("value.max", this.request.value.max ?? 50));
    this.request.value.tolerance = Number.parseFloat(value("value.tolerance", this.request.value.tolerance ?? 0.15));
    this.request.treasure ??= {};
    this.request.treasure.type = value("treasure.type", this.request.treasure.type ?? "any");
    this.request.treasure.material = value("treasure.material", this.request.treasure.material ?? "any");
    this.request.treasure.condition = value("treasure.condition", this.request.treasure.condition ?? "any");
    this.request.treasure.craftsmanship = value("treasure.craftsmanship", this.request.treasure.craftsmanship ?? "any");
    this.request.treasure.motif = value("treasure.motif", this.request.treasure.motif ?? "any");
    this.request.treasure.style = value("treasure.style", this.request.treasure.style ?? "any");

    this.request.rarity = [...root.querySelectorAll('[name="rarity"]:checked')].map((input) => input.value);
    this.request.source.includePacks = [...root.querySelectorAll('[name="sourcePack"]:checked')].map((input) => input.value);
  }
}
