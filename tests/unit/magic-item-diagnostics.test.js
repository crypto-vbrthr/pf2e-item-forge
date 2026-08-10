import test from "node:test";
import assert from "node:assert/strict";
import { MagicItemDiagnostics } from "../../src/engine/magic-item-diagnostics.js";

function sourceFor(request) {
  const type = request.category === "consumable.scroll" || request.category === "magic.wand"
    ? "consumable"
    : request.category === "magic.grimoire"
      ? "book"
    : request.category.includes("armor")
      ? "armor"
      : request.category.includes("shield")
        ? "shield"
        : request.category.includes("staff") || request.category.includes("weapon")
          ? "weapon"
          : "equipment";
  const exactLevel = Number(request?.level?.min) === Number(request?.level?.max) ? Number(request?.level?.min) : 5;
  const source = {
    name: request.category,
    type,
    system: { level: { value: exactLevel }, price: { value: { gp: 10 } }, traits: { value: [] } }
  };
  if (request.category === "consumable.scroll" || request.category === "magic.wand") source.system.spell = { name: "Test Spell" };
  if (request.magic?.specificMode === "generated" && ["magic.weapon", "magic.armor"].includes(request.category)) {
    source.system.specific = { material: {}, runes: {} };
  }
  if (request.magic?.specificMode === "generated" && request.category === "magic.shield") {
    source.system.hardness = 8;
    source.system.hp = { value: 40, max: 40, brokenThreshold: 20 };
  }
  if (request.category === "magic.accessory-rune") {
    const preserving = request.magic?.accessoryRune === "preserving";
    source.type = preserving ? "backpack" : "equipment";
    source.system.level.value = preserving ? 3 : 6;
    source.system.traits.value = ["invested", "magical"];
    if (preserving) source.system.usage = { value: "worn backpack" };
    source.flags = { "pf2e-item-forge": { accessoryRune: { family: request.magic?.accessoryRune } } };
  }
  if (request.category === "magic.grimoire") {
    source.system.traits.value = ["grimoire", "magical"];
    if (request.magic?.grimoireMode === "generated") {
      source.system.rules = [];
      source.system.bulk = { value: "L" };
      source.system.material = { type: null, grade: null };
      source.flags = { "pf2e-item-forge": { generated: true } };
    }
  }
  if (request.category === "magic.held" || request.category.startsWith("magic.held.")) {
    const hands = request.category === "magic.held.two-hands" ? 2 : 1;
    source.system.usage = { value: `held in ${hands} hand${hands === 2 ? "s" : ""}` };
    source.system.traits.value = ["magical"];
    if (request.magic?.heldMode === "generated") {
      source.system.rules = [];
      source.system.bulk = { value: request.category === "magic.held.two-hands" ? "1" : "L" };
      source.system.material = { type: null, grade: null };
      source.flags = { "pf2e-item-forge": { generated: true } };
    }
  }
  if (request.category === "magic.worn" || request.category.startsWith("magic.worn.")) {
    const slot = request.category.startsWith("magic.worn.") ? request.category.slice("magic.worn.".length) : "cloak";
    const usage = {
      unrestricted: "worn",
      eyepiece: "worn eyepiece",
      headwear: "worn headwear",
      footwear: "worn shoes"
    }[slot] ?? `worn ${slot}`;
    source.system.usage = { value: usage };
    source.system.traits.value = ["invested", "magical"];
    if (request.magic?.wornMode === "generated") {
      source.system.rules = [];
      source.flags = { "pf2e-item-forge": { generated: true } };
    }
  }
  return source;
}

