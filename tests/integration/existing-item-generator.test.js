import test from "node:test";
import assert from "node:assert/strict";
import { ExistingItemGenerator } from "../../src/engine/generators/existing-item-generator.js";

function request(overrides = {}) {
  return {
    mode: "existing", category: "weapon",
    level: { min: 5, max: 7, target: null },
    levelPolicy: "strict", rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    seed: "same-seed", ...overrides
  };
}

test("ExistingItemGenerator never selects an item outside a strict level range", async () => {
  const entries = [
    { id: "a", uuid: "a", pack: "test", level: 4, rarity: "common" },
    { id: "b", uuid: "b", pack: "test", level: 6, rarity: "common" },
    { id: "c", uuid: "c", pack: "test", level: 8, rarity: "common" }
  ];
  const index = {
    ready: true, query: () => entries,
    getDocument: async (entry) => ({ toObject: () => ({ name: entry.id, type: "weapon" }) })
  };
  const result = await new ExistingItemGenerator({ compendiumIndex: index }).generate(request());
  assert.equal(result.metadata.level, 6);
});

test("ExistingItemGenerator returns a controlled error when strict filtering has no result", async () => {
  const index = {
    ready: true,
    query: () => [{ id: "a", uuid: "a", pack: "test", level: 2, rarity: "common" }],
    getDocument: async () => null
  };
  await assert.rejects(
    () => new ExistingItemGenerator({ compendiumIndex: index }).generate(request()),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("ExistingItemGenerator never returns a generic scroll template", async () => {
  const entries = [
    { id: "scroll", uuid: "scroll", pack: "test", level: 5, rarity: "common", consumableCategory: "scroll" },
    { id: "potion", uuid: "potion", pack: "test", level: 5, rarity: "common", consumableCategory: "potion" }
  ];
  const index = {
    ready: true,
    query: () => entries,
    getDocument: async (entry) => ({ toObject: () => ({ name: entry.id, type: "consumable" }) })
  };
  const result = await new ExistingItemGenerator({ compendiumIndex: index }).generate(request({
    category: "consumable",
    level: { min: 5, max: 5, target: 5 }
  }));
  assert.equal(result.itemSource.name, "potion");
});
