import test from "node:test";
import assert from "node:assert/strict";
import { SpecificMagicEquipmentGenerator } from "../../src/engine/generators/specific-magic-equipment-generator.js";
import { SpecificItemProfileRegistry, registerCoreSpecificItemProfiles } from "../../src/engine/registries/specific-item-profile-registry.js";
import { PropertyRuneRegistry, registerCorePropertyRunes } from "../../src/engine/registries/property-rune-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.weapon",
    level: { min: 8, max: 8, target: 8 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    magic: { specificMode: "generated", specificProfile: "core.elemental-resonance-weapon", theme: "fire" },
    seed: "specific-seed",
    ...overrides
  };
}

function entry(id, type, { level = 0, rarity = "common", specific = null, range = null, armorCategory = null, traits = [], categories = null, group = null, damageType = null } = {}) {
  return {
    id,
    uuid: `Compendium.test.items.Item.${id}`,
    pack: "test.items",
    name: id,
    type,
    level,
    rarity,
    specific,
    range,
    armorCategory,
    traits,
    categories: categories ?? ["item", type],
    group,
    damageType,
    runes: {}
  };
}

function sourceFor(e, extra = {}) {
  return {
    _id: e.id,
    name: e.name,
    type: e.type,
    img: "icons/svg/item-bag.svg",
    system: {
      level: { value: e.level },
      price: { value: { gp: 1 } },
      traits: { value: [...e.traits], rarity: e.rarity },
      rarity: { value: e.rarity },
      runes: {},
      specific: structuredClone(e.specific),
      category: e.armorCategory,
      group: e.group,
      range: e.range,
      damage: { damageType: e.damageType },
      description: { value: `<p>Base ${e.name}</p>` }
    },
    ...extra
  };
}

function makeIndex(entries, sourceExtras = {}) {
  return {
    ready: true,
    query(req) {
      return entries.filter((e) => {
        if (req.category === "magic.weapon") return e.categories.includes("magic.weapon");
        if (req.category === "magic.armor") return e.categories.includes("magic.armor");
        if (req.category === "weapon") return e.type === "weapon";
        if (req.category === "armor") return e.type === "armor";
        return true;
      });
    },
    async getDocument(e) {
      return { toObject: () => sourceFor(e, sourceExtras[e.id] ?? {}) };
    },
    async refresh() {}
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponName": "Elemental {base} ({theme})",
    "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponDescription": "Elemental weapon.",
    "PF2E_ITEM_FORGE.SpecificItemText.ElementalWeaponEffect": "Deal {surgeDamage} {damageLabel}.",
    "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorName": "Guardian {base}",
    "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorDescription": "Guardian armor.",
    "PF2E_ITEM_FORGE.SpecificItemText.GuardianArmorEffect": "+{acBonus} AC, {frequency}.",
    "PF2E_ITEM_FORGE.SpecificItemText.OncePerDay": "once/day",
    "PF2E_ITEM_FORGE.SpecificItemText.OncePerHour": "once/hour",
    "PF2E_ITEM_FORGE.SpecificItemText.OncePerTenMinutes": "once/10min",
    "PF2E_ITEM_FORGE.SpecificItemText.SpecialAbility": "Special Ability:",
    "PF2E_ITEM_FORGE.SpecificItemText.PropertyRuneRestriction": "Specific rune restriction.",
    "PF2E_ITEM_FORGE.Damage.Fire": "fire damage",
    "PF2E_ITEM_FORGE.MagicThemes.Fire": "Fire",
    "PF2E_ITEM_FORGE.SpecificItemProfiles.ElementalWeapon": "Elemental weapon",
    "PF2E_ITEM_FORGE.SpecificItemProfiles.GuardianArmor": "Guardian armor",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function generator(entries, sourceExtras = {}) {
  return new SpecificMagicEquipmentGenerator({
    compendiumIndex: makeIndex(entries, sourceExtras),
    specificItemProfiles: registerCoreSpecificItemProfiles(new SpecificItemProfileRegistry()),
    propertyRunes: registerCorePropertyRunes(new PropertyRuneRegistry()),
    formatter
  });
}

test("predefined specific weapons are copied with native PF2e rule elements intact", async () => {
  const published = entry("published-blade", "weapon", {
    level: 8,
    specific: { material: { type: null, grade: null }, runes: { potency: 1, striking: 1, property: [] } },
    traits: ["magical"],
    categories: ["item", "weapon", "weapon.melee", "magic", "magic.weapon"]
  });
  const rules = [{ key: "FlatModifier", selector: "attack", value: 1 }];
  const result = await generator([published], { "published-blade": { system: { ...sourceFor(published).system, rules } } }).generate(request({
    level: { min: 8, max: 8, target: 8 },
    magic: { specificMode: "existing", specificProfile: "automatic", theme: "automatic" }
  }));

  assert.deepEqual(result.itemSource.system.rules, rules);
  assert.equal(result.metadata.specificItem.mode, "existing");
  assert.equal(result.itemSource.flags["pf2e-item-forge"].generated, false);
});

test("generated elemental specific weapon applies only profile-declared property rune", async () => {
  const sword = entry("longsword", "weapon", { damageType: "slashing", group: "sword", categories: ["item", "weapon", "weapon.melee"] });
  const result = await generator([sword]).generate(request());

  assert.ok(result.itemSource.system.specific);
  assert.deepEqual(result.itemSource.system.specific.runes, result.itemSource.system.runes);
  assert.equal(result.itemSource.system.level.value, 8);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 550 });
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.striking, 1);
  assert.deepEqual(result.itemSource.system.runes.property, ["flaming"]);
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.ok(result.itemSource.system.traits.value.includes("fire"));
  assert.equal(result.metadata.specificItem.automation, "rules-text");
  assert.match(result.metadata.specificItem.effect, /2d6 fire damage/);
});

