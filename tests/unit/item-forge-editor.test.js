import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

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
  utils: {
    randomID: () => "editor01",
    deepClone: (value) => structuredClone(value)
  }
};
globalThis.game = {
  i18n: {
    lang: "de",
    localize: (key) => key,
    format: (key) => key
  }
};

const { ItemForgeEditor } = await import("../../src/app/item-forge-editor.js");

function apiFixture() {
  return {
    normalize: (request) => normalizeRequest(request, { defaultSourceMode: "system", defaultSolverAttempts: 23 }),
    validate: (request) => ({ valid: true, request }),
    preview: async (request) => ({ request, itemSource: { name: "Preview", type: "treasure", system: { description: { value: "" } } }, metadata: {} }),
    getCapabilities: () => ({ generationModes: ["existing", "equipment", "magic", "treasure"] }),
    categories: {
      isDescendant: (child, parent) => child === parent || child.startsWith(`${parent}.`),
      getAll: () => [],
      getAncestors: () => []
    },
    getAvailableItemPacks: () => [],
    propertyRunes: { getForItemType: () => [] },
    wandProfiles: { getAll: () => [], get: () => null },
    staffProfiles: { getAll: () => [], get: () => null },
    spellheartProfiles: { getAll: () => [], get: () => null },
    specificItemProfiles: { getAll: () => [], getForItemType: () => [], get: () => null },
    specificShieldProfiles: { getAll: () => [], get: () => null },
    wornMagicProfiles: { getAll: () => [], getForSlot: () => [], get: () => null },
    accessoryRunes: { getAll: () => [], get: () => null },
    magicThemes: [],
    treasure: {
      types: { getAll: () => [], get: () => null },
      materials: { getAll: () => [] },
      conditions: { getAll: () => [] },
      craftsmanship: { getAll: () => [] },
      motifs: { getAll: () => [] },
      styles: { getAll: () => [] }
    }
  };
}

test("ItemForgeEditor hydrates partial embedded requests with canonical defaults", () => {
  const editor = new ItemForgeEditor({ api: apiFixture(), request: { mode: "treasure", category: "treasure.jewelry", treasure: { type: "core.type.jewelry.ring" }, seed: "embedded" } });
  const request = editor.getRequest();
  assert.equal(request.source.mode, "system");
  assert.equal(request.solver.maxAttempts, 23);
  assert.equal(request.treasure.type, "core.type.jewelry.ring");
  assert.equal(request.treasure.material, "any");
  assert.deepEqual(request.equipment.propertyRunes.selected, []);
});

test("ItemForgeEditor setRequest uses the same hydration path as construction", async () => {
  const editor = new ItemForgeEditor({ api: apiFixture(), request: { seed: "first" } });
  await editor.setRequest({ mode: "treasure", category: "treasure", value: { mode: "target", target: 77 }, seed: "second" });
  const request = editor.getRequest();
  assert.equal(request.value.target, 77);
  assert.equal(request.source.mode, "system");
  assert.equal(request.treasure.type, "any");
  assert.equal(request.seed, "second");
});

test("ItemForgeEditor preview and reroll stay side-effect free and expose the canonical request", async () => {
  const api = apiFixture();
  const editor = new ItemForgeEditor({ api, request: { mode: "treasure", category: "treasure", seed: "fixed" } });
  const preview = await editor.generatePreview();
  assert.equal(preview.request.seed, "fixed");
  assert.equal(editor.getPreview(), preview);
  const rerolled = await editor.reroll();
  assert.notEqual(rerolled.request.seed, "fixed");
});

test("dependent treasure-type rerender preserves the parameter-panel scroll position", async () => {
  const editor = new ItemForgeEditor({ api: apiFixture(), request: { mode: "treasure", category: "treasure", seed: "scroll-test" } });
  editor.rendered = true;

  const panel = { scrollTop: 187, scrollLeft: 0 };
  const input = {
    name: "treasure.type",
    value: "any",
    addEventListener: (_event, callback) => { input.onChange = callback; }
  };
  const root = {
    ownerDocument: { activeElement: null },
    contains: () => false,
    querySelectorAll: (selector) => {
      if (selector === "input, select") return [input];
      if (selector === "details") return [];
      if (selector.includes(':checked')) return [];
      return [];
    },
    querySelector: (selector) => {
      if (selector === ".item-forge-parameters") return panel;
      if (selector === '[name="treasure.type"]') return input;
      return null;
    }
  };
  editor.element = root;
  editor.render = async () => {
    panel.scrollTop = 0;
    return editor;
  };

  editor._onRender({}, {});
  await input.onChange();
  assert.equal(panel.scrollTop, 187);
});

