import test from "node:test";
import assert from "node:assert/strict";
import { getApexCapabilities, isApexItem, isApexTraits } from "../../src/engine/apex-item-utils.js";

test("apex helpers recognize the apex trait and expose cross-cutting capabilities", () => {
  assert.equal(isApexTraits(["apex", "invested"]), true);
  assert.equal(isApexItem({ system: { traits: { value: ["apex"] } } }), true);
  const capabilities = getApexCapabilities({
    entries: [
      { type: "weapon", apexAttribute: "dex", categories: ["magic.apex"], packageType: "system", packageName: "pf2e" },
      { type: "equipment", apexAttribute: "wis", categories: ["magic.apex"], packageType: "system", packageName: "pf2e" }
    ],
    profiles: [{ attribute: "str" }, { attribute: "wis" }]
  });
  assert.equal(capabilities.existing, true);
  assert.equal(capabilities.generated, true);
  assert.deepEqual(capabilities.existingAttributes.sort(), ["dex", "wis"]);
  assert.deepEqual(capabilities.generatedAttributes.sort(), ["str", "wis"]);
});
