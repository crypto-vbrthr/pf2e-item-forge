import test from "node:test";
import assert from "node:assert/strict";
import { ItemForgeApi } from "../../src/api/item-forge-api.js";

function apiFixture() {
  const engine = {
    normalize: (request) => ({ ...request, normalized: true }),
    generate: async (request) => ({ kind: "generate", request }),
    preview: async (request) => ({ kind: "preview", request }),
    validate: (request) => ({ valid: true, request })
  };
  return new ItemForgeApi({
    engine,
    categories: { getAll: () => [{ id: "item" }] },
    generators: {
      getAll: () => [{ id: "test" }],
      getMetadata: () => [{ id: "test", priority: 10, modes: ["custom"] }],
      getModes: () => ["custom"]
    },
    compendiumIndex: { refresh: async () => true, getAvailablePacks: () => [], ready: true, entries: [{ id: 1, type: "equipment", categories: ["magic.worn", "magic.worn.footwear"] }], spellEntries: [{ id: 2 }], getPackErrors: () => [{ pack: "bad.pack" }] },
    treasure: {
      types: { getAll: () => [] }, materials: { getAll: () => [] }, components: { getAll: () => [] },
      motifs: { getAll: () => [] }, conditions: { getAll: () => [] }, craftsmanship: { getAll: () => [] }, styles: { getAll: () => [] }
    },
    propertyRunes: { getAll: () => [] },
    wandProfiles: { getAll: () => [{ id: "core.reaching", label: "Reaching", variants: [{ rank: 1, level: 4 }, { rank: 2, level: 6 }] }] },
    staffProfiles: { getAll: () => [{ id: "core.3-8-12", label: "Profile", variants: [{ level: 3 }, { level: 8 }, { level: 12 }] }] },
    spellheartProfiles: { getAll: () => [{ id: "core.elemental-conduit", label: "Elemental", allowedThemes: ["fire", "cold"], variants: [{ level: 3 }, { level: 8 }, { level: 13 }] }] },
    specificItemProfiles: { getAll: () => [{ id: "core.retributive-weapon", itemType: "weapon", label: "Retributive", allowedThemes: [], variants: [{ level: 3 }, { level: 10 }, { level: 16 }] }] },
    specificShieldProfiles: { getAll: () => [{ id: "core.restorative-shield", label: "Restorative", allowedThemes: [], variants: [{ level: 5 }, { level: 10 }, { level: 15 }] }] },
    wornMagicProfiles: { getAll: () => [{ id: "core.wayfarer-footwear", slot: "footwear", label: "Wayfarer", invested: true, variants: [{ level: 4 }, { level: 10 }, { level: 17 }] }] },
    accessoryRunes: { getAll: () => [{ id: "trackless", label: "Trackless", targetKind: "footwear", host: { documentTypes: ["equipment"], wornSlots: ["footwear"], magicPolicy: "mundane-only" }, source: "treasure-vault-remaster", variants: [{ id: "base", level: 6, priceGp: 225, sourceSlug: "trackless", activation: null }, { id: "greater", level: 10, priceGp: 900, sourceSlug: "trackless-greater", activation: { actions: 2, traits: ["concentrate"], frequency: { max: 1, period: "day" }, effectText: "effect", spell: null } }] }] },
    openApplication: () => "opened"
  });
}

test("ItemForgeApi delegates canonical request operations", async () => {
  const api = apiFixture();
  assert.equal(api.normalize({ a: 1 }).normalized, true);
  assert.equal((await api.generate({ a: 1 })).kind, "generate");
  assert.equal((await api.preview({ a: 1 })).kind, "preview");
  assert.equal(api.validate({ a: 1 }).valid, true);
});

