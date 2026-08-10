import test from "node:test";
import assert from "node:assert/strict";
import { GrimoireGenerator } from "../../src/engine/generators/grimoire-generator.js";
import { GrimoireProfileRegistry, registerCoreGrimoireProfiles } from "../../src/engine/registries/grimoire-profile-registry.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.grimoire",
    level: { min: 4, max: 4, target: 4 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "system", includePacks: [], excludePacks: [] },
    magic: { grimoireMode: "generated", grimoireProfile: "automatic" },
    seed: "grimoire-seed",
    ...overrides
  };
}

function entry(id, { level = 4, rarity = "common", traits = ["grimoire", "magical"], type = "book", pack = "pf2e.equipment-srd", packageType = "system", packageName = "pf2e" } = {}) {
  return {
    id, uuid: `Compendium.${pack}.Item.${id}`, pack, packageType, packageName,
    name: id, type, level, rarity, traits,
    categories: ["item", "equipment", "magic", "magic.grimoire"]
  };
}

function sourceFor(e) {
  return {
    _id: e.id, name: e.name, type: e.type, img: "icons/sundries/books/book-red-exclamation.webp",
    system: {
      level: { value: e.level }, price: { value: { gp: 777 } }, traits: { value: [...e.traits], rarity: e.rarity }, rarity: { value: e.rarity },
      description: { value: `<p>${e.name}</p>` }, bulk: { value: "2" }, material: { type: "adamantine", grade: "high" }, baseItem: "foreign-base",
      containerId: "foreign-container", quantity: 7, subitems: [{ _id: "foreign-subitem" }], rules: [{ key: "FlatModifier", value: 99 }], slug: e.id, apex: { attribute: "int" }, publication: { title: "Published" }
    },
    flags: { pf2e: { sourceId: e.uuid }, thirdparty: { data: true } }
  };
}

