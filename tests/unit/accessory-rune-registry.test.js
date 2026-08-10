import test from "node:test";
import assert from "node:assert/strict";
import { AccessoryRuneRegistry, registerCoreAccessoryRunes } from "../../src/engine/registries/accessory-rune-registry.js";

test("core accessory rune registry matches Treasure Vault progressions and hardened host policies", () => {
  const registry = registerCoreAccessoryRunes(new AccessoryRuneRegistry());
  assert.deepEqual(registry.get("menacing").variants.map((v) => [v.level, v.priceGp]), [[3, 50], [10, 900]]);
  assert.deepEqual(registry.get("pontoon").variants.map((v) => [v.level, v.priceGp]), [[9, 650]]);
  assert.deepEqual(registry.get("preserving").variants.map((v) => [v.level, v.priceGp]), [[3, 45], [8, 450]]);
  assert.deepEqual(registry.get("trackless").variants.map((v) => [v.level, v.priceGp]), [[6, 225], [10, 900]]);
  assert.equal(registry.get("preserving").targetKind, "container");
  assert.deepEqual(registry.get("preserving").host.documentTypes, ["equipment", "backpack"]);
  assert.equal(registry.get("trackless").host.magicPolicy, "mundane-only");
  assert.equal(registry.get("trackless").variants[1].activation.actions, 2);
  assert.deepEqual(registry.get("menacing").variants[1].activation.traits, ["concentrate", "manipulate"]);
  assert.deepEqual(registry.get("menacing").variants[1].activation.spell, { slug: "fear", rank: 3, dc: 25 });
});

test("accessory rune registry supports extensible shield/item host contracts", () => {
  const registry = new AccessoryRuneRegistry();
  const family = registry.register({
    id: "shield-test",
    targetKind: "shield",
    host: { documentTypes: ["shield"], magicPolicy: "allowed" },
    variants: [{ level: 5, priceGp: 100, sourceSlug: "shield-test" }]
  });
  assert.deepEqual(family.host, { documentTypes: ["shield"], wornSlots: [], magicPolicy: "allowed" });
});

test("accessory rune registry rejects malformed families", () => {
  const registry = new AccessoryRuneRegistry();
  assert.throws(() => registry.register({ id: "bad", targetKind: "spaceship", variants: [{ level: 3, priceGp: 50, sourceSlug: "bad" }] }), /invalid target kind/);
  assert.throws(() => registry.register({ id: "bad2", targetKind: "footwear", variants: [{ id: "x", level: 3, priceGp: 50, sourceSlug: "x" }, { id: "x", level: 4, priceGp: 60, sourceSlug: "y" }] }), /duplicate variant id/);
  assert.throws(() => registry.register({ id: "bad3", targetKind: "footwear", variants: [{ level: 10, priceGp: 50, sourceSlug: "x" }, { level: 6, priceGp: 60, sourceSlug: "y" }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad4", targetKind: "footwear", host: { magicPolicy: "sometimes" }, variants: [{ level: 3, priceGp: 50, sourceSlug: "x" }] }), /invalid host magic policy/);
  assert.throws(() => registry.register({ id: "bad5", targetKind: "footwear", variants: [{ level: 3, priceGp: 50 }] }), /requires a source slug/);
  assert.throws(() => registry.register({ id: "bad6", targetKind: "footwear", variants: [{ level: 3, priceGp: 50, sourceSlug: "x", activation: { actions: 4, effectText: "x" } }] }), /activation actions/);
});
