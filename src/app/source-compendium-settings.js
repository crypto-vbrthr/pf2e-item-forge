import { MODULE_ID } from "../constants.js";
import { mergeVisibleSourceSelection } from "../engine/source-policy.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

function localizeMaybe(key, data = null) {
  if (!key) return "";
  if (data && globalThis.game?.i18n?.format) return globalThis.game.i18n.format(key, data);
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

function clone(value) {
  return globalThis.foundry?.utils?.deepClone?.(value) ?? structuredClone(value);
}

function normalizedPolicy(source = {}) {
  return {
    mode: ["all", "system", "selected"].includes(source.mode) ? source.mode : "all",
    includePacks: [...new Set(Array.isArray(source.includePacks) ? source.includePacks.filter((id) => typeof id === "string" && id) : [])],
    excludePacks: [...new Set(Array.isArray(source.excludePacks) ? source.excludePacks.filter((id) => typeof id === "string" && id) : [])]
  };
}

export class SourceCompendiumSettings extends HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-source-settings`,
    classes: [MODULE_ID, "source-compendium-settings"],
    tag: "section",
    window: {
      title: "PF2E_ITEM_FORGE.Settings.SourceCompendiums.Title",
      icon: "fa-solid fa-books",
      resizable: true
    },
    position: { width: 720, height: 680 },
    actions: {
      save: SourceCompendiumSettings.#onSave,
      selectAllSources: SourceCompendiumSettings.#onSelectAllSources,
      clearSources: SourceCompendiumSettings.#onClearSources
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/source-compendium-settings.hbs` }
  };

  constructor(options = {}) {
    super({
      ...options,
      window: {
        ...(options.window ?? {}),
        title: localizeMaybe("PF2E_ITEM_FORGE.Settings.SourceCompendiums.Title")
      }
    });
    this.source = null;
    this.error = null;
  }

  get api() {
    return globalThis.game?.pf2eItemForge ?? globalThis.game?.modules?.get?.(MODULE_ID)?.api ?? null;
  }

  #ensureSource() {
    if (!this.source) this.source = normalizedPolicy(this.api?.getDefaultSourcePolicy?.() ?? {});
    return this.source;
  }

  #availablePacks() {
    return this.api?.getAvailableItemPacks?.({ includeSpellPacks: true }) ?? [];
  }

  #syncFromDom() {
    if (!this.rendered || !this.element) return;
    const mode = this.element.querySelector?.('[name="source.mode"]')?.value;
    if (["all", "system", "selected"].includes(mode)) this.#ensureSource().mode = mode;
    const packInputs = [...(this.element.querySelectorAll?.('[name="sourcePack"]') ?? [])];
    if (packInputs.length) {
      const availableIds = packInputs.map((input) => input.value);
      const checkedIds = packInputs.filter((input) => input.checked).map((input) => input.value);
      this.#ensureSource().includePacks = mergeVisibleSourceSelection(this.#ensureSource().includePacks, availableIds, checkedIds);
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const source = this.#ensureSource();
    const selected = new Set(source.includePacks);
    const packs = this.#availablePacks().map((pack) => ({
      ...pack,
      checked: selected.has(pack.id),
      contentSummary: [
        pack.physicalCount ? `${pack.physicalCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Items")}` : null,
        pack.spellCount ? `${pack.spellCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Spells")}` : null
      ].filter(Boolean).join(" · "),
      packageSummary: pack.packageType === "system"
        ? localizeMaybe("PF2E_ITEM_FORGE.Sources.System")
        : pack.packageType === "module"
          ? localizeMaybe("PF2E_ITEM_FORGE.Sources.Module")
          : localizeMaybe("PF2E_ITEM_FORGE.Sources.Other")
    }));
    const availableIds = new Set(packs.map((pack) => pack.id));
    const missingSelectedPacks = source.includePacks.filter((id) => !availableIds.has(id));

    return {
      ...context,
      source,
      sourceModes: ["all", "system", "selected"].map((id) => ({
        id,
        selected: source.mode === id,
        label: localizeMaybe(`PF2E_ITEM_FORGE.SourceMode.${{ all: "All", system: "System", selected: "Selected" }[id]}`)
      })),
      selectedSources: source.mode === "selected",
      packs,
      selectedCount: packs.filter((pack) => pack.checked).length,
      packCount: packs.length,
      missingSelectedPacks,
      error: this.error
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const input of this.element.querySelectorAll?.("input, select") ?? []) {
      input.addEventListener("change", async () => {
        this.#syncFromDom();
        this.error = null;
        if (input.name === "source.mode") await this.render();
      });
    }
  }

  async save() {
    this.#syncFromDom();
    try {
      const saved = await this.api?.setDefaultSourcePolicy?.(clone(this.#ensureSource()));
      if (!saved) throw new Error("Default source policy storage is unavailable");
      this.source = normalizedPolicy(saved);
      this.error = null;
      globalThis.ui?.notifications?.info?.(localizeMaybe("PF2E_ITEM_FORGE.Notifications.SourceDefaultsSaved"));
      await this.render();
      return true;
    } catch (error) {
      this.error = error?.code === "NO_SOURCE_PACKS"
        ? localizeMaybe("PF2E_ITEM_FORGE.Notifications.SourceDefaultsNeedPack")
        : localizeMaybe("PF2E_ITEM_FORGE.Notifications.SourceDefaultsSaveFailed");
      if (error?.code !== "NO_SOURCE_PACKS") console.error("PF2E Item Forge | Could not save source compendium settings", error);
      globalThis.ui?.notifications?.warn?.(this.error);
      await this.render();
      return false;
    }
  }

  async selectAllSourcePacks() {
    this.#syncFromDom();
    const source = this.#ensureSource();
    source.mode = "selected";
    const availableIds = this.#availablePacks().map((pack) => pack.id).filter(Boolean);
    source.includePacks = mergeVisibleSourceSelection(source.includePacks, availableIds, availableIds);
    this.error = null;
    await this.render();
    return source.includePacks;
  }

  async clearSourcePacks() {
    this.#syncFromDom();
    const source = this.#ensureSource();
    source.mode = "selected";
    source.includePacks = [];
    this.error = null;
    await this.render();
    return source.includePacks;
  }

  static async #onSave() {
    await this.save();
  }

  static async #onSelectAllSources() {
    await this.selectAllSourcePacks();
  }

  static async #onClearSources() {
    await this.clearSourcePacks();
  }
}
