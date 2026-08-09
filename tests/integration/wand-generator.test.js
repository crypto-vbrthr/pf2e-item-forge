import test from "node:test";
import assert from "node:assert/strict";
import { WandGenerator } from "../../src/engine/generators/wand-generator.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.wand",
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    magic: { theme: "fire", allowHeightened: true },
    seed: "wand-seed",
    ...overrides
  };
}

function wandTemplate(rank, level) {
  return {
    type: "consumable",
    toObject: () => ({
      _id: `wand-template-${rank}`,
      name: `Generic Wand ${rank}`,
      type: "consumable",
      img: "wand.webp",
      system: {
        level: { value: level },
        category: "wand",
        traits: { value: ["magical", "wand"], rarity: "common" },
        rarity: { value: "common" },
        description: { value: `<p>Generic rank ${rank} wand.</p>` }
      }
    })
  };
}

function spellEntry(overrides = {}) {
  return {
    id: "spell-1",
    uuid: "Compendium.test.spells.Item.spell-1",
    pack: "test.spells",
    name: "Blazing Test",
    img: "spell.webp",
    baseRank: 1,
    rarity: "common",
    traits: ["fire"],
    traditions: ["arcane"],
    ritual: false,
    cantrip: false,
    focus: false,
    heightening: { type: "interval", interval: 1 },
    slug: "blazing-test",
    ...overrides
  };
}

function spellDocument(entry) {
  return {
    toObject: () => ({
      _id: entry.id,
      name: entry.name,
      type: "spell",
      img: entry.img,
      system: {
        level: { value: entry.baseRank },
        traits: { value: entry.traits, rarity: entry.rarity, traditions: entry.traditions },
        location: { value: "somewhere" },
        heightening: entry.heightening,
        description: { value: "<p>A test spell.</p>" }
      }
    })
  };
}

function setup(entries) {
  const index = {
    ready: true,
    querySpells: () => entries,
    getSpellDocument: async (entry) => spellDocument(entry)
  };
  const templates = {
    "uuid.wand.1": wandTemplate(1, 3),
    "uuid.wand.2": wandTemplate(2, 5),
    "uuid.wand.3": wandTemplate(3, 7)
  };
  const config = {
    PF2E: {
      spellcastingItems: {
        wand: {
          nameTemplate: "TEST.WandName",
          compendiumUuids: { 1: "uuid.wand.1", 2: "uuid.wand.2", 3: "uuid.wand.3" }
        }
      }
    }
  };
  return new WandGenerator({
    compendiumIndex: index,
    configProvider: () => config,
    uuidResolver: async (uuid) => templates[uuid] ?? null,
    randomId: () => "wand-embedded-spell",
    formatter: (_key, { name, level }) => `Wand: ${name} (Rank ${level})`
  });
}

test("WandGenerator creates a level-appropriate wand with an embedded heightened spell", async () => {
  const generator = setup([
    spellEntry(),
    spellEntry({ id: "cold", uuid: "Compendium.test.spells.Item.cold", name: "Cold", traits: ["cold"] }),
    spellEntry({ id: "cantrip", uuid: "Compendium.test.spells.Item.cantrip", name: "Cantrip", cantrip: true })
  ]);
  const result = await generator.generate(request());
  assert.equal(result.metadata.generator, "wand");
  assert.equal(result.metadata.level, 7);
  assert.equal(result.metadata.spell.rank, 3);
  assert.equal(result.metadata.spell.heightened, true);
  assert.equal(result.itemSource.system.category, "wand");
  assert.equal(result.itemSource.system.spell._id, "wand-embedded-spell");
  assert.equal(result.itemSource.system.spell.system.location.heightenedLevel, 3);
  assert.match(result.itemSource.system.description.value, /@UUID\[Compendium\.test\.spells\.Item\.spell-1\]/);
});

test("WandGenerator does not invent heightened ranks when heightening is disabled", async () => {
  const generator = setup([spellEntry({ heightening: null })]);
  await assert.rejects(
    () => generator.generate(request()),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("WandGenerator obeys a selected magic theme", async () => {
  const generator = setup([
    spellEntry({ id: "fire", uuid: "Compendium.test.spells.Item.fire", name: "Fire", traits: ["fire"] }),
    spellEntry({ id: "cold", uuid: "Compendium.test.spells.Item.cold", name: "Cold", traits: ["cold"] })
  ]);
  const result = await generator.generate(request({ level: { min: 3, max: 3, target: 3 } }));
  assert.equal(result.metadata.spell.name, "Fire");
});
