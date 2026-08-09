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
      seed: request.seed ?? createSeed()
    };
    if (this.request.levelMode === "single") this.request.level.max = this.request.level.min;
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
      this.error = { code: error.code ?? "GENERATION_FAILED", message: error.message };
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
    const categories = this.api.categories.getAll().map((category) => {
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
          warnings: this.previewResult.warnings ?? []
        }
      : null;

    return {
      ...context,
      request: this.request,
      categories,
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
        this.previewResult = null;
        this.error = null;
        this.onChange?.(this.getRequest(), this);
        if (["levelMode", "source.mode"].includes(input.name)) await this.render();
      });
    });
  }

  #syncFromDom() {
    if (!this.rendered) return;
    const root = this.element;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback) => Number.parseInt(value(name, fallback), 10);

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

    this.request.rarity = [...root.querySelectorAll('[name="rarity"]:checked')].map((input) => input.value);
    this.request.source.includePacks = [...root.querySelectorAll('[name="sourcePack"]:checked')].map((input) => input.value);
  }
}
