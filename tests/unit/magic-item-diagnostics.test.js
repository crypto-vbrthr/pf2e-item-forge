import test from "node:test";
import assert from "node:assert/strict";
import { MagicItemDiagnostics } from "../../src/engine/magic-item-diagnostics.js";

function sourceFor(request) {
  const type = request.category === "consumable.scroll" || request.category === "magic.wand"
    ? "consumable"
    : request.category.includes("armor")
      ? "armor"
      : request.category.includes("shield")
        ? "shield"
        : request.category.includes("staff") || request.category.includes("weapon")
          ? "weapon"
          : "equipment";
  const source = {
    name: request.category,
    type,
    system: { level: { value: 5 }, price: { value: { gp: 10 } }, traits: { value: [] } }
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
    source.system.level.value = 6;
    source.system.traits.value = ["invested", "magical"];
    source.flags = { "pf2e-item-forge": { accessoryRune: { family: "trackless" } } };
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
  return {
    generator: "test",
    automation: { level: request.magic?.wornMode === "generated" || accessory ? "rules-text" : "native" },
    ...(request.magic?.wornMode === "generated" ? { wornItem: { slot, invested: true } } : {}),
    ...(accessory ? { accessoryRune: { baseItem: { level: 0 }, runeLevel: 6 } } : {})
  };
}

test("MagicItemDiagnostics validates generated sources without persisting world items", async () => {
  let constructed = 0;
  const api = {
    async preview(request) { return { itemSource: sourceFor(request), metadata: metadataFor(request) }; },
    compendiumIndex: {
      entries: [{ categories: ["magic.weapon"], specific: { material: {}, runes: {} } }],
      spellEntries: [{ castActions: 1 }, { castActions: 2 }],
      getPackErrors: () => []
    }
  };
  const diagnostics = new MagicItemDiagnostics({
    api,
    documentFactory: (source) => { constructed += 1; return { source, system: structuredClone(source.system) }; }
  });
  const result = await diagnostics.run();
  assert.equal(result.failed, 0);
  assert.equal(result.warnings, 1, "price audit warns when the runtime document does not derive a different price");
  assert.equal(constructed, 19);
  assert.ok(result.checks.some((check) => check.id === "pf2e-specific-schema" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-weapon-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-armor-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "specific-shield-generated" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "worn-existing" && check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "accessory-rune-trackless" && check.status === "passed"));
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
    }
  };
  const diagnostics = new MagicItemDiagnostics({ api, documentFactory: (source) => ({ system: structuredClone(source.system) }) });
  const result = await diagnostics.run();
  assert.ok(result.failed >= 1);
  assert.ok(result.checks.some((check) => check.id === "compendium-index-errors" && check.status === "failed"));
  assert.equal(result.packErrors[0].pack, "broken.pack");
});
