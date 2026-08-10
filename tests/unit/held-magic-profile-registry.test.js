import test from "node:test";
import assert from "node:assert/strict";
import { HeldMagicProfileRegistry, registerCoreHeldMagicProfiles } from "../../src/engine/registries/held-magic-profile-registry.js";

test("core held magic profiles cover both hand usages and every level 1 through 20", () => {
  const registry = registerCoreHeldMagicProfiles(new HeldMagicProfileRegistry());
  const profiles = registry.getAll();
  assert.equal(profiles.length, 5);
  assert.deepEqual(new Set(profiles.map((profile) => profile.hands)), new Set([1, 2]));
  const levels = new Set(profiles.flatMap((profile) => profile.variants.map((variant) => variant.level)));
  for (let level = 1; level <= 20; level += 1) assert.ok(levels.has(level), `missing held-item level ${level}`);
  for (const profile of profiles) {
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
  }
});

test("held magic profile registry rejects malformed contracts", () => {
  const registry = new HeldMagicProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.hands", hands: 3, variants: [{ level: 1, price: 15 }] }), /hands 1 or 2/);
  assert.throws(() => registry.register({ id: "bad.level", hands: 1, variants: [{ level: 5, price: 100 }, { level: 5, price: 200 }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad.rarity", hands: 1, rarity: "mythic", variants: [{ level: 1, price: 15 }] }), /invalid rarity/);
  assert.throws(() => registry.register({ id: "bad.invested", hands: 1, invested: "yes", variants: [{ level: 1, price: 15 }] }), /invested must be boolean/);
  assert.throws(() => registry.register({ id: "bad.native", hands: 1, automation: "native", variants: [{ level: 1, price: 15 }] }), /cannot declare native automation/);
});
