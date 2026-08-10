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
    heldMagicProfiles: { getAll: () => [], getForHands: () => [], get: () => null },
    grimoireProfiles: { getAll: () => [], get: () => null },
    apexProfiles: { getAll: () => [], get: () => null },
    getApexCapabilities: () => ({ existing: true, generated: true, existingAttributes: ["str", "dex", "con", "int", "wis", "cha"], generatedAttributes: ["str", "dex", "con", "int", "wis", "cha"] }),
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


test("generated held mode disables unavailable handedness and hides profiles without a safe system template", async () => {
  const api = apiFixture();
  const oneProfile = { id: "one.profile", hands: 1, label: "One Profile" };
  const twoProfile = { id: "two.profile", hands: 2, label: "Two Profile" };
  api.categories.getAll = () => [
    { id: "magic.held", label: "PF2E_ITEM_FORGE.Categories.MagicHeld" },
    { id: "magic.held.one-hand", label: "PF2E_ITEM_FORGE.Categories.MagicHeldOneHand" },
    { id: "magic.held.two-hands", label: "PF2E_ITEM_FORGE.Categories.MagicHeldTwoHands" }
  ];
  api.categories.getAncestors = (id) => id === "magic.held" ? ["magic"] : ["magic.held", "magic"];
  api.getHeldHandCapabilities = () => [
    { id: "one-hand", hands: 1, existing: true, generated: false },
    { id: "two-hands", hands: 2, existing: true, generated: true }
  ];
  api.heldMagicProfiles = {
    getAll: () => [oneProfile, twoProfile],
    getForHands: (hands) => [oneProfile, twoProfile].filter((profile) => profile.hands === Number(hands)),
    get: (id) => [oneProfile, twoProfile].find((profile) => profile.id === id) ?? null
  };
  const editor = new ItemForgeEditor({
    api,
    request: { mode: "magic", category: "magic.held.one-hand", level: 8, magic: { heldMode: "generated", heldProfile: "one.profile" }, seed: "held-availability" }
  });
  const context = await editor._prepareContext({});
  assert.equal(editor.getRequest().category, "magic.held");
  assert.equal(editor.getRequest().magic.heldProfile, "automatic");
  assert.equal(context.categories.find((entry) => entry.id === "magic.held.one-hand").disabled, true);
  assert.equal(context.categories.find((entry) => entry.id === "magic.held.two-hands").disabled, false);
  assert.deepEqual(context.heldProfiles.map((profile) => profile.id), ["automatic", "two.profile"]);
});


test("ItemForgeEditor preserves Apex mode, attribute, and generated profile controls", async () => {
  const api = apiFixture();
  const might = { id: "core.apex-might", attribute: "str", label: "PF2E_ITEM_FORGE.ApexProfiles.Might" };
  const grace = { id: "core.apex-grace", attribute: "dex", label: "PF2E_ITEM_FORGE.ApexProfiles.Grace" };
  api.apexProfiles = { getAll: () => [might, grace], get: (id) => [might, grace].find((profile) => profile.id === id) ?? null };
  api.getApexCapabilities = () => ({ existing: true, generated: true, existingAttributes: ["wis"], generatedAttributes: ["str", "dex"] });
  const editor = new ItemForgeEditor({
    api,
    request: { mode: "magic", category: "magic.apex", level: 17, magic: { apexMode: "generated", apexAttribute: "str", apexProfile: "core.apex-might" }, seed: "apex-editor" }
  });
  const context = await editor._prepareContext({});
  assert.equal(editor.getRequest().magic.apexMode, "generated");
  assert.equal(editor.getRequest().magic.apexAttribute, "str");
  assert.equal(editor.getRequest().magic.apexProfile, "core.apex-might");
  assert.deepEqual(context.apexAttributes.map((entry) => entry.id), ["automatic", "str", "dex"]);
  assert.deepEqual(context.apexProfiles.map((entry) => entry.id), ["automatic", "core.apex-might"]);
});

test("ItemForgeEditor can select all and clear a stable item-plus-spell compendium list", async () => {
  const api = apiFixture();
  api.getAvailableItemPacks = ({ includeSpellPacks }) => {
    assert.equal(includeSpellPacks, true);
    return [{ id: "pf2e.items" }, { id: "pf2e.spells" }, { id: "module.custom" }];
  };
  const editor = new ItemForgeEditor({ api, request: { source: { mode: "all" }, seed: "source-actions" } });
  editor.render = async () => editor;

  await editor.selectAllSourcePacks();
  assert.equal(editor.getRequest().source.mode, "selected");
  assert.deepEqual(editor.getRequest().source.includePacks, ["pf2e.items", "pf2e.spells", "module.custom"]);

  await editor.clearSourcePacks();
  assert.deepEqual(editor.getRequest().source.includePacks, []);
});

test("ItemForgeEditor uses the world source policy by default and can return from a per-request override", async () => {
  const api = apiFixture();
  let stored = { mode: "system", includePacks: ["pf2e.items"], excludePacks: [] };
  api.getDefaultSourcePolicy = () => structuredClone(stored);

  const editor = new ItemForgeEditor({ api, request: { seed: "source-defaults" } });
  editor.render = async () => editor;
  assert.equal(editor.sourceOverride, false);
  assert.deepEqual(editor.getRequest().source, stored);

  stored = { mode: "selected", includePacks: ["pf2e.spells", "module.loot"], excludePacks: [] };
  assert.deepEqual(editor.getRequest().source, stored);

  editor.sourceOverride = true;
  editor.request.source = { mode: "selected", includePacks: ["module.custom"], excludePacks: [] };
  assert.deepEqual(editor.getRequest().source.includePacks, ["module.custom"]);

  assert.equal(await editor.useWorldSourcePolicy(), true);
  assert.equal(editor.sourceOverride, false);
  assert.deepEqual(editor.getRequest().source, stored);
});

test("ItemForgeEditor preserves selected source packs when the pack checklist is temporarily hidden", () => {
  const editor = new ItemForgeEditor({
    api: apiFixture(),
    request: { source: { mode: "selected", includePacks: ["pf2e.items", "module.custom"] }, seed: "hidden-source-list" }
  });
  editor.rendered = true;
  editor.element = {
    querySelector: () => null,
    querySelectorAll: () => []
  };

  editor.validate();
  assert.deepEqual(editor.getRequest().source.includePacks, ["pf2e.items", "module.custom"]);
});

test("ItemForgeEditor treats remembered selected-pack lists as irrelevant when world and request both use system mode", () => {
  const api = apiFixture();
  api.getDefaultSourcePolicy = () => ({ mode: "system", includePacks: ["module.remembered"], excludePacks: [] });
  const editor = new ItemForgeEditor({ api, request: { source: { mode: "system" }, seed: "semantic-source-equality" } });
  assert.equal(editor.sourceOverride, false);
  assert.equal(editor.getRequest().source.mode, "system");
});
