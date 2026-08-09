import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRegistry } from "../../src/engine/category-registry.js";
import { registerCoreCategories } from "../../src/engine/category-registry.js";
import { CompendiumIndex, SUPPORTED_ITEM_TYPES } from "../../src/engine/compendium-index.js";

class FakePackCollection {
  constructor(packs) {
    this.packs = packs;
    this.byId = new Map(packs.map((pack) => [pack.collection, pack]));
  }

  [Symbol.iterator]() {
    return this.packs[Symbol.iterator]();
  }

  get(id) {
    return this.byId.get(id);
  }
}

function makePack(id, entries) {
  return {
    collection: id,
    documentName: "Item",
    metadata: { label: id, packageType: "system", packageName: "pf2e" },
    async getIndex() { return entries; },
    async getDocument(entryId) {
      const entry = entries.find((candidate) => candidate._id === entryId);
      return entry ? { toObject: () => structuredClone(entry) } : null;
    }
  };
}

function raw(id, type, level = 1, extraSystem = {}) {
  return {
    _id: id,
    name: id,
    type,
    img: "icons/svg/item-bag.svg",
    system: {
      level: { value: level },
      rarity: { value: "common" },
      traits: { value: [] },
      ...extraSystem
    }
  };
}

test("CompendiumIndex excludes feats and spells from generic Item Forge generation", async () => {
  const mixedPack = makePack("pf2e.mixed", [
    raw("weapon", "weapon", 3),
    raw("feat", "feat", 3),
    raw("spell", "spell", 3)
  ]);
  const rulesOnlyPack = makePack("pf2e.rules-only", [
    raw("feat-only", "feat", 2),
    raw("spell-only", "spell", 2)
  ]);

  const categories = registerCoreCategories(new CategoryRegistry());
  const game = {
    system: { id: "pf2e" },
    packs: new FakePackCollection([mixedPack, rulesOnlyPack])
  };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });

  await index.refresh();

  assert.deepEqual(index.entries.map((entry) => entry.type), ["weapon"]);
  assert.deepEqual(index.spellEntries.map((entry) => entry.type), ["spell", "spell"]);
  assert.deepEqual(index.getAvailablePacks().map((pack) => pack.id), ["pf2e.mixed"]);
  assert.deepEqual(index.getAvailablePacks({ includeSpellPacks: true }).map((pack) => pack.id), ["pf2e.mixed", "pf2e.rules-only"]);

  const candidates = index.query({
    category: "item",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] }
  });
  assert.deepEqual(candidates.map((entry) => entry.type), ["weapon"]);

  const spells = index.querySpells({
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] }
  });
  assert.equal(spells.length, 2);
});

test("CompendiumIndex keeps supported physical PF2e item document types", async () => {
  for (const type of ["weapon", "armor", "shield", "consumable", "equipment", "treasure", "backpack", "book", "kit"]) {
    assert.equal(SUPPORTED_ITEM_TYPES.has(type), true, `${type} should be supported`);
  }
  for (const type of ["feat", "spell", "action", "effect", "condition", "ancestry", "class", "background", "melee"]) {
    assert.equal(SUPPORTED_ITEM_TYPES.has(type), false, `${type} should not be supported`);
  }
});


test("CompendiumIndex classifies PF2e wands and magical staves for magic generation", async () => {
  const pack = makePack("pf2e.magic", [
    raw("wand", "consumable", 7, { category: "wand", traits: { value: ["magical", "wand"], rarity: "common" } }),
    raw("magic-staff", "weapon", 8, { traits: { value: ["magical", "staff"], rarity: "common" }, slug: "staff-of-test" }),
    raw("mundane-staff", "weapon", 0, { traits: { value: [], rarity: "common" }, slug: "staff", baseItem: "staff" })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();
  assert.ok(index.entries.find((entry) => entry.id === "wand").categories.includes("magic.wand"));
  assert.ok(index.entries.find((entry) => entry.id === "magic-staff").categories.includes("magic.staff"));
  assert.equal(index.entries.find((entry) => entry.id === "mundane-staff").categories.includes("magic.staff"), false);
});
