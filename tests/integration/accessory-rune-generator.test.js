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

function entry(id, { name = id, type = "equipment", level = 0, rarity = "common", usage = "worn shoes", traits = [], pack = "pf2e.equipment-srd", packageType = "system", packageName = "pf2e", slug = null } = {}) {
  return { id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType, packageName, name, type, level, rarity, usage, traits, slug, categories: ["item", "equipment"] };
}

function runeEntry(slug, { level, pack = "pf2e.equipment-srd", packageType = "system", packageName = "pf2e", usage = "etched onto footwear" } = {}) {
  return entry(`rune-${slug}`, { name: slug, level, pack, packageType, packageName, usage, traits: ["magical"], slug });
}

function source(e, { invested = false, traits = null, usage = null, price = { gp: 1, sp: 5 }, rules = [{ key: "Note", text: "base ability" }], flags = {} } = {}) {
  return {
    _id: e.id,
    name: e.name,
    type: e.type,
    img: "icons/equipment/feet/boots-leather.webp",
    system: {
      level: { value: e.level },
      price: { value: structuredClone(price) },
      traits: { value: invested ? ["invested", ...(traits ?? e.traits)] : [...(traits ?? e.traits)], rarity: e.rarity },
      rarity: { value: e.rarity },
      usage: { value: usage ?? e.usage },
      description: { value: "<p>Base item text.</p>" },
      rules: structuredClone(rules),
      counteract: { rank: 1 }
    },
    flags: structuredClone(flags)
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
    "PF2E_ITEM_FORGE.AccessoryRuneText.TracklessGreater": "Continuous vanishing tracks.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingBase": "Food lasts longer.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.PreservingGreater": "Food never spoils.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingBase": "+1 Coerce.",
    "PF2E_ITEM_FORGE.AccessoryRuneText.MenacingGreater": "+2 Coerce.",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.TracklessGreater": "Extend to an aura.",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.PreservingGreater": "Cast cleanse cuisine.",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.MenacingGreater": "Cast fear.",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.Activate": "Activate",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.Frequency": "Frequency",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.Effect": "Effect",
    "PF2E_ITEM_FORGE.AccessoryRuneActivation.OncePerDay": "once per day",
    "PF2E_ITEM_FORGE.AccessoryRuneActivationTraits.Concentrate": "concentrate",
    "PF2E_ITEM_FORGE.AccessoryRuneActivationTraits.Manipulate": "manipulate",
    "PF2E_ITEM_FORGE.AccessoryRuneText.AppliedName": "{baseName} ({runeName})",
    "PF2E_ITEM_FORGE.AccessoryRuneText.Heading": "Accessory Rune: {runeName}",
    "PF2E_ITEM_FORGE.AccessoryRuneText.RuleNote": "Level=max(base,rune); base abilities do not scale."
  };
  let text = values[key] ?? key;
  for (const [name, value] of Object.entries(data)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

function makeGenerator(entries, sources = new Map(), { missingDocuments = new Set() } = {}) {
  const index = {
    ready: true,
    query(request) {
      const include = new Set(request.source?.includePacks ?? []);
      const exclude = new Set(request.source?.excludePacks ?? []);
      return entries.filter((e) => {
        if (exclude.has(e.pack)) return false;
        if (request.source?.mode === "selected" && !include.has(e.pack)) return false;
        if (request.source?.mode === "system" && e.packageType !== "system" && e.packageName !== "pf2e") return false;
        return true;
      });
    },
    async getDocument(e) {
      if (missingDocuments.has(e.id)) return null;
      return { toObject: () => structuredClone(sources.get(e.id) ?? source(e)) };
    },
    async refresh() {}
  };
  return new AccessoryRuneGenerator({ compendiumIndex: index, accessoryRunes: registerCoreAccessoryRunes(new AccessoryRuneRegistry()), formatter });
}

function withTrackless(entries = [], options = {}) {
  return makeGenerator([...entries, runeEntry("trackless", { level: 6 }), runeEntry("trackless-greater", { level: 10 })], options.sources ?? new Map(), options);
}

test("trackless composes onto mundane footwear, records the rune source, and keeps gp-normalized price", async () => {
  const shoes = entry("shoes", { name: "Travel Shoes", level: 0, usage: "worn shoes" });
  const result = await withTrackless([shoes]).generate(req());
  assert.equal(result.itemSource.system.level.value, 6);
  assert.deepEqual(result.itemSource.system.price.value, { gp: 226, sp: 5 });
  assert.ok(result.itemSource.system.traits.value.includes("invested"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.equal(result.itemSource.system.rules[0].text, "base ability", "base item abilities must remain untouched");
  assert.equal(result.itemSource.system.counteract.rank, 1, "rune-raised level must not scale base ability data");
  assert.equal(result.metadata.accessoryRune.runeLevel, 6);
  assert.equal(result.metadata.accessoryRune.effectiveLevel, 6);
  assert.equal(result.metadata.accessoryRune.runeSource.slug, "trackless");
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.itemSource.flags["pf2e-item-forge"].accessoryRune.runeSource.slug, "trackless");
});

test("preserving selects a container and menacing selects visible clothing", async () => {
  const bag = entry("bag", { type: "backpack", usage: "worn backpack" });
  const cloak = entry("cloak", { usage: "worn cloak" });
  const entries = [
    bag, cloak,
    runeEntry("preserving", { level: 3, usage: "etched onto a basket, bag, or other container" }),
    runeEntry("preserving-greater", { level: 8, usage: "etched onto a basket, bag, or other container" }),
    runeEntry("menacing", { level: 3, usage: "etched onto a visible article of clothing" }),
    runeEntry("menacing-greater", { level: 10, usage: "etched onto a visible article of clothing" })
  ];
  const g = makeGenerator(entries);
  const preserving = await g.generate(req({ level: { min: 3, max: 3, target: 3 }, magic: { accessoryRune: "preserving" }, seed: "p" }));
  assert.equal(preserving.metadata.accessoryRune.baseItem.type, "backpack");
  const menacing = await g.generate(req({ level: { min: 3, max: 3, target: 3 }, magic: { accessoryRune: "menacing" }, seed: "m" }));
  assert.equal(menacing.metadata.accessoryRune.baseItem.name, "cloak");
});

test("invested, magical, and incompatible hosts are never candidates for core mundane-only runes", async () => {
  const invested = entry("invested-boots", { usage: "worn shoes", traits: ["invested"] });
  const magical = entry("magic-boots", { usage: "worn shoes", traits: ["magical"] });
  const primal = entry("primal-boots", { usage: "worn shoes", traits: ["primal"] });
  const eyepiece = entry("glass", { usage: "worn eyepiece" });
  const g = withTrackless([invested, magical, primal, eyepiece]);
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "NO_ACCESSORY_RUNE_CANDIDATE");
});

test("effective level is max of base and rune and nearest fallback remains deterministic", async () => {
  const highShoes = entry("high-shoes", { level: 8, usage: "worn shoes" });
  const g = withTrackless([highShoes]);
  const exact = await g.generate(req({ level: { min: 8, max: 8, target: 8 }, magic: { accessoryRune: "trackless" } }));
  assert.equal(exact.metadata.level, 8);
  assert.equal(exact.metadata.accessoryRune.runeLevel, 6);
  const nearest1 = await g.generate(req({ level: { min: 7, max: 7, target: 7 }, levelPolicy: "nearest", magic: { accessoryRune: "trackless" }, seed: "same" }));
  const nearest2 = await g.generate(req({ level: { min: 7, max: 7, target: 7 }, levelPolicy: "nearest", magic: { accessoryRune: "trackless" }, seed: "same" }));
  assert.equal(nearest1.metadata.level, 8);
  assert.equal(nearest1.itemSource.name, nearest2.itemSource.name);
  assert.equal(nearest1.warnings[0].code, "LEVEL_TARGET_APPROXIMATED");
});

test("selected source policy must contain both the host and the published rune source", async () => {
  const hostPack = "world.hosts";
  const runePack = "pf2e.equipment-srd";
  const shoes = entry("shoes", { pack: hostPack, packageType: "world", packageName: "world" });
  const rune = runeEntry("trackless", { level: 6, pack: runePack });
  const greater = runeEntry("trackless-greater", { level: 10, pack: runePack });
  const g = makeGenerator([shoes, rune, greater]);
  await assert.rejects(
    () => g.generate(req({ source: { mode: "selected", includePacks: [hostPack], excludePacks: [] } })),
    (error) => error?.code === "NO_ACCESSORY_RUNE_CANDIDATE"
  );
  const result = await g.generate(req({ source: { mode: "selected", includePacks: [hostPack, runePack], excludePacks: [] } }));
  assert.deepEqual(new Set(result.metadata.contentSources), new Set([hostPack, runePack]));
  assert.equal(result.metadata.accessoryRune.runeSource.pack, runePack);
});

test("greater rune variants render structured activation traits and store the contract", async () => {
  const shoes = entry("shoes", { level: 0 });
  // Only expose the greater source so exact level 10 cannot resolve the base rune.
  const g = makeGenerator([shoes, runeEntry("trackless-greater", { level: 10 })]);
  const result = await g.generate(req({ level: { min: 10, max: 10, target: 10 } }));
  assert.equal(result.metadata.accessoryRune.variant, "greater");
  assert.deepEqual(result.metadata.accessoryRune.activation.traits, ["concentrate"]);
  assert.deepEqual(result.metadata.accessoryRune.activation.frequency, { max: 1, period: "day" });
  assert.match(result.itemSource.system.description.value, /\[two-action[s]?\]|\[two-actions\]/);
  assert.match(result.itemSource.system.description.value, /concentrate/);
  assert.match(result.itemSource.system.description.value, /once per day/);
});

test("guard rejects a host that became invested after indexing", async () => {
  const shoes = entry("shoes");
  const sources = new Map([[shoes.id, source(shoes, { invested: true })]]);
  const g = withTrackless([shoes], { sources });
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "ACCESSORY_RUNE_BASE_INVESTED");
});

test("guard rejects a host that became magical after indexing", async () => {
  const shoes = entry("shoes");
  const sources = new Map([[shoes.id, source(shoes, { traits: ["occult"] })]]);
  const g = withTrackless([shoes], { sources });
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "ACCESSORY_RUNE_BASE_MAGIC_NOT_ALLOWED");
});

