import test from "node:test";
import assert from "node:assert/strict";
import { StaffGenerator, CORE_STAFF_PROFILE_LEVELS } from "../../src/engine/generators/staff-generator.js";
import { StaffProfileRegistry, registerCoreStaffProfiles } from "../../src/engine/registries/staff-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.staff",
    level: { min: 8, max: 8, target: 8 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    magic: { theme: "fire", allowHeightened: true, staffMode: "generated", staffProfile: "core.3-8-12" },
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
    baseItem: "staff",
    categories: ["item", "weapon", "weapon.melee"]
  };
}

function predefinedStaffEntry() {
  return {
    id: "staff-fire-greater",
    uuid: "Compendium.pf2e.equipment.Item.staff-fire-greater",
    pack: "pf2e.equipment",
    packageType: "system",
    packageName: "pf2e",
    name: "Greater Staff of Fire",
    type: "weapon",
    level: 8,
    rarity: "common",
    slug: "greater-staff-of-fire",
    categories: ["item", "weapon", "weapon.melee", "magic", "magic.staff"]
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

function predefinedStaffDocument() {
  return {
    toObject: () => ({
      _id: "staff-fire-greater",
      name: "Greater Staff of Fire",
      type: "weapon",
      img: "fire-staff.webp",
      system: {
        level: { value: 8 },
        price: { value: { gp: 450 } },
        traits: { value: ["magical", "staff"], rarity: "common" },
        specific: { value: true },
        description: { value: "<p>Official spell list and special rules.</p>" }
      }
    })
  };
}

function setup(spells, { includeBase = true, predefined = [] } = {}) {
  const base = baseStaffEntry();
  const entries = [...(includeBase ? [base] : []), ...predefined];
  const index = {
    ready: true,
    entries,
    querySpells: () => spells,
    query: () => predefined,
    getDocument: async (entry) => entry.id === "staff-base" ? baseStaffDocument() : predefinedStaffDocument()
  };
  const labels = {
    "PF2E_ITEM_FORGE.MagicThemes.Fire": "Fire",
    "PF2E_ITEM_FORGE.Magic.StaffName": "Staff — Fire",
    "PF2E_ITEM_FORGE.Magic.GreaterStaffName": "Greater Staff — Fire",
    "PF2E_ITEM_FORGE.Magic.MajorStaffName": "Major Staff — Fire",
    "PF2E_ITEM_FORGE.Magic.Cantrip": "Cantrip",
    "PF2E_ITEM_FORGE.Magic.GeneratedStaffFamilyDescription": "Generated family",
    "PF2E_ITEM_FORGE.Magic.StaffFamilyProfileDescription": "Family progression",
    "PF2E_ITEM_FORGE.Magic.StaffActivation": "Cast a Spell",
    "PF2E_ITEM_FORGE.Magic.HeightenedShort": "heightened",
    "PF2E_ITEM_FORGE.StaffVariants.Base": "Base variant",
    "PF2E_ITEM_FORGE.StaffVariants.Greater": "Greater staff",
    "PF2E_ITEM_FORGE.StaffVariants.Major": "Major staff"
  };
  return new StaffGenerator({
    compendiumIndex: index,
    staffProfiles: registerCoreStaffProfiles(new StaffProfileRegistry()),
    formatter: (key, data = {}) => {
      if (key === "PF2E_ITEM_FORGE.Magic.SpellRankLabel") return `Rank ${data.rank}`;
      return labels[key] ?? key;
    }
  });
}

const fireSpells = [
  spell("fire-cantrip", { cantrip: true, heightening: null }),
  spell("scaling-fire", { baseRank: 1, heightening: { type: "interval", interval: 1 } }),
  spell("fire-one-b", { baseRank: 1, heightening: null }),
  spell("fire-two", { baseRank: 2, heightening: { type: "interval", interval: 1 } }),
  spell("fire-three", { baseRank: 3, heightening: { type: "interval", interval: 1 } }),
  spell("fire-four", { baseRank: 4, heightening: { type: "interval", interval: 1 } }),
  spell("fire-five", { baseRank: 5, heightening: null }),
  spell("fire-six", { baseRank: 6, heightening: null })
];

test("core generated staff profiles use rules-style family progressions", () => {
  assert.deepEqual(CORE_STAFF_PROFILE_LEVELS, {
    "core.3-8-12": [3, 8, 12],
    "core.4-8-12": [4, 8, 12],
    "core.6-10-14": [6, 10, 14]
  });
});

test("StaffGenerator greater 3-8-12 staff inherits base ranks and adds only ranks 2 and 3", async () => {
  const result = await setup(fireSpells).generate(request());
  assert.equal(result.metadata.generator, "staff");
  assert.equal(result.metadata.level, 8);
  assert.equal(result.metadata.magic.profile, "core.3-8-12");
  assert.equal(result.metadata.magic.variant, "greater");
  assert.deepEqual(result.metadata.magic.profileLevels, [3, 8, 12]);
  assert.equal(result.itemSource.system.specific.value, true);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 450 });
  assert.ok(result.metadata.spells.some((entry) => entry.cantrip));
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 1 && entry.inherited));
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 2 && !entry.inherited));
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 3 && !entry.inherited));
  assert.ok(result.metadata.spells.every((entry) => entry.cantrip || entry.rank <= 3));
  assert.equal(result.metadata.staffFamily.length, 2);
  assert.match(result.itemSource.system.description.value, /@UUID\[Compendium\.test\.spells\.Item\./);
});

