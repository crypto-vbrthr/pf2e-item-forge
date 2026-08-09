import test from "node:test";
import assert from "node:assert/strict";
import { WornMagicProfileRegistry, registerCoreWornMagicProfiles } from "../../src/engine/registries/worn-magic-profile-registry.js";

test("core worn magic profiles cover multiple PF2e worn usage families with ordered variants", () => {
  const registry = registerCoreWornMagicProfiles(new WornMagicProfileRegistry());
  const profiles = registry.getAll();
  assert.equal(profiles.length, 14);
  assert.deepEqual(
    new Set(profiles.map((profile) => profile.slot)),
    new Set(["footwear", "eyepiece", "belt", "cloak", "mask", "circlet", "gloves", "bracers", "garment", "unrestricted", "headwear"])
  );
  for (const profile of profiles) {
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
    assert.ok(profile.variants.every((variant, index) => index === 0 || variant.level > profile.variants[index - 1].level));
  }
  assert.equal(registry.get("core.pathmark-charm").variants[0].level, 1);
  assert.equal(registry.get("core.signal-gloves").invested, false);
  assert.deepEqual(registry.get("core.signal-gloves").balance.analogs, ["apparition-gloves", "goz-mask"]);
  assert.equal(registry.get("core.quickhand-bracers").variants[0].level, 3);
});

test("automatic core worn-item generation has at least one strict candidate at every level from 1 through 20", () => {
  const registry = registerCoreWornMagicProfiles(new WornMagicProfileRegistry());
  const levels = new Set(registry.getAll().flatMap((profile) => profile.variants.map((variant) => variant.level)));
  for (let level = 1; level <= 20; level += 1) {
    assert.ok(levels.has(level), `expected at least one core worn-item variant at level ${level}`);
  }
});

test("worn magic profile registry rejects invalid usage slots and malformed variant progressions", () => {
  const registry = new WornMagicProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.slot", slot: "shoulder", variants: [{ level: 5, price: 100 }] }), /invalid slot/);
  assert.throws(() => registry.register({ id: "bad.other", slot: "other", variants: [{ level: 5, price: 100 }] }), /invalid slot/);
  assert.throws(() => registry.register({ id: "bad.level", slot: "belt", variants: [{ level: 5, price: 100 }, { level: 5, price: 200 }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad.price", slot: "belt", variants: [{ level: 5, price: 0 }] }), /price/);
  assert.throws(() => registry.register({ id: "bad.rarity", slot: "belt", rarity: "mythic-ish", variants: [{ level: 5, price: 100 }] }), /invalid rarity/);
  assert.throws(() => registry.register({ id: "bad.variant.empty", slot: "belt", variants: [{ id: "", level: 5, price: 100 }] }), /empty variant id/);
  assert.throws(() => registry.register({ id: "bad.variant.duplicate", slot: "belt", variants: [{ id: "same", level: 5, price: 100 }, { id: "same", level: 6, price: 150 }] }), /duplicate variant id/);
  assert.throws(() => registry.register({ id: "bad.invested", slot: "belt", invested: "yes", variants: [{ level: 5, price: 100 }] }), /invested must be boolean/);
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
