import test from "node:test";
import assert from "node:assert/strict";
import { WornMagicItemGenerator } from "../../src/engine/generators/worn-magic-item-generator.js";
import { WornMagicProfileRegistry, registerCoreWornMagicProfiles } from "../../src/engine/registries/worn-magic-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.worn",
    level: { min: 4, max: 4, target: 4 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "system", includePacks: [], excludePacks: [] },
    magic: { wornMode: "generated", wornProfile: "core.wayfarer-footwear" },
    seed: "worn-seed",
    ...overrides
  };
}

function entry(id, { name = id, level = 4, rarity = "common", slot = "footwear", usage = "worn shoes", categories = null, traits = ["invested", "magical"], pack = "pf2e.equipment-srd" } = {}) {
  return {
    id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType: "system", packageName: "pf2e",
    name, type: "equipment", level, rarity, wornSlot: slot, usage, traits,
    categories: categories ?? ["item", "magic", "magic.worn", `magic.worn.${slot}`]
  };
}

function sourceFor(e, { rules = [{ key: "FlatModifier", selector: "acrobatics", value: 99 }] } = {}) {
  return {
    _id: e.id,
    name: e.name,
    type: "equipment",
    img: "icons/equipment/feet/boots-leather-brown.webp",
    system: {
      level: { value: e.level },
      price: { value: { gp: 90 } },
      traits: { value: [...e.traits], rarity: e.rarity },
      rarity: { value: e.rarity },
      usage: { value: e.usage },
      description: { value: `<p>${e.name}</p>` },
      rules: structuredClone(rules),
      slug: e.id
    },
    flags: { pf2e: { sourceId: e.uuid } }
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.WornProfiles.WayfarerFootwear": "Wayfarer Footwear",
    "PF2E_ITEM_FORGE.WornProfiles.MercifulMask": "Merciful Mask",
    "PF2E_ITEM_FORGE.WornText.WayfarerFootwearName": "Wayfarer Shoes",
    "PF2E_ITEM_FORGE.WornText.WayfarerFootwearDescription": "Travel shoes.",
    "PF2E_ITEM_FORGE.WornText.WayfarerFootwearEffect": "Acrobatics +{bonus}; {frequency}.",
    "PF2E_ITEM_FORGE.WornText.MercifulMaskName": "Merciful Mask",
    "PF2E_ITEM_FORGE.WornText.MercifulMaskDescription": "Healing mask.",
    "PF2E_ITEM_FORGE.WornText.MercifulMaskEffect": "Medicine +{bonus}; {frequency}.",
    "PF2E_ITEM_FORGE.WornText.OncePerDay": "once per day",
    "PF2E_ITEM_FORGE.WornText.OncePerHour": "once per hour",
    "PF2E_ITEM_FORGE.WornText.SpecialAbility": "Special Ability:",
    "PF2E_ITEM_FORGE.WornText.InvestmentNote": "Rules-text item.",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Greater": "Greater",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Major": "Major"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function makeGenerator(entries) {
  const byUuid = new Map(entries.map((e) => [e.uuid, e]));
  const index = {
    ready: true,
    entries,
    query(req) {
      return entries.filter((e) => {
        if (!e.categories.includes("magic.worn")) return false;
        if (req.category !== "magic.worn" && !e.categories.includes(req.category)) return false;
        if (req.rarity?.length && !req.rarity.includes(e.rarity)) return false;
        return true;
      });
    },
    async getDocument(e) {
      const entryValue = byUuid.get(e.uuid) ?? e;
      return { toObject: () => sourceFor(entryValue) };
    },
    async refresh() {}
  };
  const templateResolver = {
    resolveWornTemplateEntry(slot) {
      return entries.find((e) => e.wornSlot === slot) ?? null;
    },
    templateMetadata(e, { kind }) {
      return { kind, source: "implementation-template", uuid: e.uuid, pack: e.pack };
    }
  };
  return new WornMagicItemGenerator({
    compendiumIndex: index,
    wornMagicProfiles: registerCoreWornMagicProfiles(new WornMagicProfileRegistry()),
    templateResolver,
    formatter
  });
}

test("predefined worn magic items preserve native PF2e automation and usage", async () => {
  const published = entry("mirror-goggles", { level: 5, slot: "eyepiece", usage: "worn eyepiece" });
  const g = makeGenerator([published]);
  const result = await g.generate(request({
    category: "magic.worn.eyepiece",
    level: { min: 5, max: 5, target: 5 },
    magic: { wornMode: "existing", wornProfile: "automatic" }
  }));
  assert.equal(result.itemSource.system.usage.value, "worn eyepiece");
  assert.equal(result.itemSource.system.rules[0].value, 99);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].generated, false);
  assert.equal(result.metadata.automation.level, "native");
  assert.equal(result.metadata.wornItem.slot, "eyepiece");
});

