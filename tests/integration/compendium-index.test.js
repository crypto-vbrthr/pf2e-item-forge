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


test("CompendiumIndex classifies spellhearts as dedicated magic items", async () => {
  const pack = makePack("pf2e.spellhearts", [
    raw("spellheart", "equipment", 7, {
      traits: { value: ["magical", "spellheart", "force"], rarity: "common" },
      usage: { value: "affixed-to-armor-or-a-weapon" },
      description: { value: "<p>Armor and weapon benefits.</p>" }
    }),
    raw("ordinary-equipment", "equipment", 7, { traits: { value: ["magical"], rarity: "common" } })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();
  const spellheart = index.entries.find((entry) => entry.id === "spellheart");
  const ordinary = index.entries.find((entry) => entry.id === "ordinary-equipment");
  assert.ok(spellheart.categories.includes("magic.spellheart"));
  assert.ok(spellheart.categories.includes("magic"));
  assert.equal(spellheart.usage, "affixed-to-armor-or-a-weapon");
  assert.match(spellheart.description, /Armor and weapon benefits/);
  assert.equal(ordinary.categories.includes("magic.spellheart"), false);
});

test("CompendiumIndex records spell cast actions and whether a spell deals damage", async () => {
  const pack = makePack("pf2e.spell-shapes", [
    raw("damage-spell", "spell", 2, {
      traits: { value: ["fire"], rarity: "common", traditions: ["arcane"] },
      time: { value: "2" },
      damage: { "0": { formula: "2d6", damageType: "fire" } }
    }),
    raw("utility-spell", "spell", 2, {
      traits: { value: [], rarity: "common", traditions: ["arcane"] },
      time: { value: "reaction" },
      damage: {}
    })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();
  const damaging = index.spellEntries.find((entry) => entry.id === "damage-spell");
  const utility = index.spellEntries.find((entry) => entry.id === "utility-spell");
  assert.equal(damaging.castActions, 2);
  assert.equal(damaging.hasDamage, true);
  assert.equal(utility.castActions, null);
  assert.equal(utility.hasDamage, false);
});

test("CompendiumIndex classifies specific magic weapons and armor separately", async () => {
  const pack = makePack("pf2e.specific-items", [
    raw("specific-weapon", "weapon", 7, {
      specific: { material: { type: null, grade: null }, runes: { potency: 1, striking: 1, property: [] } },
      traits: { value: ["magical"], rarity: "common" },
      range: null
    }),
    raw("ordinary-weapon", "weapon", 7, { specific: null, traits: { value: ["magical"], rarity: "common" } }),
    raw("specific-armor", "armor", 8, {
      specific: { material: { type: null, grade: null }, runes: { potency: 1, resilient: 1, property: [] } },
      category: "medium",
      traits: { value: ["magical"], rarity: "common" }
    }),
    raw("ordinary-armor", "armor", 8, { specific: null, category: "medium", traits: { value: ["magical"], rarity: "common" } })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();

  assert.ok(index.entries.find((entry) => entry.id === "specific-weapon").categories.includes("magic.weapon"));
  assert.equal(index.entries.find((entry) => entry.id === "ordinary-weapon").categories.includes("magic.weapon"), false);
  assert.ok(index.entries.find((entry) => entry.id === "specific-armor").categories.includes("magic.armor"));
  assert.equal(index.entries.find((entry) => entry.id === "ordinary-armor").categories.includes("magic.armor"), false);
});


test("CompendiumIndex recognizes PF2e v14 non-null specific data objects and legacy markers", async () => {
  const pack = makePack("pf2e.specific-shapes", [
    raw("v14-specific", "weapon", 9, {
      specific: { material: { type: null, grade: null }, runes: { potency: 1, striking: 1, property: ["flaming"] } },
      traits: { value: ["magical"], rarity: "common" }
    }),
    raw("legacy-specific", "weapon", 9, {
      specific: { value: true },
      traits: { value: ["magical"], rarity: "common" }
    }),
    raw("legacy-not-specific", "weapon", 9, {
      specific: { value: false },
      traits: { value: ["magical"], rarity: "common" }
    })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();

  assert.ok(index.entries.find((entry) => entry.id === "v14-specific").categories.includes("magic.weapon"));
  assert.ok(index.entries.find((entry) => entry.id === "legacy-specific").categories.includes("magic.weapon"));
  assert.equal(index.entries.find((entry) => entry.id === "legacy-not-specific").categories.includes("magic.weapon"), false);
});

test("CompendiumIndex parses common PF2e spell action-time shapes defensively", async () => {
  const pack = makePack("pf2e.actions-shape", [
    raw("one", "spell", 1, { time: { value: "1 action" }, traits: { value: ["fire"], traditions: ["arcane"], rarity: "common" } }),
    raw("two", "spell", 1, { time: { value: "2 actions" }, traits: { value: ["fire"], traditions: ["arcane"], rarity: "common" } }),
    raw("reaction", "spell", 1, { time: { value: "reaction" }, traits: { value: ["fire"], traditions: ["arcane"], rarity: "common" } })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => ({ system: { id: "pf2e" }, packs: new FakePackCollection([pack]) }) });
  await index.refresh();
  assert.equal(index.spellEntries.find((entry) => entry.id === "one").castActions, 1);
  assert.equal(index.spellEntries.find((entry) => entry.id === "two").castActions, 2);
  assert.equal(index.spellEntries.find((entry) => entry.id === "reaction").castActions, null);
});


test("CompendiumIndex classifies magical shields separately and records shield durability", async () => {
  const pack = makePack("pf2e.magic-shields", [
    raw("specific-shield", "shield", 9, { traits: { value: ["magical"], rarity: "common" }, hardness: 10, hp: { value: 40, max: 40 }, acBonus: 2 }),
    raw("mundane-shield", "shield", 0, { traits: { value: [], rarity: "common" }, hardness: 5, hp: { value: 20, max: 20 }, acBonus: 2 })
  ]);
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([pack]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();
  const magical = index.entries.find((entry) => entry.id === "specific-shield");
  const mundane = index.entries.find((entry) => entry.id === "mundane-shield");
  assert.ok(magical.categories.includes("magic.shield"));
  assert.equal(magical.hardness, 10);
  assert.equal(magical.hp, 40);
  assert.equal(magical.brokenThreshold, 20);
  assert.equal(mundane.categories.includes("magic.shield"), false);
});

test("CompendiumIndex records pack indexing failures for diagnostics", async () => {
  const good = makePack("pf2e.good", [raw("weapon", "weapon", 1)]);
  const broken = {
    collection: "thirdparty.broken",
    documentName: "Item",
    metadata: { label: "Broken Pack", packageType: "module", packageName: "thirdparty" },
    async getIndex() { throw new Error("index exploded"); }
  };
  const categories = registerCoreCategories(new CategoryRegistry());
  const game = { system: { id: "pf2e" }, packs: new FakePackCollection([good, broken]) };
  const index = new CompendiumIndex({ categoryRegistry: categories, gameProvider: () => game });
  await index.refresh();

  assert.equal(index.entries.length, 1);
  assert.equal(index.getPackErrors().length, 1);
  assert.deepEqual(index.getPackErrors()[0], {
    pack: "thirdparty.broken",
    label: "Broken Pack",
    code: null,
    message: "index exploded"
  });
});
