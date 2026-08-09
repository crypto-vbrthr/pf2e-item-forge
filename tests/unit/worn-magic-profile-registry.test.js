import test from "node:test";
import assert from "node:assert/strict";
import { WornMagicProfileRegistry, registerCoreWornMagicProfiles } from "../../src/engine/registries/worn-magic-profile-registry.js";

test("core worn magic profiles cover multiple PF2e worn usage families with ordered variants", () => {
  const registry = registerCoreWornMagicProfiles(new WornMagicProfileRegistry());
  const profiles = registry.getAll();
  assert.equal(profiles.length, 6);
  assert.deepEqual(new Set(profiles.map((profile) => profile.slot)), new Set(["footwear", "eyepiece", "belt", "cloak", "mask", "circlet"]));
  for (const profile of profiles) {
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
    assert.ok(profile.variants.every((variant, index) => index === 0 || variant.level > profile.variants[index - 1].level));
  }
});

test("worn magic profile registry rejects invalid usage slots and malformed variant progressions", () => {
  const registry = new WornMagicProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.slot", slot: "shoulder", variants: [{ level: 5, price: 100 }] }), /invalid slot/);
  assert.throws(() => registry.register({ id: "bad.other", slot: "other", variants: [{ level: 5, price: 100 }] }), /invalid slot/);
  assert.throws(() => registry.register({ id: "bad.level", slot: "belt", variants: [{ level: 5, price: 100 }, { level: 5, price: 200 }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad.price", slot: "belt", variants: [{ level: 5, price: 0 }] }), /price/);
});

test("generated worn magic profiles cannot claim native PF2e automation", () => {
  const registry = new WornMagicProfileRegistry();
  assert.throws(() => registry.register({
    id: "bad.native",
    slot: "cloak",
    automation: "native",
    variants: [{ level: 5, price: 150 }]
  }), /cannot declare native automation/);
});
