import test from "node:test";
import assert from "node:assert/strict";

class ApplicationV2Stub {
  constructor(options = {}) {
    this.options = options;
    this.rendered = false;
    this.element = { querySelectorAll: () => [], querySelector: () => null };
  }
  async render() { return this; }
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
  utils: { deepClone: (value) => structuredClone(value) }
};

globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  },
  modules: { get: () => null },
  pf2eItemForge: null
};

const { SourceCompendiumSettings } = await import("../../src/app/source-compendium-settings.js");

function fixture() {
  let stored = { mode: "selected", includePacks: ["pf2e.items"], excludePacks: [] };
  const api = {
    getDefaultSourcePolicy: () => structuredClone(stored),
    setDefaultSourcePolicy: async (source) => {
      if (source.mode === "selected" && source.includePacks.length === 0) {
        const error = new Error("empty");
        error.code = "NO_SOURCE_PACKS";
        throw error;
      }
      stored = structuredClone(source);
      return structuredClone(stored);
    },
    getAvailableItemPacks: ({ includeSpellPacks }) => {
      assert.equal(includeSpellPacks, true);
      return [
        { id: "pf2e.items", label: "PF2e Items", packageType: "system", physicalCount: 20, spellCount: 0 },
        { id: "pf2e.spells", label: "PF2e Spells", packageType: "system", physicalCount: 0, spellCount: 30 },
        { id: "module.loot", label: "Loot", packageType: "module", physicalCount: 4, spellCount: 2 }
      ];
    }
  };
  return { api, getStored: () => stored };
}

test("SourceCompendiumSettings keeps mode and selected pack list together", async () => {
  const { api } = fixture();
  game.pf2eItemForge = api;
  const app = new SourceCompendiumSettings();
  const context = await app._prepareContext({});
  assert.equal(context.selectedSources, true);
  assert.equal(context.selectedCount, 1);
  assert.deepEqual(context.packs.filter((pack) => pack.checked).map((pack) => pack.id), ["pf2e.items"]);

  app.render = async () => app;
  await app.selectAllSourcePacks();
  assert.deepEqual(app.source.includePacks, ["pf2e.items", "pf2e.spells", "module.loot"]);
  await app.clearSourcePacks();
  assert.deepEqual(app.source.includePacks, []);
});

test("SourceCompendiumSettings validates and saves the selected world default", async () => {
  const { api, getStored } = fixture();
  game.pf2eItemForge = api;
  const app = new SourceCompendiumSettings();
  app.render = async () => app;
  await app._prepareContext({});

  app.source = { mode: "selected", includePacks: [], excludePacks: [] };
  assert.equal(await app.save(), false);
  assert.ok(app.error);

  app.source = { mode: "selected", includePacks: ["pf2e.spells", "module.loot"], excludePacks: [] };
  assert.equal(await app.save(), true);
  assert.deepEqual(getStored().includePacks, ["pf2e.spells", "module.loot"]);
});
