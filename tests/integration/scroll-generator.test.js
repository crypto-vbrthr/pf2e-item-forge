import test from "node:test";
import assert from "node:assert/strict";
import { ScrollGenerator, getMeaningfulSpellRanks } from "../../src/engine/generators/scroll-generator.js";

function request(overrides = {}) {
  return {
    mode: "existing",
    category: "consumable.scroll",
    level: { min: 5, max: 5, target: 5 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    seed: "scroll-seed",
    ...overrides
  };
}

function scrollTemplate(rank, level) {
  return {
    type: "consumable",
    toObject: () => ({
      _id: `template-${rank}`,
      name: `Generic Scroll ${rank}`,
      type: "consumable",
      img: "scroll.webp",
      system: {
        level: { value: level },
        category: "scroll",
        traits: { value: ["magical", "scroll", "consumable"], rarity: "common" },
        rarity: { value: "common" },
        description: { value: `<p>Generic rank ${rank} scroll.</p>` }
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
    heightening: { type: "interval", interval: 1, damage: {}, area: 0 },
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
  const byUuid = new Map(entries.map((entry) => [entry.uuid, entry]));
  const index = {
    ready: true,
    querySpells: () => entries,
    getSpellDocument: async (entry) => spellDocument(byUuid.get(entry.uuid))
  };
  const templates = {
    "uuid.scroll.1": scrollTemplate(1, 1),
    "uuid.scroll.2": scrollTemplate(2, 3),
    "uuid.scroll.3": scrollTemplate(3, 5)
  };
  const config = {
    PF2E: {
      spellcastingItems: {
        scroll: {
          nameTemplate: "TEST.ScrollName",
          compendiumUuids: { 1: "uuid.scroll.1", 2: "uuid.scroll.2", 3: "uuid.scroll.3" }
        }
      }
    }
  };
  return new ScrollGenerator({
    compendiumIndex: index,
    configProvider: () => config,
    uuidResolver: async (uuid) => templates[uuid] ?? null,
    randomId: () => "embedded-spell-id",
    formatter: (_key, { name, level }) => `Scroll: ${name} (Rank ${level})`
  });
}

test("getMeaningfulSpellRanks uses interval and fixed heightening without inventing ranks", () => {
  assert.deepEqual(getMeaningfulSpellRanks(spellEntry({ heightening: null })), [1]);
  assert.deepEqual(getMeaningfulSpellRanks(spellEntry({ heightening: { type: "interval", interval: 2 } })), [1, 3, 5, 7, 9]);
  assert.deepEqual(getMeaningfulSpellRanks(spellEntry({ baseRank: 2, heightening: { type: "fixed", levels: { 4: {}, 7: {} } } })), [2, 4, 7]);
});

test("getMeaningfulSpellRanks never down-ranks a spell above the requested maximum", () => {
  assert.deepEqual(getMeaningfulSpellRanks({ baseRank: 3, heightening: null }, { maxRank: 1 }), []);
});

test("ScrollGenerator embeds a level-appropriate heightened spell", async () => {
  const spell = spellEntry();
  const excludedCantrip = spellEntry({ id: "cantrip", uuid: "Compendium.test.spells.Item.cantrip", name: "Cantrip", cantrip: true });
  const excludedRitual = spellEntry({ id: "ritual", uuid: "Compendium.test.spells.Item.ritual", name: "Ritual", ritual: true });
  const generator = setup([spell, excludedCantrip, excludedRitual]);

  const result = await generator.generate(request());

  assert.equal(result.metadata.generator, "scroll");
  assert.equal(result.metadata.level, 5);
  assert.equal(result.metadata.spell.name, "Blazing Test");
  assert.equal(result.metadata.spell.baseRank, 1);
  assert.equal(result.metadata.spell.rank, 3);
  assert.equal(result.metadata.spell.heightened, true);
  assert.equal(result.itemSource.name, "Scroll: Blazing Test (Rank 3)");
  assert.equal(result.itemSource.system.spell._id, "embedded-spell-id");
  assert.equal(result.itemSource.system.spell.system.location.value, null);
  assert.equal(result.itemSource.system.spell.system.location.heightenedLevel, 3);
  assert.match(result.itemSource.system.description.value, /@UUID\[Compendium\.test\.spells\.Item\.spell-1\]/);
  assert.match(result.itemSource.system.description.value, /Generic rank 3 scroll/);
});

test("ScrollGenerator does not heighten a spell without a heightening entry", async () => {
  const generator = setup([spellEntry({ heightening: null })]);
  await assert.rejects(
    () => generator.generate(request()),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("ScrollGenerator is deterministic for the same seed", async () => {
  const generator = setup([
    spellEntry({ id: "a", uuid: "Compendium.test.spells.Item.a", name: "A" }),
    spellEntry({ id: "b", uuid: "Compendium.test.spells.Item.b", name: "B" })
  ]);
  const first = await generator.generate(request({ seed: "fixed" }));
  const second = await generator.generate(request({ seed: "fixed" }));
  assert.equal(second.metadata.spell.sourceUuid, first.metadata.spell.sourceUuid);
  assert.equal(second.metadata.spell.rank, first.metadata.spell.rank);
});
