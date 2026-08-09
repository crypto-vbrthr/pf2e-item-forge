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
    compendiumIndex: { refresh: async () => true, getAvailablePacks: () => [] },
    treasure: {
      types: { getAll: () => [] }, materials: { getAll: () => [] }, components: { getAll: () => [] },
      motifs: { getAll: () => [] }, conditions: { getAll: () => [] }, craftsmanship: { getAll: () => [] }, styles: { getAll: () => [] }
    },
    propertyRunes: { getAll: () => [] },
    wandProfiles: { getAll: () => [{ id: "core.reaching", label: "Reaching", variants: [{ rank: 1, level: 4 }, { rank: 2, level: 6 }] }] },
    staffProfiles: { getAll: () => [{ id: "core.3-8-12", label: "Profile", variants: [{ level: 3 }, { level: 8 }, { level: 12 }] }] },
    spellheartProfiles: { getAll: () => [{ id: "core.elemental-conduit", label: "Elemental", allowedThemes: ["fire", "cold"], variants: [{ level: 3 }, { level: 8 }, { level: 13 }] }] },
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
});
