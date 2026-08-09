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

test("specific shield profile registry rejects invalid or unverified reinforcing-rune contracts", () => {
  const invalid = new SpecificShieldProfileRegistry();
  assert.throws(() => invalid.register({
    id: "bad-rune",
    variants: [{ level: 20, price: 1000, reinforcing: 7, durability: { hardness: 10, hp: 40, bt: 20 } }]
  }), /reinforcing rune value/);

  const belowLevel = new SpecificShieldProfileRegistry();
  assert.throws(() => belowLevel.register({
    id: "too-early",
    variants: [{ level: 3, price: 100, reinforcing: 1, durability: { hardness: 6, hp: 24, bt: 12 } }]
  }), /below its reinforcing-rune level/);

  const finalDurabilityConflict = new SpecificShieldProfileRegistry();
  assert.throws(() => finalDurabilityConflict.register({
    id: "double-scale-risk",
    variants: [{ level: 4, price: 150, reinforcing: 1, durability: { hardness: 6, hp: 24, bt: 12 } }]
  }), /cannot combine explicit final durability with a reinforcing rune/);
});

test("generated custom shield profiles cannot claim native automation", () => {
  const registry = new SpecificShieldProfileRegistry();
  assert.throws(() => registry.register({
    id: "fake-native",
    automation: "native",
    variants: [{ level: 5, price: 100, durability: { hardness: 5, hp: 20, bt: 10 } }]
  }), /cannot declare native automation/);
});