test("preview price formatter supports every PF2e coin denomination", async () => {
  const previousLocalize = game.i18n.localize;
  game.i18n.localize = (key) => ({
    "PF2E_ITEM_FORGE.Currency.PP": "PM",
    "PF2E_ITEM_FORGE.Currency.GP": "GM",
    "PF2E_ITEM_FORGE.Currency.SP": "SM",
    "PF2E_ITEM_FORGE.Currency.CP": "KM"
  }[key] ?? key);
  try {
    const { formatItemPrice } = await import("../../src/app/item-forge-editor.js");
    assert.equal(formatItemPrice({ system: { price: { value: { pp: 1, gp: 2, sp: 3, cp: 4 } } } }), "1 PM 2 GM 3 SM 4 KM");
    assert.equal(formatItemPrice({ system: { price: { value: { gp: 12 } } } }), "12 GM");
    assert.equal(formatItemPrice({ system: { price: { value: {} } } }), "0 GM");
  } finally {
    game.i18n.localize = previousLocalize;
  }
});

test("preview price formatter can fall back to generated treasure value", async () => {
  const previousLocalize = game.i18n.localize;
  game.i18n.localize = (key) => key === "PF2E_ITEM_FORGE.Currency.GP" ? "GM" : key;
  try {
    const { formatItemPrice } = await import("../../src/app/item-forge-editor.js");
    assert.equal(formatItemPrice({ system: {} }, 37.5), "37.5 GM");
  } finally {
    game.i18n.localize = previousLocalize;
  }
});


test("ItemForgeEditor preserves spellheart as a supported embedded magic category", () => {
  const editor = new ItemForgeEditor({ api: apiFixture(), request: { mode: "magic", category: "magic.spellheart", level: 7, seed: "spellheart" } });
  const request = editor.getRequest();
  assert.equal(request.mode, "magic");
  assert.equal(request.category, "magic.spellheart");
});

test("ItemForgeEditor preserves specific weapon and armor magic categories", () => {
  for (const category of ["magic.weapon", "magic.armor", "magic.shield"]) {
    const editor = new ItemForgeEditor({ api: apiFixture(), request: { mode: "magic", category, level: 8, seed: category } });
    assert.equal(editor.getRequest().category, category);
  }
});

test("runtime preview preparation can expose PF2e-derived price without persisting an item", async () => {
  const previousConfig = globalThis.CONFIG;
  class ItemDocumentStub {
    constructor(source) {
      this.system = structuredClone(source.system);
      this.system.price.value = { gp: 65 };
    }
  }
  globalThis.CONFIG = { Item: { documentClass: ItemDocumentStub } };
  try {
    const { prepareRuntimePreviewItem } = await import("../../src/app/item-forge-editor.js");
    const prepared = prepareRuntimePreviewItem({ type: "weapon", system: { price: { value: { gp: 1 } } } });
    assert.deepEqual(prepared.system.price.value, { gp: 65 });
  } finally {
    globalThis.CONFIG = previousConfig;
  }
});


test("ItemForgeEditor preserves worn magic root and usage subcategories", () => {
  for (const category of ["magic.worn", "magic.worn.cloak", "magic.worn.footwear"]) {
    const editor = new ItemForgeEditor({ api: apiFixture(), request: { mode: "magic", category, level: 8, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: category } });
    const request = editor.getRequest();
    assert.equal(request.category, category);
    assert.equal(request.magic.wornMode, "generated");
  }
});

test("generated worn mode disables non-generatable worn subcategories and resets an unavailable selection", async () => {
  const api = apiFixture();
  api.categories.getAll = () => [
    { id: "magic.worn", label: "PF2E_ITEM_FORGE.Categories.MagicWorn" },
    { id: "magic.worn.backpack", label: "PF2E_ITEM_FORGE.Categories.MagicWornBackpack" },
    { id: "magic.worn.footwear", label: "PF2E_ITEM_FORGE.Categories.MagicWornFootwear" }
  ];
  api.categories.getAncestors = (id) => id === "magic.worn" ? ["magic"] : ["magic.worn", "magic"];
  api.getWornSlotCapabilities = () => [
    { id: "backpack", existing: true, generated: false },
    { id: "footwear", existing: true, generated: true }
  ];
  const editor = new ItemForgeEditor({
    api,
    request: { mode: "magic", category: "magic.worn.backpack", level: 8, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "availability" }
  });
  const context = await editor._prepareContext({});
  assert.equal(editor.getRequest().category, "magic.worn");
  assert.equal(context.categories.find((entry) => entry.id === "magic.worn.backpack").disabled, true);
  assert.equal(context.categories.find((entry) => entry.id === "magic.worn.footwear").disabled, false);
});


test("ItemForgeEditor preserves accessory rune requests and their selected family", () => {
  const editor = new ItemForgeEditor({
    api: apiFixture(),
    request: { mode: "magic", category: "magic.accessory-rune", level: 6, magic: { accessoryRune: "trackless" }, seed: "accessory" }
  });
  const request = editor.getRequest();
  assert.equal(request.category, "magic.accessory-rune");
  assert.equal(request.magic.accessoryRune, "trackless");
});