function formatter(key, data = {}) {
  const strings = {
    "PF2E_ITEM_FORGE.GrimoireProfiles.ElementalConcordance": "Elemental Concordance",
    "PF2E_ITEM_FORGE.GrimoireProfiles.RestorativeLedger": "Restorative Ledger",
    "PF2E_ITEM_FORGE.GrimoireProfiles.SummonersFieldNotes": "Summoner's Field Notes",
    "PF2E_ITEM_FORGE.GrimoireProfiles.AegisCommentary": "Aegis Commentary",
    "PF2E_ITEM_FORGE.GrimoireProfiles.CorrectiveFormulae": "Corrective Formulae",
    "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceName": "Grimoire of Elemental Concordance",
    "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceDescription": "Elemental diagrams.",
    "PF2E_ITEM_FORGE.GrimoireText.ElementalConcordanceEffect": "Ignore {resistance} resistance.",
    "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeName": "Grimoire of Corrective Formulae",
    "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeDescription": "Correction marks.",
    "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeTrigger": "A spell attack failed.",
    "PF2E_ITEM_FORGE.GrimoireText.CorrectiveFormulaeEffect": "Gain +{bonus}.",
    "PF2E_ITEM_FORGE.GrimoireText.OncePerDay": "once per day",
    "PF2E_ITEM_FORGE.GrimoireText.OncePerHour": "once per hour",
    "PF2E_ITEM_FORGE.GrimoireText.OncePerTenMinutes": "once per 10 minutes",
    "PF2E_ITEM_FORGE.GrimoireText.OncePerWeek": "once per week",
    "PF2E_ITEM_FORGE.GrimoireText.TimesPerDay": "{count} times per day",
    "PF2E_ITEM_FORGE.GrimoireText.TimesPerHour": "{count} times per hour",
    "PF2E_ITEM_FORGE.GrimoireText.TimesPerTenMinutes": "{count} times per 10 minutes",
    "PF2E_ITEM_FORGE.GrimoireText.TimesPerWeek": "{count} times per week",
    "PF2E_ITEM_FORGE.GrimoireText.Reaction": "Reaction",
    "PF2E_ITEM_FORGE.GrimoireText.FreeAction": "Free Action",
    "PF2E_ITEM_FORGE.GrimoireText.OneAction": "1 action",
    "PF2E_ITEM_FORGE.GrimoireText.MultipleActions": "{count} actions",
    "PF2E_ITEM_FORGE.GrimoireText.Frequency": "Frequency {frequency}",
    "PF2E_ITEM_FORGE.GrimoireText.Trigger": "Trigger {trigger}",
    "PF2E_ITEM_FORGE.GrimoireText.Requirements": "Requirements {requirements}",
    "PF2E_ITEM_FORGE.GrimoireText.Duration": "Duration {duration}",
    "PF2E_ITEM_FORGE.GrimoireText.Activation": "Activate:",
    "PF2E_ITEM_FORGE.GrimoireText.SpecialAbility": "Effect:",
    "PF2E_ITEM_FORGE.GrimoireText.GrimoireRules": "Grimoire:",
    "PF2E_ITEM_FORGE.GrimoireText.StandardRules": "Daily preparation grimoire rules.",
    "PF2E_ITEM_FORGE.GrimoireText.AutomationNote": "Rules-text grimoire.",
    "PF2E_ITEM_FORGE.GrimoireActivationTraits.Concentrate": "concentrate",
    "PF2E_ITEM_FORGE.GrimoireActivationTraits.Spellshape": "spellshape",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Base": "Base",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Greater": "Greater",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Major": "Major",
    "PF2E_ITEM_FORGE.SpecificItemVariants.Supreme": "Supreme"
  };
  let value = strings[key] ?? key;
  for (const [name, replacement] of Object.entries(data)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function makeGenerator(entries, profiles = registerCoreGrimoireProfiles(new GrimoireProfileRegistry()), options = {}) {
  const byUuid = new Map(entries.map((e) => [e.uuid, e]));
  const index = {
    ready: true, entries,
    query(req) {
      return entries.filter((e) => e.categories.includes("magic.grimoire") && (!req.rarity?.length || req.rarity.includes(e.rarity)) && (req.source?.mode !== "selected" || req.source.includePacks.includes(e.pack)));
    },
    async getDocument(e) {
      if (options.getDocument) return options.getDocument(e);
      const actual = byUuid.get(e.uuid) ?? e;
      return { toObject: () => sourceFor(actual) };
    },
    async refresh() {}
  };
  const templateResolver = {
    resolveGrimoireTemplateEntry({ allowedTypes = ["book", "equipment"], sourcePolicy = "system-only" } = {}) {
      return entries.find((e) => e.categories.includes("magic.grimoire") && allowedTypes.includes(e.type) && (sourcePolicy !== "system-only" || e.packageType === "system" || e.packageName === "pf2e")) ?? null;
    },
    templateMetadata(e, { kind }) { return { kind, source: "implementation-template", uuid: e.uuid, pack: e.pack, packageType: e.packageType, packageName: e.packageName }; }
  };
  return new GrimoireGenerator({ compendiumIndex: index, grimoireProfiles: profiles, templateResolver, formatter });
}

test("predefined grimoires preserve native PF2e content", async () => {
  const published = entry("published", { level: 11 });
  const result = await makeGenerator([published]).generate(request({ level: { min: 11, max: 11, target: 11 }, magic: { grimoireMode: "existing", grimoireProfile: "automatic" } }));
  assert.equal(result.itemSource.system.rules[0].value, 99);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].generated, false);
  assert.equal(result.metadata.automation.level, "native");
  assert.equal(result.metadata.grimoire.mode, "existing");
});

