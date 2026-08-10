import test from "node:test";
import assert from "node:assert/strict";
import { ApexProfileRegistry, registerCoreApexProfiles } from "../../src/engine/registries/apex-profile-registry.js";

test("core apex profiles cover all six attributes and levels 17 through 20", () => {
  const registry = registerCoreApexProfiles(new ApexProfileRegistry());
  assert.deepEqual(new Set(registry.getAll().map((profile) => profile.attribute)), new Set(["str", "dex", "con", "int", "wis", "cha"]));
  for (const profile of registry.getAll()) {
    assert.deepEqual(profile.variants.map((variant) => variant.level), [17, 18, 19, 20]);
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
  }
  assert.ok(registry.get("core.apex-grace").variants.every((variant) => variant.activation.traits.includes("fortune")));
});

test("apex profile registry rejects invalid attributes, levels, and false native automation claims", () => {
  const registry = new ApexProfileRegistry();
  const base = { id: "test", attribute: "str", nameTemplate: "Name", description: "Desc", passiveText: "Passive", variants: [{ id: "base", level: 17, price: 15000, activation: { type: "action", actions: 1, effectText: "Effect" } }] };
  assert.throws(() => registry.register({ ...base, attribute: "luck" }), /invalid attribute/);
  assert.throws(() => new ApexProfileRegistry().register({ ...base, variants: [{ ...base.variants[0], level: 16 }] }), /17-20/);
  assert.throws(() => new ApexProfileRegistry().register({ ...base, automation: "native" }), /cannot declare native automation/);
});
