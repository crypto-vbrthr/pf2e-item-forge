import test from "node:test";
import assert from "node:assert/strict";
import { WandProfileRegistry, registerCoreWandProfiles } from "../../src/engine/registries/wand-profile-registry.js";

test("core wand profiles register rulebook-grounded level and price progressions", () => {
  const registry = registerCoreWandProfiles(new WandProfileRegistry());
  const reaching = registry.get("core.reaching");
  const mercy = registry.get("core.mercy");
  assert.deepEqual(reaching.variants.map((variant) => variant.level), [4, 6, 8, 10, 12, 14, 16, 18, 20]);
  assert.deepEqual(reaching.variants.map((variant) => variant.price), [100, 250, 500, 1000, 2000, 4500, 10000, 24000, 70000]);
  assert.deepEqual(mercy.variants.map((variant) => variant.price), [75, 200, 425, 850, 1650, 3600, 7900, 19000, 52000]);
  assert.equal(mercy.compatibility.requiresDamage, true);
  assert.deepEqual(mercy.compatibility.castActions, [1, 2]);
  assert.deepEqual(mercy.compatibility.forbiddenTraits, ["death", "nonlethal", "void"]);
});

test("wand profile registry rejects malformed and duplicate definitions", () => {
  const registry = new WandProfileRegistry();
  assert.throws(() => registry.register({ id: "bad", variants: [{ rank: 0, level: 4, price: 100 }] }), /Invalid spell rank/);
  registry.register({ id: "test", variants: [{ rank: 1, level: 4, price: 100 }] });
  assert.throws(() => registry.register({ id: "test", variants: [{ rank: 1, level: 4, price: 100 }] }), /Duplicate/);
});