test("generated guardian armor preserves armor base and applies profile fundamental runes", async () => {
  const leather = entry("leather", "armor", { armorCategory: "light", categories: ["item", "armor", "armor.light"] });
  const result = await generator([leather]).generate(request({
    category: "magic.armor",
    level: { min: 10, max: 10, target: 10 },
    magic: { specificMode: "generated", specificProfile: "core.guardian-reaction-armor", theme: "automatic" }
  }));

  assert.equal(result.itemSource.type, "armor");
  assert.ok(result.itemSource.system.specific);
  assert.deepEqual(result.itemSource.system.specific.runes, result.itemSource.system.runes);
  assert.equal(result.itemSource.system.runes.potency, 1);
  assert.equal(result.itemSource.system.runes.resilient, 1);
  assert.deepEqual(result.itemSource.system.runes.property, []);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 1050 });
  assert.match(result.metadata.specificItem.effect, /once\/hour/);
});

test("specific item generation rejects an unknown explicitly selected profile", async () => {
  const sword = entry("sword", "weapon", { categories: ["item", "weapon", "weapon.melee"] });
  await assert.rejects(
    () => generator([sword]).generate(request({ magic: { specificMode: "generated", specificProfile: "missing.profile", theme: "automatic" } })),
    (error) => error?.code === "UNKNOWN_SPECIFIC_ITEM_PROFILE"
  );
});

test("generated specific items are deterministic for the same seed", async () => {
  const entries = [
    entry("sword-a", "weapon", { categories: ["item", "weapon", "weapon.melee"] }),
    entry("sword-b", "weapon", { categories: ["item", "weapon", "weapon.melee"] })
  ];
  const g = generator(entries);
  const a = await g.generate(request({ magic: { specificMode: "generated", specificProfile: "core.retributive-weapon", theme: "automatic" }, level: { min: 3, max: 3, target: 3 } }));
  const b = await g.generate(request({ magic: { specificMode: "generated", specificProfile: "core.retributive-weapon", theme: "automatic" }, level: { min: 3, max: 3, target: 3 } }));
  assert.equal(a.itemSource.name, b.itemSource.name);
  assert.equal(a.metadata.specificItem.baseItem.uuid, b.metadata.specificItem.baseItem.uuid);
});