function metadataFor(request) {
  const slot = request.category.startsWith("magic.worn.") ? request.category.slice("magic.worn.".length) : null;
  const accessory = request.category === "magic.accessory-rune";
  const generatedHeld = request.magic?.heldMode === "generated";
  const generatedGrimoire = request.magic?.grimoireMode === "generated";
  return {
    generator: "test",
    automation: { level: request.magic?.wornMode === "generated" || generatedHeld || generatedGrimoire || accessory ? "rules-text" : "native" },
    ...(request.magic?.wornMode === "generated" ? { wornItem: { slot, invested: true } } : {}),
    ...(generatedGrimoire ? {
      templateSource: { packageType: "system", packageName: "pf2e", pack: "pf2e.equipment-srd", uuid: "Compendium.pf2e.equipment-srd.Item.grimoire-template" },
      grimoire: {
        physical: { bulk: "L" },
        rules: { dailyPreparationStudy: true, spellSlotsOnly: true, oneGrimoirePerCasterPerDay: true, oneCasterPerGrimoirePerDay: true },
        activation: { type: "free-action", actions: 0, traits: ["concentrate"], frequency: { max: 1, period: "day" }, spellFilter: { preparedFromGrimoire: true, slotsOnly: true }, effect: "effect" }
      }
    } : {}),
    ...(generatedHeld ? {
      templateSource: { packageType: "system", packageName: "pf2e", pack: "pf2e.equipment-srd", uuid: "Compendium.pf2e.equipment-srd.Item.template" },
      heldItem: {
        hands: request.category === "magic.held.two-hands" ? 2 : 1,
        invested: false,
        physical: { bulk: request.category === "magic.held.two-hands" ? "1" : "L" },
        activation: { type: "action", actions: 1, traits: ["concentrate"], frequency: { max: 1, period: "day" }, effect: "effect" }
      }
    } : {}),
    ...(accessory ? {
      contentSources: ["pf2e.equipment-srd"],
      accessoryRune: {
        baseItem: { level: 0, pack: "pf2e.equipment-srd" },
        runeLevel: request.magic?.accessoryRune === "preserving" ? 3 : 6,
        runeSource: { uuid: "Compendium.pf2e.equipment-srd.Item.rune", pack: "pf2e.equipment-srd", slug: request.magic?.accessoryRune ?? "trackless" },
        host: { magicPolicy: "mundane-only" }
      }
    } : {})
  };
}

test("MagicItemDiagnostics validates generated sources without persisting world items", async () => {
  let constructed = 0;
  const api = {
    async preview(request) { return { itemSource: sourceFor(request), metadata: metadataFor(request) }; },
    compendiumIndex: {
      entries: [{ categories: ["magic.weapon"], specific: { material: {}, runes: {} } }, { categories: ["magic.held"], heldHands: 1 }, { categories: ["magic.grimoire"], type: "book" }],
      spellEntries: [{ castActions: 1 }, { castActions: 2 }],
      getPackErrors: () => []
    },
    accessoryRunes: { getAll: () => [{ variants: [{ activation: { actions: 2, traits: ["concentrate"], effectText: "effect" } }] }] }
  };
  const diagnostics = new MagicItemDiagnostics({
    api,
    documentFactory: (source) => { constructed += 1; return { source, system: structuredClone(source.system) }; }
  });
  const result = await diagnostics.run();
  assert.equal(result.failed, 0);
  assert.equal(result.warnings, 1, "price audit warns when the runtime document does not derive a different price");
  assert.equal(constructed, 28);
  assert.ok(result.checks.some((check) => check.id === "pf2e-specific-schema" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-weapon-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-armor-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-shield-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "worn-existing" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "held-existing" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "grimoire-existing" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "grimoire-generated-low" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "grimoire-generated-high" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "pf2e-grimoire-schema" && check.status === "passed"));
  for (const id of ["held-generated-one-low", "held-generated-one-high", "held-generated-two-low", "held-generated-two-high"]) {
    assert.ok(result.checks.some((check) => check.id === id && check.status === "passed"), `expected ${id} to pass`);
  }
  assert.ok(result.checks.some((check) => check.id === "accessory-rune-trackless" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "accessory-rune-preserving" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "accessory-rune-activation-contract" && check.status === "passed"));
  for (const id of ["worn-generated-unrestricted", "worn-generated-eyepiece", "worn-generated-headwear", "worn-generated-footwear"]) {
    assert.ok(result.checks.some((check) => check.id === id && check.status === "passed"), `expected ${id} to pass`);
  }
  assert.ok(result.checks.some((check) => check.id === "compendium-index-errors" && check.status === "passed"));
});

test("MagicItemDiagnostics exposes compendium indexing failures as a failed contract check", async () => {
  const api = {
    async preview(request) { return { itemSource: sourceFor(request), metadata: metadataFor(request) }; },
    compendiumIndex: {
      entries: [],
      spellEntries: [],
      getPackErrors: () => [{ pack: "broken.pack", message: "bad index" }]
    },
    accessoryRunes: { getAll: () => [{ variants: [{ activation: { actions: 2, traits: ["concentrate"], effectText: "effect" } }] }] }
  };
  const diagnostics = new MagicItemDiagnostics({ api, documentFactory: (source) => ({ system: structuredClone(source.system) }) });
  const result = await diagnostics.run();
  assert.ok(result.failed >= 1);
  assert.ok(result.checks.some((check) => check.id === "compendium-index-errors" && check.status === "failed"));
  assert.equal(result.packErrors[0].pack, "broken.pack");
});
