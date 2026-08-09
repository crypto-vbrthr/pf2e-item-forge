import test from "node:test";
import assert from "node:assert/strict";
import { MagicItemDiagnostics } from "../../src/engine/magic-item-diagnostics.js";

function sourceFor(request) {
  const type = request.category === "consumable.scroll" || request.category === "magic.wand" ? "consumable" : request.category.includes("armor") ? "armor" : request.category.includes("staff") || request.category.includes("weapon") ? "weapon" : "equipment";
  const source = {
    name: request.category,
    type,
    system: { level: { value: 5 }, price: { value: { gp: 10 } }, traits: { value: [] } }
  };
  if (request.category === "consumable.scroll" || request.category === "magic.wand") source.system.spell = { name: "Test Spell" };
  return source;
}

test("MagicItemDiagnostics validates generated sources without persisting world items", async () => {
  let constructed = 0;
  const api = {
    async preview(request) { return { itemSource: sourceFor(request), metadata: { generator: "test" } }; },
    compendiumIndex: {
      entries: [{ categories: ["magic.weapon"], specific: { material: {}, runes: {} } }],
      spellEntries: [{ castActions: 1 }, { castActions: 2 }]
    }
  };
  const diagnostics = new MagicItemDiagnostics({ api, documentFactory: (source) => { constructed += 1; return { source }; } });
  const result = await diagnostics.run();
  assert.equal(result.failed, 0);
  assert.equal(constructed, 8);
  assert.ok(result.checks.some((check) => check.id === "pf2e-specific-schema" && check.status === "passed"));
});
