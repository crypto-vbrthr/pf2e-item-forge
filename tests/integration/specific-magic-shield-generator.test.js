import test from "node:test";
import assert from "node:assert/strict";
import { SpecificMagicShieldGenerator } from "../../src/engine/generators/specific-magic-shield-generator.js";
import { SpecificShieldProfileRegistry, registerCoreSpecificShieldProfiles } from "../../src/engine/registries/specific-shield-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.shield",
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    magic: { specificMode: "generated", specificProfile: "core.elemental-bastion-shield", theme: "fire" },
    seed: "shield-seed",
    ...overrides
  };
}

function entry(id, { level = 0, rarity = "common", traits = [], categories = ["item", "shield"], runes = {}, hardness = 5, hp = 20, bt = 10 } = {}) {
  return {
    id, uuid: `Compendium.test.shields.Item.${id}`, pack: "test.shields", packageType: "system", packageName: "pf2e",
    name: id, type: "shield", level, rarity, traits, categories, runes, baseItem: id, slug: id,
    hardness, hp, brokenThreshold: bt
  };
}

function sourceFor(e, extra = {}) {
  return {
    _id: e.id, name: e.name, type: "shield", img: "icons/svg/shield.svg",
    system: {
      level: { value: e.level }, price: { value: { gp: 1 } }, traits: { value: [...e.traits], rarity: e.rarity },
      rarity: { value: e.rarity }, runes: structuredClone(e.runes ?? {}), baseItem: e.baseItem,
      hardness: e.hardness, hp: { value: e.hp, max: e.hp }, acBonus: 2,
      description: { value: `<p>Base ${e.name}</p>` }, rules: []
    },
    ...extra
  };
}

function makeIndex(entries, extras = {}) {
  return {
    ready: true,
    query(req) {
      return entries.filter((e) => {
        if (req.category === "magic.shield") return e.categories.includes("magic.shield");
        if (req.category === "shield") return e.categories.includes("shield");
        return true;
      });
    },
    async getDocument(e) { return { toObject: () => sourceFor(e, extras[e.id] ?? {}) }; },
    async refresh() {}
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionName": "{theme} bastion ({base})",
    "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionDescription": "Elemental shield.",
    "PF2E_ITEM_FORGE.SpecificShieldText.ElementalBastionEffect": "Resistance {resistance} to {damageLabel}.",
    "PF2E_ITEM_FORGE.SpecificShieldText.SpecialAbility": "Special Ability:",
    "PF2E_ITEM_FORGE.SpecificItemText.SpecialAbility": "Special Ability:",
    "PF2E_ITEM_FORGE.SpecificShieldText.DurabilityNote": "Durability is intrinsic.",
    "PF2E_ITEM_FORGE.SpecificShieldProfiles.ElementalBastion": "Elemental Bastion",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base",
    "PF2E_ITEM_FORGE.MagicThemes.Fire": "Fire",
    "PF2E_ITEM_FORGE.Damage.Fire": "fire"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function generator(entries, extras = {}) {
  return new SpecificMagicShieldGenerator({
    compendiumIndex: makeIndex(entries, extras),
    specificShieldProfiles: registerCoreSpecificShieldProfiles(new SpecificShieldProfileRegistry()),
    formatter
  });
}

test("predefined specific magic shields preserve native PF2e data", async () => {
  const published = entry("clockwork", { level: 11, traits: ["magical"], categories: ["item", "shield", "magic", "magic.shield"], hardness: 12, hp: 90, bt: 45 });
  const rules = [{ key: "Resistance", type: "fire", value: 5 }];
  const result = await generator([published], { clockwork: { system: { ...sourceFor(published).system, rules } } }).generate(request({
    level: { min: 11, max: 11, target: 11 },
    magic: { specificMode: "existing", specificProfile: "automatic", theme: "automatic" }
  }));
  assert.deepEqual(result.itemSource.system.rules, rules);
  assert.equal(result.metadata.automation.level, "native");
  assert.equal(result.metadata.specificItem.durability.hardness, 12);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].generated, false);
});

test("generated elemental shield applies explicit profile durability and rules-text effect", async () => {
  const base = entry("steel-shield");
  const result = await generator([base]).generate(request());
  assert.equal(result.itemSource.type, "shield");
  assert.equal(result.itemSource.system.level.value, 7);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 360 });
  assert.equal(result.itemSource.system.hardness, 7);
  assert.equal(result.itemSource.system.hp.max, 48);
  assert.equal(result.itemSource.system.hp.value, 48);
  assert.equal(result.itemSource.system.runes.reinforcing, 0);
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.ok(result.itemSource.system.traits.value.includes("fire"));
  assert.equal(result.metadata.specificItem.durability.bt, 24);
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.match(result.metadata.specificItem.effect, /Resistance 2 to fire/);
});

test("generated specific shields obey strict level constraints", async () => {
  const base = entry("steel-shield");
  await assert.rejects(
    () => generator([base]).generate(request({ level: { min: 6, max: 6, target: 6 } })),
    (error) => error?.code === "NO_SPECIFIC_SHIELD_PROFILE_CANDIDATE"
  );
});

test("generated specific shields are deterministic for the same seed", async () => {
  const entries = [entry("steel-shield"), entry("wooden-shield", { hardness: 3, hp: 12, bt: 6 })];
  const g = generator(entries);
  const req = request({ level: { min: 5, max: 5, target: 5 }, magic: { specificMode: "generated", specificProfile: "core.restorative-shield", theme: "automatic" } });
  const a = await g.generate(req);
  const b = await g.generate(req);
  assert.equal(a.itemSource.name, b.itemSource.name);
  assert.equal(a.metadata.specificItem.baseItem.uuid, b.metadata.specificItem.baseItem.uuid);
});

test("generated specific shield never lowers the rarity of its base shield", async () => {
  const base = entry("rare-shield", { rarity: "rare" });
  const registry = new SpecificShieldProfileRegistry();
  registry.register({
    id: "test.uncommon-profile",
    rarity: "uncommon",
    nameTemplate: "Profile {base}",
    effectText: "Effect",
    variants: [{ level: 5, price: 200, durability: { hardness: 6, hp: 30, bt: 15 } }]
  });
  const g = new SpecificMagicShieldGenerator({ compendiumIndex: makeIndex([base]), specificShieldProfiles: registry, formatter });
  const result = await g.generate(request({
    level: { min: 5, max: 5, target: 5 },
    magic: { specificMode: "generated", specificProfile: "test.uncommon-profile", theme: "automatic" }
  }));
  assert.equal(result.metadata.rarity, "rare");
  assert.equal(result.itemSource.system.traits.rarity, "rare");
});
