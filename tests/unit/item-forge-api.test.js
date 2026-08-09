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
});
