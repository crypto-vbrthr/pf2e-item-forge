import test from "node:test";
import assert from "node:assert/strict";
import { SpellheartGenerator } from "../../src/engine/generators/spellheart-generator.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.spellheart",
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    seed: "spellheart-seed",
    ...overrides
  };
}

function entry(id, level, { rarity = "common" } = {}) {
  return {
    id,
    uuid: `Compendium.pf2e.equipment.Item.${id}`,
    pack: "pf2e.equipment",
    packageType: "system",
    packageName: "pf2e",
    name: id,
    type: "equipment",
    level,
    rarity,
    traits: ["magical", "spellheart"],
    usage: "affixed-to-armor-or-a-weapon",
    categories: ["item", "equipment", "magic", "magic.spellheart"]
  };
}

function documentFor(selected) {
  return {
    toObject: () => ({
      _id: selected.id,
      name: selected.name,
      type: "equipment",
      img: "spellheart.webp",
      system: {
        level: { value: selected.level },
        price: { value: { gp: 325 } },
        usage: { value: "affixed-to-armor-or-a-weapon" },
        traits: { value: ["magical", "spellheart"], rarity: selected.rarity },
        description: { value: "<p>Armor benefit.</p><p>Weapon benefit.</p><p>Activate Cast a Spell.</p>" },
        rules: [{ key: "FlatModifier", selector: "test", value: 1 }]
      }
    })
  };
}

function setup(entries) {
  return new SpellheartGenerator({
    compendiumIndex: {
      ready: true,
      query: () => entries,
      getDocument: async (selected) => documentFor(selected)
    }
  });
}

test("SpellheartGenerator preserves complete predefined PF2e spellheart rules", async () => {
  const selected = entry("warding-statuette", 7);
  const result = await setup([selected]).generate(request());
  assert.equal(result.metadata.generator, "spellheart");
  assert.equal(result.metadata.magic.kind, "spellheart");
  assert.equal(result.metadata.level, 7);
  assert.equal(result.itemSource._id, null);
  assert.deepEqual(result.itemSource.system.rules, [{ key: "FlatModifier", selector: "test", value: 1 }]);
  assert.match(result.itemSource.system.description.value, /Armor benefit/);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].spellheart.mode, "existing");
});

test("SpellheartGenerator respects strict item-level selection", async () => {
  await assert.rejects(
    () => setup([entry("low", 5), entry("high", 9)]).generate(request()),
    (error) => error?.code === "NO_PREDEFINED_SPELLHEART_CANDIDATE"
  );
});

test("SpellheartGenerator nearest policy selects the closest published level with a warning", async () => {
  const result = await setup([entry("low", 5), entry("high", 9)]).generate(request({
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "nearest"
  }));
  assert.ok([5, 9].includes(result.metadata.level));
  assert.equal(result.warnings[0]?.code, "LEVEL_TARGET_APPROXIMATED");
});

test("SpellheartGenerator is deterministic for identical seeds", async () => {
  const generator = setup([entry("a", 7), entry("b", 7), entry("c", 7)]);
  const first = await generator.generate(request({ seed: "same" }));
  const second = await generator.generate(request({ seed: "same" }));
  assert.equal(first.metadata.sourceUuid, second.metadata.sourceUuid);
});