test("ItemForgeApi capabilities expose generator priority metadata and registered modes", () => {
  const capabilities = apiFixture().getCapabilities();
  assert.deepEqual(capabilities.generationModes, ["custom"]);
  assert.deepEqual(capabilities.generators, ["test"]);
  assert.deepEqual(capabilities.generatorMetadata, [{ id: "test", priority: 10, modes: ["custom"] }]);
  assert.deepEqual(capabilities.wandModes, ["standard", "special"]);
  assert.deepEqual(capabilities.wandProfiles, [{ id: "core.reaching", label: "Reaching", ranks: [1, 2], levels: [4, 6] }]);
  assert.deepEqual(capabilities.staffModes, ["generated", "existing"]);
  assert.deepEqual(capabilities.staffProfiles, [{ id: "core.3-8-12", label: "Profile", levels: [3, 8, 12] }]);
  assert.deepEqual(capabilities.spellheartModes, ["generated", "existing"]);
  assert.deepEqual(capabilities.spellheartProfiles, [{ id: "core.elemental-conduit", label: "Elemental", themes: ["fire", "cold"], levels: [3, 8, 13] }]);
  assert.ok(capabilities.magicItemKinds.includes("spellheart"));
  assert.ok(capabilities.magicItemKinds.includes("specific-weapon"));
  assert.ok(capabilities.magicItemKinds.includes("specific-armor"));
  assert.ok(capabilities.magicItemKinds.includes("specific-shield"));
  assert.ok(capabilities.magicItemKinds.includes("worn"));
  assert.ok(capabilities.magicItemKinds.includes("accessory-rune"));
  assert.deepEqual(capabilities.specificItemModes, ["generated", "existing"]);
  assert.deepEqual(capabilities.specificItemProfiles, [{ id: "core.retributive-weapon", itemType: "weapon", label: "Retributive", themes: [], levels: [3, 10, 16] }]);
  assert.deepEqual(capabilities.specificShieldProfiles, [{ id: "core.restorative-shield", label: "Restorative", themes: [], levels: [5, 10, 15] }]);
  assert.deepEqual(capabilities.wornItemModes, ["generated", "existing"]);
  assert.deepEqual(capabilities.wornMagicProfiles, [{ id: "core.wayfarer-footwear", slot: "footwear", label: "Wayfarer", invested: true, levels: [4, 10, 17] }]);
  assert.deepEqual(capabilities.accessoryRunes, [{ id: "trackless", label: "Trackless", targetKind: "footwear", host: { documentTypes: ["equipment"], wornSlots: ["footwear"], magicPolicy: "mundane-only" }, levels: [6, 10], variants: [{ id: "base", level: 6, priceGp: 225, sourceSlug: "trackless", activation: null }, { id: "greater", level: 10, priceGp: 900, sourceSlug: "trackless-greater", activation: { actions: 2, traits: ["concentrate"], frequency: { max: 1, period: "day" }, effectText: "effect", spell: null } }], source: "treasure-vault-remaster" }]);
  const footwear = capabilities.wornSlots.find((slot) => slot.id === "footwear");
  assert.equal(footwear.existing, true);
  assert.equal(footwear.generated, true);
  assert.equal(footwear.generatedProfileCount, 1);
  assert.deepEqual(footwear.generatedLevels, [4, 10, 17]);
  assert.equal(capabilities.wornSlots.find((slot) => slot.id === "backpack").generated, false);
});


test("ItemForgeApi exposes mode-aware worn slot capabilities for external callers", () => {
  const api = apiFixture();
  const slots = api.getWornSlotCapabilities();
  assert.equal(slots.find((slot) => slot.id === "footwear").generatedTemplateCount, 1);
  assert.equal(slots.find((slot) => slot.id === "footwear").existingCount, 1);
  assert.equal(slots.find((slot) => slot.id === "other").generated, false);
});

test("ItemForgeApi exposes compendium index diagnostics", () => {
  const diagnostics = apiFixture().getIndexDiagnostics();
  assert.equal(diagnostics.ready, true);
  assert.equal(diagnostics.physicalItems, 1);
  assert.equal(diagnostics.spells, 1);
  assert.deepEqual(diagnostics.packErrors, [{ pack: "bad.pack" }]);
});
