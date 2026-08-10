import test from "node:test";
import assert from "node:assert/strict";
import { getGrimoireCapabilities, hasGrimoireMagicMarkerTraits, isGrimoireTraits } from "../../src/engine/grimoire-utils.js";

test("grimoire trait helpers recognize grimoire and magic marker traits", () => {
  assert.equal(isGrimoireTraits(["grimoire"]), true);
  assert.equal(isGrimoireTraits(["GRIMOIRE"]), true);
  assert.equal(isGrimoireTraits(["magical"]), false);
  assert.equal(hasGrimoireMagicMarkerTraits(["arcane"]), true);
  assert.equal(hasGrimoireMagicMarkerTraits(["magical"]), true);
  assert.equal(hasGrimoireMagicMarkerTraits(["grimoire"]), false);
});

test("grimoire capabilities distinguish published content from safe system templates", () => {
  const entries = [
    { type: "book", packageType: "system", packageName: "pf2e", categories: ["magic.grimoire"] },
    { type: "equipment", packageType: "module", packageName: "addon", categories: ["magic.grimoire"] }
  ];
  const profiles = [{ variants: [{ level: 4 }, { level: 9 }] }, { variants: [{ level: 5 }] }];
  const capabilities = getGrimoireCapabilities({ entries, profiles });
  assert.equal(capabilities.existing, true);
  assert.equal(capabilities.existingCount, 2);
  assert.equal(capabilities.generated, true);
  assert.equal(capabilities.generatedTemplateCount, 1);
  assert.deepEqual(capabilities.generatedLevels, [4, 5, 9]);

  const thirdPartyOnly = getGrimoireCapabilities({ entries: entries.slice(1), profiles });
  assert.equal(thirdPartyOnly.existing, true);
  assert.equal(thirdPartyOnly.generated, false);
});
