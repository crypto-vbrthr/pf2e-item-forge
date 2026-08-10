import test from "node:test";
import assert from "node:assert/strict";
import { HeldMagicItemGenerator } from "../../src/engine/generators/held-magic-item-generator.js";
import { HeldMagicProfileRegistry, registerCoreHeldMagicProfiles } from "../../src/engine/registries/held-magic-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.held",
    level: { min: 1, max: 1, target: 1 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "system", includePacks: [], excludePacks: [] },
    magic: { heldMode: "generated", heldProfile: "automatic" },
    seed: "held-seed",
    ...overrides
  };
}

function entry(id, { hands = 1, level = 1, rarity = "common", traits = ["magical"], type = "equipment", usage = null, pack = "pf2e.equipment-srd" } = {}) {
  const actualUsage = usage ?? `held in ${hands} hand${hands === 2 ? "s" : ""}`;
  return {
    id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType: "system", packageName: "pf2e",
    name: id, type, level, rarity, heldHands: hands, usage: actualUsage, traits,
    categories: ["item", "magic", "magic.held", hands === 2 ? "magic.held.two-hands" : "magic.held.one-hand"]
  };
}

function sourceFor(e) {
  return {
    _id: e.id, name: e.name, type: e.type, img: "icons/sundries/lights/lantern-iron-yellow.webp",
    system: {
      level: { value: e.level }, price: { value: { gp: 100 } },
      traits: { value: [...e.traits], rarity: e.rarity }, rarity: { value: e.rarity },
      usage: { value: e.usage }, description: { value: `<p>${e.name}</p>` },
      rules: [{ key: "FlatModifier", value: 99 }], slug: e.id,
      apex: { attribute: "str" }, publication: { title: "Published" }, subitems: [{ name: "foreign" }]
    },
    flags: { pf2e: { sourceId: e.uuid }, thirdparty: { data: true } }
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.HeldProfiles.WaylightLantern": "Waylight Lantern",
    "PF2E_ITEM_FORGE.HeldProfiles.StormglassSphere": "Stormglass Sphere",
    "PF2E_ITEM_FORGE.HeldText.WaylightLanternName": "Waylight Lantern",
    "PF2E_ITEM_FORGE.HeldText.WaylightLanternDescription": "A lantern.",
    "PF2E_ITEM_FORGE.HeldText.WaylightLanternEffect": "Light {radius}; {frequency}.",
    "PF2E_ITEM_FORGE.HeldText.StormglassSphereName": "Stormglass Sphere",
    "PF2E_ITEM_FORGE.HeldText.StormglassSphereDescription": "A sphere.",
    "PF2E_ITEM_FORGE.HeldText.StormglassSphereEffect": "Wind {distance}; {frequency}.",
    "PF2E_ITEM_FORGE.HeldText.OncePerDay": "once per day",
    "PF2E_ITEM_FORGE.HeldText.OncePerHour": "once per hour",
    "PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes": "once per 10 minutes",
    "PF2E_ITEM_FORGE.HeldText.SpecialAbility": "Special Ability:",
    "PF2E_ITEM_FORGE.HeldText.AutomationNote": "Rules-text item.",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Greater": "Greater",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Major": "Major",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme": "Supreme"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function makeGenerator(entries, profiles = registerCoreHeldMagicProfiles(new HeldMagicProfileRegistry())) {
  const byUuid = new Map(entries.map((e) => [e.uuid, e]));
  const index = {
    ready: true, entries,
    query(req) {
      return entries.filter((e) => e.categories.includes("magic.held") && (req.category === "magic.held" || e.categories.includes(req.category)) && (!req.rarity?.length || req.rarity.includes(e.rarity)));
    },
    async getDocument(e) { const actual = byUuid.get(e.uuid) ?? e; return { toObject: () => sourceFor(actual) }; },
    async refresh() {}
  };
  const templateResolver = {
    resolveHeldTemplateEntry(hands, { allowedTypes = ["equipment"] } = {}) { return entries.find((e) => e.heldHands === hands && allowedTypes.includes(e.type)) ?? null; },
    templateMetadata(e, { kind }) { return { kind, source: "implementation-template", uuid: e.uuid, pack: e.pack }; }
  };
  return new HeldMagicItemGenerator({ compendiumIndex: index, heldMagicProfiles: profiles, templateResolver, formatter });
}

test("predefined held magic items preserve native PF2e content", async () => {
  const published = entry("ghost-lantern", { hands: 1, level: 12 });
  const result = await makeGenerator([published]).generate(request({ level: { min: 12, max: 12, target: 12 }, magic: { heldMode: "existing", heldProfile: "automatic" } }));
  assert.equal(result.itemSource.system.rules[0].value, 99);
  assert.equal(result.itemSource.system.usage.value, "held in 1 hand");
  assert.equal(result.itemSource.flags["pf2e-item-forge"].generated, false);
  assert.equal(result.metadata.automation.level, "native");
});

test("generated held items use hand-matched equipment templates and strip native content", async () => {
  const template = entry("lantern-template", { hands: 1 });
  const result = await makeGenerator([template]).generate(request({ magic: { heldMode: "generated", heldProfile: "core.waylight-lantern" } }));
  assert.equal(result.itemSource.type, "equipment");
  assert.equal(result.itemSource.system.usage.value, "held in 1 hand");
  assert.deepEqual(result.itemSource.system.rules, []);
  assert.equal(result.itemSource.system.apex, undefined);
  assert.equal(result.itemSource.system.publication, undefined);
  assert.deepEqual(result.itemSource.system.subitems, []);
  assert.deepEqual(Object.keys(result.itemSource.flags), ["pf2e-item-forge"]);
  assert.equal(result.metadata.heldItem.hands, 1);
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.metadata.contentSources.length, 0);
});