test("StaffGenerator major 3-8-12 staff contains inherited lower variants and new ranks 4 and 5", async () => {
  const result = await setup(fireSpells).generate(request({ level: { min: 12, max: 12, target: 12 } }));
  const ranks = new Set(result.metadata.spells.filter((entry) => !entry.cantrip).map((entry) => entry.rank));
  assert.deepEqual([...ranks].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.equal(result.metadata.staffFamily.length, 3);
  assert.equal(result.metadata.magic.variant, "major");
  assert.deepEqual(result.itemSource.system.price.value, { gp: 1800 });
});

test("generated family preserves base-tier spells for the same seed when a stronger variant is generated", async () => {
  const generator = setup(fireSpells);
  const base = await generator.generate(request({ level: { min: 3, max: 3, target: 3 }, seed: "family-stable" }));
  const major = await generator.generate(request({ level: { min: 12, max: 12, target: 12 }, seed: "family-stable" }));
  const baseSpells = base.metadata.spells.map(({ name, rank }) => [name, rank]);
  const inheritedBase = major.metadata.staffFamily[0].spells.map(({ name, rank }) => [name, rank]);
  assert.deepEqual(inheritedBase, baseSpells);
});

test("StaffGenerator can repeat a spell at a meaningful heightened rank in later variants", async () => {
  const result = await setup([
    spell("fire-cantrip", { cantrip: true, heightening: null }),
    spell("scaling-fire", { baseRank: 1, heightening: { type: "interval", interval: 1 } })
  ]).generate(request());
  assert.ok(result.metadata.spells.some((entry) => entry.rank > entry.baseRank && entry.heightened));
});

test("StaffGenerator supports the 6-10-14 rules-style family profile", async () => {
  const result = await setup(fireSpells).generate(request({
    level: { min: 10, max: 10, target: 10 },
    magic: { theme: "fire", allowHeightened: true, staffMode: "generated", staffProfile: "core.6-10-14" }
  }));
  assert.equal(result.metadata.magic.variant, "greater");
  assert.equal(result.metadata.magic.maxRank, 4);
  assert.deepEqual(result.metadata.magic.profileLevels, [6, 10, 14]);
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 1 && entry.inherited));
  assert.ok(result.metadata.spells.some((entry) => entry.rank === 4 && !entry.inherited));
});

test("StaffGenerator rejects a strict level that has no variant in the selected family", async () => {
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

test("StaffGenerator can select an exact predefined staff without replacing its rules content", async () => {
  const predefined = predefinedStaffEntry();
  const result = await setup(fireSpells, { predefined: [predefined] }).generate(request({
    magic: { theme: "automatic", allowHeightened: true, staffMode: "existing", staffProfile: "automatic" }
  }));
  assert.equal(result.metadata.magic.staffMode, "existing");
  assert.equal(result.itemSource.name, "Greater Staff of Fire");
  assert.match(result.itemSource.system.description.value, /Official spell list and special rules/);
  assert.equal(result.itemSource.system.specific.value, true);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].staff.mode, "existing");
});

test("StaffGenerator is deterministic for identical generated family requests and seeds", async () => {
  const generator = setup([...fireSpells, spell("fire-alt")]);
  const first = await generator.generate(request({ seed: "same" }));
  const second = await generator.generate(request({ seed: "same" }));
  assert.deepEqual(second.metadata.spells, first.metadata.spells);
  assert.deepEqual(second.metadata.staffFamily, first.metadata.staffFamily);
});