test("generated worn item uses a slot-matched PF2e template but strips its native rules", async () => {
  const shoes = entry("boots-template", { level: 2, slot: "footwear", usage: "worn shoes" });
  const result = await makeGenerator([shoes]).generate(request());
  assert.equal(result.itemSource.type, "equipment");
  assert.equal(result.itemSource.system.usage.value, "worn shoes");
  assert.equal(result.itemSource.system.level.value, 4);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 90 });
  assert.deepEqual(result.itemSource.system.rules, []);
  assert.ok(result.itemSource.system.traits.value.includes("invested"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.metadata.contentSources.length, 0);
  assert.equal(result.metadata.templateSource.uuid, shoes.uuid);
  assert.equal(result.metadata.wornItem.profile, "core.wayfarer-footwear");
  assert.match(result.metadata.wornItem.effect, /Acrobatics \+1/);
});

test("worn subcategory restricts automatic generated profiles to the requested usage type", async () => {
  const shoes = entry("boots-template", { slot: "footwear", usage: "worn shoes" });
  const mask = entry("mask-template", { slot: "mask", usage: "worn mask" });
  const result = await makeGenerator([shoes, mask]).generate(request({
    category: "magic.worn.mask",
    magic: { wornMode: "generated", wornProfile: "automatic" }
  }));
  assert.equal(result.metadata.wornItem.slot, "mask");
  assert.equal(result.metadata.wornItem.profile, "core.merciful-mask");
  assert.equal(result.itemSource.system.usage.value, "worn mask");
});

test("explicit worn profiles remain strict even though automatic generation has broader level coverage", async () => {
  const shoes = entry("boots-template", { slot: "footwear", usage: "worn shoes" });
  const g = makeGenerator([shoes]);
  await assert.rejects(
    () => g.generate(request({ level: { min: 6, max: 6, target: 6 }, magic: { wornMode: "generated", wornProfile: "core.wayfarer-footwear" } })),
    (error) => error?.code === "NO_WORN_ITEM_PROFILE_CANDIDATE"
  );
  await assert.rejects(
    () => g.generate(request({ magic: { wornMode: "generated", wornProfile: "missing.profile" } })),
    (error) => error?.code === "UNKNOWN_WORN_ITEM_PROFILE"
  );
});

test("automatic generated worn items have a strict core candidate at every level from 4 through 20", async () => {
  const templates = [
    entry("boots-template", { slot: "footwear", usage: "worn shoes" }),
    entry("eyepiece-template", { slot: "eyepiece", usage: "worn eyepiece" }),
    entry("belt-template", { slot: "belt", usage: "worn belt" }),
    entry("cloak-template", { slot: "cloak", usage: "worn cloak" }),
    entry("mask-template", { slot: "mask", usage: "worn mask" }),
    entry("circlet-template", { slot: "circlet", usage: "worn circlet" }),
    entry("gloves-template", { slot: "gloves", usage: "worn gloves" }),
    entry("bracers-template", { slot: "bracers", usage: "worn bracers" }),
    entry("garment-template", { slot: "garment", usage: "worn garment" }),
    entry("jewelry-template", { slot: "unrestricted", usage: "worn" }),
    entry("headwear-template", { slot: "headwear", usage: "worn headwear" })
  ];
  const g = makeGenerator(templates);
  for (let level = 4; level <= 20; level += 1) {
    const result = await g.generate(request({
      level: { min: level, max: level, target: level },
      magic: { wornMode: "generated", wornProfile: "automatic" },
      seed: `worn-level-${level}`
    }));
    assert.equal(result.metadata.level, level);
  }
});

test("generated worn items are deterministic for the same seed", async () => {
  const cloak = entry("cloak-template", { slot: "cloak", usage: "worn cloak" });
  const g = makeGenerator([cloak]);
  const req = request({ level: { min: 5, max: 5, target: 5 }, magic: { wornMode: "generated", wornProfile: "core.guardian-cloak" } });
  const a = await g.generate(req);
  const b = await g.generate(req);
  assert.equal(a.metadata.wornItem.profile, b.metadata.wornItem.profile);
  assert.equal(a.itemSource.name, b.itemSource.name);
  assert.equal(a.metadata.wornItem.effect, b.metadata.wornItem.effect);
});