test("held subcategories restrict automatic profiles by handedness", async () => {
  const one = entry("one-template", { hands: 1 });
  const two = entry("two-template", { hands: 2, level: 4 });
  const result = await makeGenerator([one, two]).generate(request({ category: "magic.held.two-hands", level: { min: 4, max: 4, target: 4 }, magic: { heldMode: "generated", heldProfile: "automatic" } }));
  assert.equal(result.metadata.heldItem.hands, 2);
  assert.equal(result.metadata.heldItem.profile, "core.stormglass-sphere");
  assert.equal(result.itemSource.system.usage.value, "held in 2 hands");
});

test("automatic held generation has a strict candidate at every level 1 through 20", async () => {
  const entries = [entry("one", { hands: 1 }), entry("two", { hands: 2 })];
  const generator = makeGenerator(entries);
  for (let level = 1; level <= 20; level += 1) {
    const result = await generator.generate(request({ level: { min: level, max: level, target: level }, magic: { heldMode: "generated", heldProfile: "automatic" }, seed: `held-${level}` }));
    assert.equal(result.metadata.level, level);
  }
});

test("explicit held profiles remain strict and unknown profiles fail explicitly", async () => {
  const generator = makeGenerator([entry("one", { hands: 1 })]);
  await assert.rejects(() => generator.generate(request({ level: { min: 2, max: 2, target: 2 }, magic: { heldMode: "generated", heldProfile: "core.waylight-lantern" } })), (error) => error?.code === "NO_HELD_ITEM_PROFILE_CANDIDATE");
  await assert.rejects(() => generator.generate(request({ magic: { heldMode: "generated", heldProfile: "missing.profile" } })), (error) => error?.code === "UNKNOWN_HELD_ITEM_PROFILE");
});

test("unsafe or hand-mismatched held templates are rejected", async () => {
  const unsafe = entry("unsafe", { type: "backpack", hands: 1 });
  await assert.rejects(() => makeGenerator([unsafe]).generate(request({ magic: { heldMode: "generated", heldProfile: "core.waylight-lantern" } })), (error) => error?.code === "NO_HELD_ITEM_TEMPLATE");
  const mismatch = entry("mismatch", { hands: 1, usage: "held in 2 hands" });
  await assert.rejects(() => makeGenerator([mismatch]).generate(request({ magic: { heldMode: "generated", heldProfile: "core.waylight-lantern" } })), (error) => error?.code === "HELD_ITEM_TEMPLATE_USAGE_MISMATCH");
});
