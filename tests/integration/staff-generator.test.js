import test from "node:test";
import assert from "node:assert/strict";
import { StaffGenerator, STAFF_PROFILES } from "../../src/engine/generators/staff-generator.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.staff",
    level: { min: 8, max: 8, target: 8 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    magic: { theme: "fire", allowHeightened: true },
    seed: "staff-seed",
    ...overrides
  };
}

function spell(id, { baseRank = 1, cantrip = false, traits = ["fire"], heightening = { type: "interval", interval: 1 }, slug = id } = {}) {
  return {
    id,
    uuid: `Compendium.test.spells.Item.${id}`,
    pack: "test.spells",
    name: id,
    baseRank,
    rarity: "common",
    traits,
    traditions: ["arcane"],
    ritual: false,
    cantrip,
    focus: false,
    heightening,
    slug
  };
}

function baseStaffEntry() {
  return {
    id: "staff-base",
    uuid: "Compendium.pf2e.equipment.Item.staff-base",
    pack: "pf2e.equipment",
    packageType: "system",
    packageName: "pf2e",
    name: "Staff",
    type: "weapon",
    level: 0,
    slug: "staff",
    baseItem: "staff"
  };
}

function baseStaffDocument() {
  return {
    toObject: () => ({
      _id: "staff-base",
      name: "Staff",
      type: "weapon",
      img: "staff.webp",
      system: {
        level: { value: 0 },
        price: { value: { sp: 0 } },
        traits: { value: ["two-hand-d8"], rarity: "common" },
        rarity: { value: "common" },
        runes: { potency: 0, striking: 0, property: [] },
        specific: { value: false },
        description: { value: "<p>Base staff.</p>" }
      }
    })
  };
}

function setup(spells, { includeBase = true } = {}) {
  const entry = baseStaffEntry();
  const index = {
    ready: true,
    entries: includeBase ? [entry] : [],
    querySpells: () => spells,
    getDocument: async () => baseStaffDocument()
  };
  const labels = {
    "PF2E_ITEM_FORGE.MagicThemes.Fire": "Fire",
    "PF2E_ITEM_FORGE.Magic.StaffName": "Staff: Fire",
    "PF2E_ITEM_FORGE.Magic.Cantrip": "Cantrip",
    "PF2E_ITEM_FORGE.Magic.GeneratedStaffDescription": "Generated fire staff",
    "PF2E_ITEM_FORGE.Magic.StaffActivation": "Cast a Spell",
    "PF2E_ITEM_FORGE.Magic.HeightenedShort": "heightened"
  };
  return new StaffGenerator({
    compendiumIndex: index,
    formatter: (key, data = {}) => {
      if (key === "PF2E_ITEM_FORGE.Magic.SpellRankLabel") return `Rank ${data.rank}`;
      return labels[key] ?? key;
    }
  });
}

const fireSpells = [
  spell("fire-cantrip", { cantrip: true, heightening: null }),
  spell("fire-one"),
  spell("fire-two", { baseRank: 2 }),
  spell("fire-three", { baseRank: 3 })
];

test("generated staff profiles expose canonical spell-rank breakpoints", () => {
  assert.deepEqual(STAFF_PROFILES.map(({ level, maxRank }) => [level, maxRank]), [
    [3, 1], [4, 1], [6, 2], [8, 3], [10, 4], [12, 5], [14, 6], [16, 7], [18, 8], [20, 9]
  ]);
});

test("StaffGenerator creates a thematic weapon staff with cumulative ranked spells", async () => {
  const result = await setup(fireSpells).generate(request());
  assert.equal(result.metadata.generator, "staff");
  assert.equal(result.metadata.level, 8);
  assert.equal(result.metadata.magic.maxRank, 3);
  assert.equal(result.metadata.magic.theme, "fire");
  assert.equal(result.itemSource.type, "weapon");
  assert.ok(result.itemSource.system.traits.value.includes("staff"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.equal(result.itemSource.system.level.value, 8);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 450 });
  assert.ok(result.metadata.spells.some((entry) => entry.cantrip));
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 3));
  assert.ok(result.metadata.spells.every((entry) => entry.cantrip || entry.rank <= 3));
  assert.match(result.itemSource.system.description.value, /@UUID\[Compendium\.test\.spells\.Item\./);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].staff.maxRank, 3);
});

test("StaffGenerator can use a spell at a meaningful heightened rank", async () => {
  const result = await setup([
    spell("fire-cantrip", { cantrip: true, heightening: null }),
    spell("scaling-fire", { baseRank: 1, heightening: { type: "interval", interval: 1 } })
  ]).generate(request());
  assert.ok(result.metadata.spells.some((entry) => entry.rank > entry.baseRank && entry.heightened));
});

test("StaffGenerator rejects a strict level that has no generated staff profile", async () => {
  await assert.rejects(
    () => setup(fireSpells).generate(request({ level: { min: 9, max: 9, target: 9 } })),
    (error) => error?.code === "NO_ITEM_IN_LEVEL_RANGE"
  );
});

test("StaffGenerator reports a missing base staff template explicitly", async () => {
  await assert.rejects(
    () => setup(fireSpells, { includeBase: false }).generate(request()),
    (error) => error?.code === "NO_STAFF_BASE_ITEM"
  );
});

test("StaffGenerator is deterministic for identical requests and seeds", async () => {
  const generator = setup([...fireSpells, spell("fire-alt")]);
  const first = await generator.generate(request({ seed: "same" }));
  const second = await generator.generate(request({ seed: "same" }));
  assert.deepEqual(second.metadata.spells, first.metadata.spells);
});