test("generated grimoires use a system grimoire template and strip native content", async () => {
  const template = entry("template", { level: 5 });
  const result = await makeGenerator([template]).generate(request({ magic: { grimoireMode: "generated", grimoireProfile: "core.elemental-concordance" } }));
  assert.equal(result.itemSource.type, "book");
  assert.deepEqual(result.itemSource.system.rules, []);
  assert.equal(result.itemSource.system.apex, undefined);
  assert.equal(result.itemSource.system.publication, undefined);
  assert.deepEqual(Object.keys(result.itemSource.flags), ["pf2e-item-forge"]);
  assert.equal(result.itemSource.system.bulk.value, "L");
  assert.deepEqual(result.itemSource.system.material, { type: null, grade: null });
  assert.equal(result.itemSource.system.baseItem, null);
  assert.equal(result.itemSource.system.containerId, null);
  assert.equal(result.itemSource.system.quantity, 1);
  assert.deepEqual(result.itemSource.system.subitems, []);
  assert.ok(result.itemSource.system.traits.value.includes("grimoire"));
  assert.ok(result.itemSource.system.traits.value.includes("magical"));
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.metadata.grimoire.rules.spellSlotsOnly, true);
  assert.equal(result.metadata.grimoire.rules.oneGrimoirePerCasterPerDay, true);
  assert.equal(result.metadata.templateSource.packageType, "system");
});

test("automatic generated grimoires have strict candidates at every supported level 4 through 20", async () => {
  const generator = makeGenerator([entry("template")]);
  for (let level = 4; level <= 20; level += 1) {
    const result = await generator.generate(request({ level: { min: level, max: level, target: level }, seed: `grimoire-${level}` }));
    assert.equal(result.metadata.level, level);
  }
});

test("generated grimoires never use third-party implementation templates", async () => {
  const addon = entry("addon", { packageType: "module", packageName: "addon", pack: "addon.items" });
  await assert.rejects(() => makeGenerator([addon]).generate(request()), (error) => error?.code === "NO_GRIMOIRE_TEMPLATE");
});

test("grimoire template guards re-check loaded type and trait", async () => {
  const indexed = entry("template");
  const badType = makeGenerator([indexed], undefined, { getDocument: async () => ({ toObject: () => ({ ...sourceFor(indexed), type: "weapon" }) }) });
  await assert.rejects(() => badType.generate(request()), (error) => error?.code === "INVALID_GRIMOIRE_TEMPLATE_TYPE");
  const badTrait = makeGenerator([indexed], undefined, { getDocument: async () => {
    const source = sourceFor(indexed); source.system.traits.value = ["magical"]; return { toObject: () => source };
  } });
  await assert.rejects(() => badTrait.generate(request()), (error) => error?.code === "GRIMOIRE_TEMPLATE_TRAIT_MISMATCH");
});

test("grimoire activation rendering supports reactions, multiple daily uses, trigger, requirements, and duration", async () => {
  const profiles = new GrimoireProfileRegistry();
  profiles.register({
    id: "test.reactive",
    variants: [{ id: "base", level: 4, price: 90, activation: {
      type: "reaction", traits: ["concentrate"], frequency: { max: 2, period: "day" },
      trigger: "A spell attack failed.", requirements: "You studied this grimoire.", duration: "1 round",
      spellFilter: { requiresSpellAttack: true }, effectText: "Correct the formula."
    }}]
  });
  const result = await makeGenerator([entry("template")], profiles).generate(request({ magic: { grimoireMode: "generated", grimoireProfile: "test.reactive" } }));
  const activation = result.metadata.grimoire.activation;
  assert.equal(activation.type, "reaction");
  assert.equal(activation.frequencyLabel, "2 times per day");
  assert.equal(activation.triggerText, "A spell attack failed.");
  assert.equal(activation.requirementsText, "You studied this grimoire.");
  assert.equal(activation.durationText, "1 round");
  assert.match(result.itemSource.system.description.value, /Reaction \(concentrate\)/);
  assert.match(result.itemSource.system.description.value, /Frequency 2 times per day/);
  assert.match(result.itemSource.system.description.value, /Trigger A spell attack failed\./);
  assert.match(result.itemSource.system.description.value, /Requirements You studied this grimoire\./);
  assert.match(result.itemSource.system.description.value, /Duration 1 round/);
});
