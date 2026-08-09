import test from "node:test";
import assert from "node:assert/strict";
import { EquipmentGenerator } from "../../src/engine/generators/equipment-generator.js";

function makeEntry(type, overrides = {}) {
  return {
    id: `${type}-base`,
    uuid: `Compendium.test.items.Item.${type}-base`,
    pack: "test.items",
    name: `Test ${type}`,
    type,
    level: 0,
    rarity: "common",
    runes: {},
    specific: null,
    ...overrides
  };
}

function makeIndex(entries) {
  return {
    ready: true,
    query: () => entries,
    getDocument: async (entry) => ({
      toObject: () => ({
        _id: entry.id,
        name: entry.name,
        type: entry.type,
        system: { level: { value: entry.level }, runes: {} }
      })
    })
  };
}

function request(category, level, overrides = {}) {
  return {
    mode: "equipment",
    category,
    level: { min: level, max: level, target: level },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    solver: { maxAttempts: 50 },
    equipment: { fundamentalRunes: "automatic" },
    seed: "equipment-seed",
    ...overrides
  };
}

test("EquipmentGenerator composes a level 4 striking weapon", async () => {
  const generator = new EquipmentGenerator({ compendiumIndex: makeIndex([makeEntry("weapon")]) });
  const result = await generator.generate(request("weapon", 4));

  assert.equal(result.metadata.level, 4);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.striking, 1);
  assert.equal(result.metadata.propertyRuneCapacity, 1);
  assert.equal(result.plan.baseItem.name, "Test weapon");
});

test("EquipmentGenerator composes the canonical armor progression", async () => {
  const generator = new EquipmentGenerator({ compendiumIndex: makeIndex([makeEntry("armor")]) });
  const result = await generator.generate(request("armor", 8));

  assert.equal(result.metadata.level, 8);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.resilient, 1);
});

test("EquipmentGenerator composes reinforcing shields without property slots", async () => {
  const generator = new EquipmentGenerator({ compendiumIndex: makeIndex([makeEntry("shield")]) });
  const result = await generator.generate(request("shield", 7));

  assert.equal(result.metadata.level, 7);
  assert.equal(result.itemSource.system.runes.reinforcing, 2);
  assert.equal(result.metadata.propertyRuneCapacity, 0);
});

test("EquipmentGenerator refuses a strict level with no valid fundamental-rune profile", async () => {
  const generator = new EquipmentGenerator({ compendiumIndex: makeIndex([makeEntry("weapon")]) });
  await assert.rejects(
    () => generator.generate(request("weapon", 8)),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("EquipmentGenerator is deterministic for the same seed", async () => {
  const entries = [makeEntry("weapon", { id: "a", uuid: "a", name: "A" }), makeEntry("weapon", { id: "b", uuid: "b", name: "B" })];
  const generator = new EquipmentGenerator({ compendiumIndex: makeIndex(entries) });
  const first = await generator.generate(request("weapon", 4));
  const second = await generator.generate(request("weapon", 4));
  assert.equal(first.plan.baseItem.uuid, second.plan.baseItem.uuid);
});
