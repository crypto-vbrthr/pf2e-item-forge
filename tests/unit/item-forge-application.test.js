import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

class ApplicationV2Stub {
  constructor(options = {}) {
    this.options = options;
    this.rendered = false;
    this.element = { querySelector: () => null };
  }
  async render() { this.rendered = true; return this; }
  async renderChild() {}
  async _prepareContext() { return {}; }
  _onRender() {}
}

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: ApplicationV2Stub,
      HandlebarsApplicationMixin: (Base) => Base
    }
  },
  utils: {
    randomID: () => "app00001",
    deepClone: (value) => structuredClone(value)
  }
};
globalThis.game = {
  i18n: {
    lang: "de",
    localize: (key) => key,
    format: (_key, data) => `created:${data.name}`
  }
};
let createdSource = null;
globalThis.Item = {
  async create(source) {
    createdSource = source;
    return source;
  }
};
globalThis.ui = {
  notifications: {
    warn() {},
    info() {}
  }
};

const { ItemForgeApplication } = await import("../../src/app/item-forge-application.js");

function apiFixture() {
  return {
    normalize: (request) => normalizeRequest(request, { defaultSourceMode: "all", defaultSolverAttempts: 50 }),
    validate: (request) => ({ valid: true, request }),
    preview: async () => null,
    getCapabilities: () => ({ generationModes: ["existing", "equipment", "treasure"] }),
    categories: { isDescendant: () => false, getAll: () => [], getAncestors: () => [] },
    getAvailableItemPacks: () => [],
    propertyRunes: { getForItemType: () => [] },
    treasure: {
      types: { getAll: () => [] }, materials: { getAll: () => [] }, conditions: { getAll: () => [] },
      craftsmanship: { getAll: () => [] }, motifs: { getAll: () => [] }, styles: { getAll: () => [] }
    },
    refreshIndex: async () => true
  };
}

test("ItemForgeApplication owns document creation while the embedded editor only holds the preview", async () => {
  createdSource = null;
  const application = new ItemForgeApplication({ api: apiFixture(), request: { seed: "container" } });
  application.editor.previewResult = {
    itemSource: {
      _id: "preview-id",
      name: "Test Treasure",
      type: "treasure",
      system: { description: { value: "<p>Test</p>" } }
    },
    metadata: { generator: "test", seed: "container", sourceUuid: null },
    plan: { test: true }
  };

  await ItemForgeApplication.DEFAULT_OPTIONS.actions.createItem.call(application);
  assert.ok(createdSource);
  assert.equal(createdSource._id, undefined);
  assert.equal(createdSource.name, "Test Treasure");
  assert.equal(createdSource.flags["pf2e-item-forge"].createdByForge, true);
  assert.equal(createdSource.flags["pf2e-item-forge"].generated, true);
  assert.equal(application.editor.getPreview().itemSource._id, "preview-id", "preview remains unchanged");
});


test("ItemForgeApplication preserves copied-item generated=false while recording Forge creation", async () => {
  createdSource = null;
  const application = new ItemForgeApplication({ api: apiFixture(), request: { seed: "copy" } });
  application.editor.previewResult = {
    itemSource: {
      name: "Published Item",
      type: "equipment",
      system: { description: { value: "<p>Published</p>" } },
      flags: { "pf2e-item-forge": { generated: false, sourceUuid: "Compendium.pf2e.items.Item.abc" } }
    },
    metadata: { generator: "existing-item", seed: "copy", sourceUuid: "Compendium.pf2e.items.Item.abc" },
    plan: null
  };

  await ItemForgeApplication.DEFAULT_OPTIONS.actions.createItem.call(application);
  assert.equal(createdSource.flags["pf2e-item-forge"].createdByForge, true);
  assert.equal(createdSource.flags["pf2e-item-forge"].generated, false);
  assert.equal(createdSource.flags["pf2e-item-forge"].sourceUuid, "Compendium.pf2e.items.Item.abc");
});
