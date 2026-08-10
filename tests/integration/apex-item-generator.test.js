import test from "node:test";
import assert from "node:assert/strict";
import { ApexItemGenerator } from "../../src/engine/generators/apex-item-generator.js";
import { ApexProfileRegistry, registerCoreApexProfiles } from "../../src/engine/registries/apex-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic", category: "magic.apex",
    level: { min: 17, max: 17, target: 17 }, levelPolicy: "strict", rarity: [],
    source: { mode: "system", includePacks: [], excludePacks: [] },
    magic: { apexMode: "generated", apexProfile: "automatic", apexAttribute: "automatic" },
    seed: "apex-seed", ...overrides
  };
}

function entry(id, { attribute = "str", level = 17, type = "equipment", pack = "pf2e.equipment-srd", packageType = "system", packageName = "pf2e", rarity = "common" } = {}) {
  return {
    id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType, packageName, name: id, type, level, rarity,
    apexAttribute: attribute, traits: ["apex", "invested", "magical"], usage: "worn",
    categories: ["item", "magic", "magic.apex", ...(type === "equipment" ? ["equipment", "magic.worn", "magic.worn.unrestricted"] : [])]
  };
}

function sourceFor(e) {
  return {
    _id: e.id, name: e.name, type: e.type, img: "icons/equipment/neck/amulet-round-gold.webp",
    system: {
      level: { value: e.level }, price: { value: { gp: 15000 } },
      traits: { value: [...e.traits], rarity: e.rarity }, rarity: { value: e.rarity },
      usage: { value: "worn" }, bulk: { value: "1" }, description: { value: "<p>Published apex.</p>" },
      apex: { attribute: e.apexAttribute }, rules: [{ key: "FlatModifier", value: 99 }],
      material: { type: "adamantine", grade: "high" }, baseItem: "foreign", containerId: "container", quantity: 2,
      slug: e.id, publication: { title: "Published" }, subitems: [{ name: "foreign" }]
    },
    flags: { pf2e: { sourceId: e.uuid }, thirdparty: { data: true } }
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.ApexAttributes.Strength": "Strength", "PF2E_ITEM_FORGE.ApexAttributes.Dexterity": "Dexterity",
    "PF2E_ITEM_FORGE.ApexProfiles.Might": "Apex of Might", "PF2E_ITEM_FORGE.ApexProfiles.Grace": "Apex of Grace",
    "PF2E_ITEM_FORGE.ApexText.MightName": "Sigil of Might", "PF2E_ITEM_FORGE.ApexText.MightDescription": "A mighty sigil.",
    "PF2E_ITEM_FORGE.ApexText.MightPassive": "+{bonus} Athletics.", "PF2E_ITEM_FORGE.ApexText.MightTrigger": "You succeed at a Shove.",
    "PF2E_ITEM_FORGE.ApexText.MightActivation": "Push {distance} extra feet.",
    "PF2E_ITEM_FORGE.ApexText.GraceName": "Sigil of Grace", "PF2E_ITEM_FORGE.ApexText.GraceDescription": "A graceful sigil.",
    "PF2E_ITEM_FORGE.ApexText.GracePassive": "+{bonus} Acrobatics.", "PF2E_ITEM_FORGE.ApexText.GraceTrigger": "You fail Acrobatics.",
    "PF2E_ITEM_FORGE.ApexText.GraceActivation": "Reroll.",
    "PF2E_ITEM_FORGE.ApexText.CoreRule": "Improve {attribute}.", "PF2E_ITEM_FORGE.ApexText.ApexBenefit": "Apex:",
    "PF2E_ITEM_FORGE.ApexText.AutomationNote": "Native apex plus rules text.",
    "PF2E_ITEM_FORGE.HeldText.OncePerDay": "once per day", "PF2E_ITEM_FORGE.HeldText.OncePerHour": "once per hour",
    "PF2E_ITEM_FORGE.HeldText.Reaction": "Reaction", "PF2E_ITEM_FORGE.HeldText.OneAction": "1 action",
    "PF2E_ITEM_FORGE.HeldText.Frequency": "Frequency {frequency}", "PF2E_ITEM_FORGE.HeldText.Trigger": "Trigger {trigger}",
    "PF2E_ITEM_FORGE.HeldText.Activation": "Activate:", "PF2E_ITEM_FORGE.HeldActivationTraits.Concentrate": "concentrate",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base", "PF2E_ITEM_FORGE.SpecificItemVariants.Greater": "Greater",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Major": "Major", "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme": "Supreme"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function makeGenerator(entries, profiles = registerCoreApexProfiles(new ApexProfileRegistry()), options = {}) {
  const index = {
    ready: true, entries,
    query(req) { return entries.filter((e) => e.categories.includes("magic.apex") && (!req.rarity?.length || req.rarity.includes(e.rarity))); },
    async getDocument(e) { if (options.getDocument) return options.getDocument(e); return { toObject: () => sourceFor(e) }; },
    async refresh() {}
  };
  const resolver = {
    resolveApexTemplateEntry({ allowedTypes = ["equipment"], sourcePolicy = "system-only" } = {}) {
      return entries.find((e) => e.categories.includes("magic.apex") && allowedTypes.includes(e.type) && (sourcePolicy !== "system-only" || e.packageType === "system" || e.packageName === "pf2e")) ?? null;
    },
    templateMetadata(e, { kind }) { return { kind, source: "implementation-template", uuid: e.uuid, pack: e.pack, packageType: e.packageType, packageName: e.packageName }; }
  };
  return new ApexItemGenerator({ compendiumIndex: index, apexProfiles: profiles, templateResolver: resolver, formatter });
}

test("predefined apex items preserve native PF2e data and can filter by apex attribute", async () => {
  const str = entry("str-apex", { attribute: "str" });
  const dex = entry("dex-apex", { attribute: "dex" });
  const result = await makeGenerator([str, dex]).generate(request({ magic: { apexMode: "existing", apexProfile: "automatic", apexAttribute: "dex" } }));
  assert.equal(result.itemSource.system.rules[0].value, 99);
  assert.equal(result.itemSource.system.apex.attribute, "dex");
  assert.equal(result.metadata.apexItem.mode, "existing");
  assert.equal(result.metadata.apexItem.attributeLabel, "PF2E_ITEM_FORGE.ApexAttributes.Dexterity");
  assert.equal(result.metadata.automation.level, "native");
});

test("generated apex items keep native apex data while scrubbing template identity and automation", async () => {
  const template = entry("template", { attribute: "wis" });
  const result = await makeGenerator([template]).generate(request({ magic: { apexMode: "generated", apexProfile: "core.apex-might", apexAttribute: "str" } }));
  assert.equal(result.itemSource.type, "equipment");
  assert.equal(result.itemSource.system.apex.attribute, "str");
  assert.ok(result.itemSource.system.traits.value.includes("apex"));
  assert.ok(result.itemSource.system.traits.value.includes("invested"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.deepEqual(result.itemSource.system.rules, []);
  assert.deepEqual(result.itemSource.system.material, { type: null, grade: null });
  assert.equal(result.itemSource.system.baseItem, null);
  assert.equal(result.itemSource.system.containerId, null);
  assert.equal(result.itemSource.system.quantity, 1);
  assert.equal(result.itemSource.system.publication, undefined);
  assert.deepEqual(result.itemSource.system.subitems, []);
  assert.deepEqual(Object.keys(result.itemSource.flags), ["pf2e-item-forge"]);
  assert.equal(result.itemSource.system.usage.value, "worn");
  assert.equal(result.itemSource.system.bulk.value, "L");
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.deepEqual(result.metadata.automation.nativeParts, ["apex-attribute"]);
  assert.equal(result.metadata.apexItem.coreAutomation, "native");
  assert.equal(result.metadata.apexItem.secondaryAutomation, "rules-text");
  assert.equal(result.metadata.apexItem.attributeLabel, "PF2E_ITEM_FORGE.ApexAttributes.Strength");
  assert.match(result.itemSource.system.description.value, /Improve Strength/);
  assert.match(result.itemSource.system.description.value, /Reaction \(concentrate\)/);
});

test("every core apex attribute has a strict generated candidate at levels 17 through 20", async () => {
  const generator = makeGenerator([entry("template")]);
  for (const attribute of ["str", "dex", "con", "int", "wis", "cha"]) {
    for (let level = 17; level <= 20; level += 1) {
      const result = await generator.generate(request({ level: { min: level, max: level, target: level }, magic: { apexMode: "generated", apexProfile: "automatic", apexAttribute: attribute }, seed: `${attribute}-${level}` }));
      assert.equal(result.metadata.level, level);
      assert.equal(result.metadata.apexItem.attribute, attribute);
    }
  }
});

test("generated apex templates are system-only", async () => {
  const addon = entry("addon", { packageType: "module", packageName: "addon", pack: "addon.items" });
  await assert.rejects(() => makeGenerator([addon]).generate(request()), (error) => error?.code === "NO_APEX_ITEM_TEMPLATE");
});

test("loaded apex template type is guarded and profile constraints are strict", async () => {
  const template = entry("template");
  const bad = makeGenerator([template], undefined, { getDocument: async () => ({ toObject: () => ({ ...sourceFor(template), type: "weapon" }) }) });
  await assert.rejects(() => bad.generate(request()), (error) => error?.code === "INVALID_APEX_TEMPLATE_TYPE");
  const generator = makeGenerator([template]);
  await assert.rejects(() => generator.generate(request({ level: { min: 16, max: 16, target: 16 } })), (error) => error?.code === "NO_APEX_PROFILE_CANDIDATE");
  await assert.rejects(() => generator.generate(request({ magic: { apexMode: "generated", apexProfile: "missing", apexAttribute: "automatic" } })), (error) => error?.code === "UNKNOWN_APEX_PROFILE");
});
