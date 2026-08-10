import test from "node:test";
import assert from "node:assert/strict";
import { AccessoryRuneGenerator } from "../../src/engine/generators/accessory-rune-generator.js";
import { AccessoryRuneRegistry, registerCoreAccessoryRunes } from "../../src/engine/registries/accessory-rune-registry.js";

function req(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.accessory-rune",
    level: { min: 6, max: 6, target: 6 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "system", includePacks: [], excludePacks: [] },
    magic: { accessoryRune: "trackless" },
    seed: "rune-seed",
    ...overrides
  };
}

function entry(id, { name = id, type = "equipment", level = 0, rarity = "common", usage = "worn shoes", traits = [], pack = "pf2e.equipment-srd" } = {}) {
  return { id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType: "system", packageName: "pf2e", name, type, level, rarity, usage, traits, categories: ["item", "equipment"] };
}

function source(e, { invested = false, price = { gp: 1, sp: 5 }, rules = [{ key: "Note", text: "base ability" }] } = {}) {
  return {
    _id: e.id,
    name: e.name,
    type: e.type,
    img: "icons/equipment/feet/boots-leather.webp",
    system: {
      level: { value: e.level },
      price: { value: structuredClone(price) },
      traits: { value: invested ? ["invested", ...e.traits] : [...e.traits], rarity: e.rarity },
      rarity: { value: e.rarity },
      usage: { value: e.usage },
      description: { value: "<p>Base item text.</p>" },
      rules: structuredClone(rules),
      counteract: { rank: 1 }
    },
    flags: {}
  };
}

function formatter(key, data = {}) {
  const values = {
    "PF2E_ITEM_FORGE.AccessoryRunes.Trackless": "Trackless",
    "PF2E_ITEM_FORGE.AccessoryRunes.Preserving": "Preserving",
    "PF2E_ITEM_FORGE.AccessoryRunes.Menacing": "Menacing",
    "PF2E_ITEM_FORGE.AccessoryRuneVariants.Base": "Base",
    "PF2E_ITEM_FORGE.AccessoryRuneVariants.Greater": "Greater",
    "PF2E_ITEM_FORGE.AccessoryRuneUsage.Footwear": "footwear",
    "PF2E_ITEM_FORGE.AccessoryRuneUsage.Container": "container",
    "PF2E_ITEM_FORGE.AccessoryRuneUsage.Clothing": "clothing",
    "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessBase": "Continuous vanishing tracks.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessGreater": "Continuous vanishing tracks and daily aura.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingBase": "Food lasts longer.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingBase": "+1 Coerce.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.AppliedName": "{baseName} ({runeName})",
    "PF2E_ITEM_FORGE.AccessoryRuneText.Heading": "Accessory Rune: {runeName}",
    "PF2E_ITEM_FORGE.AccessoryRuneText.RuleNote": "Level=max(base,rune); base abilities do not scale."
  };
  let text = values[key] ?? key;
  for (const [name, value] of Object.entries(data)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

function makeGenerator(entries, sources = new Map()) {
  const index = {
    ready: true,
    query() { return entries; },
    async getDocument(e) { return { toObject: () => structuredClone(sources.get(e.id) ?? source(e)) }; },
    async refresh() {}
  };
  return new AccessoryRuneGenerator({ compendiumIndex: index, accessoryRunes: registerCoreAccessoryRunes(new AccessoryRuneRegistry()), formatter });
}

test("trackless composes onto mundane footwear and applies the accessory-rune contract", async () => {
  const shoes = entry("shoes", { name: "Travel Shoes", level: 0, usage: "worn shoes" });
  const result = await makeGenerator([shoes]).generate(req());
  assert.equal(result.itemSource.system.level.value, 6);
  assert.deepEqual(result.itemSource.system.price.value, { pp: 22, gp: 6, sp: 5 });
  assert.ok(result.itemSource.system.traits.value.includes("invested"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.equal(result.itemSource.system.rules[0].text, "base ability", "base item abilities must remain untouched");
  assert.equal(result.itemSource.system.counteract.rank, 1, "rune-raised level must not scale base ability data");
  assert.equal(result.metadata.accessoryRune.runeLevel, 6);
  assert.equal(result.metadata.accessoryRune.effectiveLevel, 6);
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.itemSource.flags["pf2e-item-forge"].accessoryRune.family, "trackless");
});

test("preserving selects a container and menacing selects visible clothing", async () => {
  const bag = entry("bag", { type: "backpack", usage: "worn backpack" });
  const cloak = entry("cloak", { usage: "worn cloak" });
  const g = makeGenerator([bag, cloak]);
  const preserving = await g.generate(req({ level: { min: 3, max: 3, target: 3 }, magic: { accessoryRune: "preserving" }, seed: "p" }));
  assert.equal(preserving.metadata.accessoryRune.baseItem.type, "backpack");
  const menacing = await g.generate(req({ level: { min: 3, max: 3, target: 3 }, magic: { accessoryRune: "menacing" }, seed: "m" }));
  assert.equal(menacing.metadata.accessoryRune.baseItem.name, "cloak");
});

test("invested bases and incompatible usages are never candidates", async () => {
  const invested = entry("invested-boots", { usage: "worn shoes", traits: ["invested"] });
  const eyepiece = entry("glass", { usage: "worn eyepiece" });
  const g = makeGenerator([invested, eyepiece]);
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "NO_ACCESSORY_RUNE_CANDIDATE");
});

test("effective level is max of base and rune and nearest fallback remains deterministic", async () => {
  const highShoes = entry("high-shoes", { level: 8, usage: "worn shoes" });
  const g = makeGenerator([highShoes]);
  const exact = await g.generate(req({ level: { min: 8, max: 8, target: 8 }, magic: { accessoryRune: "trackless" } }));
  assert.equal(exact.metadata.level, 8);
  assert.equal(exact.metadata.accessoryRune.runeLevel, 6);
  const nearest1 = await g.generate(req({ level: { min: 7, max: 7, target: 7 }, levelPolicy: "nearest", magic: { accessoryRune: "trackless" }, seed: "same" }));
  const nearest2 = await g.generate(req({ level: { min: 7, max: 7, target: 7 }, levelPolicy: "nearest", magic: { accessoryRune: "trackless" }, seed: "same" }));
  assert.equal(nearest1.metadata.level, 8);
  assert.equal(nearest1.itemSource.name, nearest2.itemSource.name);
  assert.equal(nearest1.warnings[0].code, "LEVEL_TARGET_APPROXIMATED");
});

test("unknown accessory rune ids fail explicitly", async () => {
  const shoes = entry("shoes");
  await assert.rejects(() => makeGenerator([shoes]).generate(req({ magic: { accessoryRune: "missing" } })), (error) => error?.code === "UNKNOWN_ACCESSORY_RUNE");
});
