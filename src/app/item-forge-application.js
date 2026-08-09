import { MODULE_ID } from "../constants.js";
import { ItemForgeEditor } from "./item-forge-editor.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

export class ItemForgeApplication extends HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-application`,
    classes: [MODULE_ID, "item-forge-application"],
    tag: "section",
    window: {
      title: "PF2E_ITEM_FORGE.App.Title",
      icon: "fa-solid fa-hammer",
      resizable: true
    },
    position: {
      width: 900,
      height: 720
    },
    actions: {
      generate: ItemForgeApplication.#onGenerate,
      reroll: ItemForgeApplication.#onReroll,
      createItem: ItemForgeApplication.#onCreateItem,
      refreshSources: ItemForgeApplication.#onRefreshSources,
      runMagicDiagnostics: ItemForgeApplication.#onRunMagicDiagnostics
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/item-forge-application.hbs` }
  };

  constructor({ api, request = {}, ...options } = {}) {
    const title = game.i18n.localize("PF2E_ITEM_FORGE.App.Title");
    super({
      ...options,
      window: {
        ...(options.window ?? {}),
        title
      }
    });
    this.api = api;
    this.editor = new ItemForgeEditor({ api, request });
    this.magicDiagnostics = null;
    this.diagnosticsBusy = false;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      hasPreview: Boolean(this.editor.getPreview()),
      busy: this.editor.busy,
      diagnosticsBusy: this.diagnosticsBusy,
      magicDiagnostics: this.magicDiagnostics
    };
  }

  async _onRender(context, options) {
    super._onRender(context, options);
    await this.renderChild(this.editor, { force: !this.editor.rendered });
    const slot = this.element.querySelector("[data-item-forge-editor-slot]");
    if (slot && this.editor.element?.parentElement !== slot) slot.append(this.editor.element);
  }

  static async #onGenerate() {
    try {
      await this.editor.generatePreview();
      await this.render();
    } catch (error) {
      ui.notifications.warn(game.i18n.localize("PF2E_ITEM_FORGE.Notifications.GenerationFailed"));
    }
  }

  static async #onReroll() {
    try {
      await this.editor.reroll();
      await this.render();
    } catch (error) {
      ui.notifications.warn(game.i18n.localize("PF2E_ITEM_FORGE.Notifications.GenerationFailed"));
    }
  }

  static async #onCreateItem() {
    const preview = this.editor.getPreview();
    if (!preview?.itemSource) {
      ui.notifications.warn(game.i18n.localize("PF2E_ITEM_FORGE.Notifications.NoPreview"));
      return;
    }

    const source = foundry.utils.deepClone(preview.itemSource);
    delete source._id;
    source.flags ??= {};
    source.flags[MODULE_ID] = {
      ...(source.flags[MODULE_ID] ?? {}),
      generated: true,
      generator: preview.metadata?.generator ?? "unknown",
      seed: preview.metadata?.seed ?? null,
      sourceUuid: preview.metadata?.sourceUuid ?? null,
      plan: preview.plan ?? null,
      createdAt: new Date().toISOString()
    };
    await Item.create(source, { renderSheet: true });
    ui.notifications.info(game.i18n.format("PF2E_ITEM_FORGE.Notifications.ItemCreated", { name: source.name }));
  }


  static async #onRunMagicDiagnostics() {
    if (this.diagnosticsBusy) return;
    this.diagnosticsBusy = true;
    await this.render();
    try {
      this.magicDiagnostics = await this.api.runMagicDiagnostics();
      console.group("PF2E Item Forge | Magic diagnostics");
      console.table(this.magicDiagnostics.checks);
      console.groupEnd();
      ui.notifications.info(game.i18n.format("PF2E_ITEM_FORGE.Notifications.MagicDiagnosticsComplete", {
        passed: this.magicDiagnostics.passed,
        failed: this.magicDiagnostics.failed,
        skipped: this.magicDiagnostics.skipped
      }));
    } catch (error) {
      console.error("PF2E Item Forge | Magic diagnostics failed", error);
      ui.notifications.warn(game.i18n.localize("PF2E_ITEM_FORGE.Notifications.GenerationFailed"));
    } finally {
      this.diagnosticsBusy = false;
      await this.render();
    }
  }

  static async #onRefreshSources() {
    await this.api.refreshIndex();
    await this.editor.render();
    ui.notifications.info(game.i18n.localize("PF2E_ITEM_FORGE.Notifications.SourcesRefreshed"));
  }
}