test("guard rejects a second Accessory Rune on the loaded host", async () => {
  const shoes = entry("shoes");
  const sources = new Map([[shoes.id, source(shoes, { flags: { "pf2e-item-forge": { accessoryRune: { family: "old" } } } })]]);
  const g = withTrackless([shoes], { sources });
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "ACCESSORY_RUNE_ALREADY_PRESENT");
});

test("guard rejects a loaded host whose usage no longer matches", async () => {
  const shoes = entry("shoes");
  const sources = new Map([[shoes.id, source(shoes, { usage: "worn eyepiece" })]]);
  const g = withTrackless([shoes], { sources });
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "ACCESSORY_RUNE_USAGE_MISMATCH");
});

test("missing host documents fail explicitly", async () => {
  const shoes = entry("shoes");
  const g = withTrackless([shoes], { missingDocuments: new Set([shoes.id]) });
  await assert.rejects(() => g.generate(req()), (error) => error?.code === "ITEM_DOCUMENT_NOT_FOUND");
});

test("unknown accessory rune ids fail explicitly", async () => {
  const shoes = entry("shoes");
  await assert.rejects(() => withTrackless([shoes]).generate(req({ magic: { accessoryRune: "missing" } })), (error) => error?.code === "UNKNOWN_ACCESSORY_RUNE");
});
