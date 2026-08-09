import test from "node:test";
import assert from "node:assert/strict";
import { SpecificShieldProfileRegistry, registerCoreSpecificShieldProfiles } from "../../src/engine/registries/specific-shield-profile-registry.js";

test("core specific shield profiles register with ordered durability variants", () => {
  const registry = registerCoreSpecificShieldProfiles(new SpecificShieldProfileRegistry());
  assert.equal(registry.getAll().length, 3);
  for (const profile of registry.getAll()) {
    assert.ok(profile.variants.length >= 3);
    let last = 0;
    for (const variant of profile.variants) {
      assert.ok(variant.level > last);
      assert.ok(variant.durability.hardness > 0);
      assert.ok(variant.durability.hp > 0);
      assert.ok(variant.durability.bt <= variant.durability.hp);
      last = variant.level;
    }
  }
});

test("specific shield profile registry rejects invalid durability", () => {
  const registry = new SpecificShieldProfileRegistry();
  assert.throws(() => registry.register({
    id: "bad",
    variants: [{ level: 5, price: 100, durability: { hardness: 5, hp: 20, bt: 30 } }]
  }), /durability/);
});
