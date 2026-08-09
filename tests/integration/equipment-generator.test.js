import test from "node:test";
import assert from "node:assert/strict";
import { EquipmentGenerator } from "../../src/engine/generators/equipment-generator.js";
import { PropertyRuneRegistry, registerCorePropertyRunes } from "../../src/engine/registries/property-rune-registry.js";

function makeEntry(type, overrides = {}) {
  return {
    id: `${type}-base`,
    uuid: `Compendium.test.items.Item.${type}-base`,
    pack: "test.items",
    name: `Test ${type}`,
    type,
    level: 0,
    rarity: "common",
    traits: [],
    range: null,
    armorCategory: type === "armor" ? "light" : null,
    damageType: type === "weapon" ? "slashing" : null,
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
        system: {
          level: { value: entry.level },
          rarity: { value: entry.rarity },
          runes: {},
          category: entry.armorCategory,
          damage: { damageType: entry.damageType },
          traits: { value: entry.traits }
        }
      })
    })
  };
}

function generator(entries) {
  return new EquipmentGenerator({
    compendiumIndex: makeIndex(entries),
    propertyRunes: registerCorePropertyRunes(new PropertyRuneRegistry())
  });
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
    equipment: {
      fundamentalRunes: "automatic",
      propertyRunes: { mode: "automatic", selected: [] }
    },
    seed: "equipment-seed",
    ...overrides
  };
}

test("EquipmentGenerator composes a level 4 weapon and applies a level-appropriate property rune", async () => {
  const result = await generator([makeEntry("weapon")]).generate(request("weapon", 4));

  assert.equal(result.metadata.level, 4);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.striking, 1);
  assert.equal(result.metadata.propertyRuneCapacity, 1);
  assert.deepEqual(result.itemSource.system.runes.property, ["ghost-touch"]);
  assert.equal(result.plan.baseItem.name, "Test weapon");
});

test("property runes can bridge levels not present in the fundamental progression", async () => {
  const result = await generator([makeEntry("weapon")]).generate(request("weapon", 8));
  assert.equal(result.metadata.level, 8);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.striking, 1);
  assert.equal(result.itemSource.system.runes.property.length, 1);
  assert.equal(result.metadata.propertyRunes[0].level, 8);
});

test("EquipmentGenerator composes armor property runes within armor restrictions", async () => {
  const result = await generator([makeEntry("armor", { armorCategory: "light" })]).generate(request("armor", 8));

  assert.equal(result.metadata.level, 8);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.resilient, 1);
  assert.equal(result.itemSource.system.runes.property.length, 1);
});

test("EquipmentGenerator composes reinforcing shields without property runes", async () => {
  const result = await generator([makeEntry("shield")]).generate(request("shield", 7));

  assert.equal(result.metadata.level, 7);
  assert.equal(result.itemSource.system.runes.reinforcing, 2);
  assert.equal(result.metadata.propertyRuneCapacity, 0);
  assert.deepEqual(result.metadata.propertyRunes, []);
});

test("fixed property rune selection is applied exactly", async () => {
  const result = await generator([makeEntry("weapon")]).generate(request("weapon", 8, {
    equipment: {
      fundamentalRunes: "automatic",
      propertyRunes: { mode: "fixed", selected: ["flaming"] }
    }
  }));

  assert.deepEqual(result.itemSource.system.runes.property, ["flaming"]);
  assert.equal(result.metadata.level, 8);
});

test("incompatible fixed property runes are rejected", async () => {
  await assert.rejects(
    () => generator([makeEntry("weapon", { range: 60 })]).generate(request("weapon", 6, {
      equipment: {
        fundamentalRunes: "automatic",
        propertyRunes: { mode: "fixed", selected: ["shifting"] }
      }
    })),
    (error) => error?.code === "INVALID_PROPERTY_RUNE_SELECTION"
  );
});

test("EquipmentGenerator refuses a strict level with no valid rune combination", async () => {
  await assert.rejects(
    () => generator([makeEntry("weapon")]).generate(request("weapon", 15)),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("EquipmentGenerator is deterministic for the same seed including random property runes", async () => {
  const entries = [makeEntry("weapon", { id: "a", uuid: "a", name: "A" }), makeEntry("weapon", { id: "b", uuid: "b", name: "B" })];
  const gen = generator(entries);
  const req = request("weapon", 10, {
    equipment: {
      fundamentalRunes: "automatic",
      propertyRunes: { mode: "random", selected: [] }
    }
  });
  const first = await gen.generate(req);
  const second = await gen.generate(req);
  assert.equal(first.plan.baseItem.uuid, second.plan.baseItem.uuid);
  assert.deepEqual(first.itemSource.system.runes.property, second.itemSource.system.runes.property);
});
