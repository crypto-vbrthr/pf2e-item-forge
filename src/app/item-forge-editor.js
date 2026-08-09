import { MODULE_ID } from "../constants.js";
import { createSeed } from "../engine/seeded-rng.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : structuredClone(value);
}

function localizeMaybe(key) {
  const localized = game.i18n.localize(key);
  return localized === key ? key : localized;
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
    this.request = {
      mode: request.mode ?? "existing",
      category: request.category ?? "item",
      levelMode: request.levelMode ?? "single",
      level: request.level ?? { min: 1, max: 1, target: 1 },
      levelPolicy: request.levelPolicy ?? "strict",
      rarity: request.rarity ?? [],
      source: request.source ?? { mode: "all", includePacks: [], excludePacks: [] },
      solver: request.solver ?? { maxAttempts: 50 },
      equipment: request.equipment ?? {
        fundamentalRunes: "automatic",
        propertyRunes: { mode: "automatic", selected: [] }
      },
      seed: request.seed ?? createSeed()
    };
    this.request.equipment ??= {};
    this.request.equipment.fundamentalRunes ??= "automatic";
    this.request.equipment.propertyRunes ??= { mode: "automatic", selected: [] };
    this.request.equipment.propertyRunes.selected ??= [];
    if (this.request.levelMode === "single") this.request.level.max = this.request.level.min;
    this.#ensureEquipmentCategory();
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
    this.request = clone(request);
    if (!this.request.levelMode) {
      this.request.levelMode = this.request.level?.min === this.request.level?.max ? "single" : "range";
    }
    this.request.equipment ??= {};
    this.request.equipment.fundamentalRunes ??= "automatic";
    this.request.equipment.propertyRunes ??= { mode: "automatic", selected: [] };
    this.request.equipment.propertyRunes.selected ??= [];
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
        INVALID_PROPERTY_RUNE_SELECTION: "PF2E_ITEM_FORGE.Errors.InvalidPropertyRuneSelection"
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
    this.#ensureEquipmentCategory();
    const categories = this.api.categories.getAll()
      .filter((category) => this.request.mode !== "equipment" || this.#isEquipmentCategory(category.id))
      .map((category) => {
        const depth = this.api.categories.getAncestors(category.id).length;
        return {
          id: category.id,
          label: `${"  ".repeat(depth)}${localizeMaybe(category.label)}`,
          selected: category.id === this.request.category
        };
      });

    const packs = this.api.getAvailableItemPacks().map((pack) => ({
      ...pack,
      checked: selectedPacks.has(pack.id)
    }));

    const levelPolicies = ["strict", "nearest", "notAbove", "notBelow"].map((id) => ({
      id,
      selected: this.request.levelPolicy === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.LevelPolicy.${{ strict: "Strict", nearest: "Nearest", notAbove: "NotAbove", notBelow: "NotBelow" }[id]}`)
    }));
    const generationModes = ["existing", "equipment"].map((id) => ({
      id,
      selected: this.request.mode === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.GenerationMode.${id === "existing" ? "Existing" : "Equipment"}`)
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
          baseItem: this.previewResult.plan?.baseItem ?? null,
          runeProfile: this.previewResult.metadata?.runeProfile ?? null,
          runes: this.previewResult.metadata?.runes ?? null,
          propertyRuneCapacity: this.previewResult.metadata?.propertyRuneCapacity ?? null,
          propertyRunes: (this.previewResult.metadata?.propertyRunes ?? []).map((rune) => ({
            ...rune,
            displayLabel: localizeMaybe(rune.label)
          })),
          runeSummary: this.#formatRuneSummary(this.previewResult.metadata?.runes)
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
      supportsPropertyRunes: ["weapon", "armor"].includes(propertyRuneType),
      fixedPropertyRunes: this.request.equipment?.propertyRunes?.mode === "fixed",
      packs,
      levelPolicies,
      sourceModes,
      isRange: this.request.levelMode === "range",
      selectedSources: this.request.source.mode === "selected",
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
        if (input.name === "mode") this.#ensureEquipmentCategory();
        this.previewResult = null;
        this.error = null;
        this.onChange?.(this.getRequest(), this);
        if (["mode", "category", "levelMode", "source.mode", "equipment.propertyRunes.mode"].includes(input.name)) await this.render();
      });
    });
  }

  #isEquipmentCategory(category) {
    return ["weapon", "armor", "shield"].some((root) =>
      category === root || this.api.categories.isDescendant(category, root)
    );
  }

  #equipmentType(category) {
    for (const root of ["weapon", "armor", "shield"]) {
      if (category === root || this.api.categories.isDescendant(category, root)) return root;
    }
    return null;
  }

  #ensureEquipmentCategory() {
    if (this.request.mode === "equipment" && !this.#isEquipmentCategory(this.request.category)) {
      this.request.category = "weapon";
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

    this.request.rarity = [...root.querySelectorAll('[name="rarity"]:checked')].map((input) => input.value);
    this.request.source.includePacks = [...root.querySelectorAll('[name="sourcePack"]:checked')].map((input) => input.value);
  }
}
