import test from "node:test";
import assert from "node:assert/strict";
import { AccessoryRuneRegistry, registerCoreAccessoryRunes } from "../../src/engine/registries/accessory-rune-registry.js";

test("core accessory rune registry matches Treasure Vault progressions", () => {
  const registry = registerCoreAccessoryRunes(new AccessoryRuneRegistry());
  assert.deepEqual(registry.get("menacing").variants.map((v) => [v.level, v.priceGp]), [[3, 50], [10, 900]]);
  assert.deepEqual(registry.get("pontoon").variants.map((v) => [v.level, v.priceGp]), [[9, 650]]);
  assert.deepEqual(registry.get("preserving").variants.map((v) => [v.level, v.priceGp]), [[3, 45], [8, 450]]);
  assert.deepEqual(registry.get("trackless").variants.map((v) => [v.level, v.priceGp]), [[6, 225], [10, 900]]);
  assert.equal(registry.get("preserving").targetKind, "container");
  assert.equal(registry.get("trackless").targetKind, "footwear");
});

test("accessory rune registry rejects malformed families", () => {
  const registry = new AccessoryRuneRegistry();
  assert.throws(() => registry.register({ id: "bad", targetKind: "spaceship", variants: [{ level: 3, priceGp: 50 }] }), /invalid target kind/);
  assert.throws(() => registry.register({ id: "bad2", targetKind: "footwear", variants: [{ id: "x", level: 3, priceGp: 50 }, { id: "x", level: 4, priceGp: 60 }] }), /duplicate variant id/);
  assert.throws(() => registry.register({ id: "bad3", targetKind: "footwear", variants: [{ level: 10, priceGp: 50 }, { level: 6, priceGp: 60 }] }), /increase in level/);
});
