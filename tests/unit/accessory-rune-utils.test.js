import test from "node:test";
import assert from "node:assert/strict";
import { addGpToPrice, coinsToCopper, copperToCoins, isAccessoryRuneBaseCompatible, maxRarity } from "../../src/engine/accessory-rune-utils.js";

test("accessory rune compatibility respects usage and invested restriction", () => {
  const footwear = { targetKind: "footwear", allowedSlots: ["footwear"] };
  const clothing = { targetKind: "clothing", allowedSlots: ["cloak", "garment"] };
  const container = { targetKind: "container", allowedSlots: [] };
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn shoes", traits: [] }, footwear), true);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn shoes", traits: ["invested"] }, footwear), false);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn cloak", traits: [] }, clothing), true);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn eyepiece", traits: [] }, clothing), false);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "backpack", usage: "worn backpack", traits: [] }, container), true);
});

test("accessory rune price helpers preserve exact coin value", () => {
  assert.equal(coinsToCopper({ gp: 2, sp: 5, cp: 3 }), 253);
  assert.deepEqual(copperToCoins(253), { gp: 2, sp: 5, cp: 3 });
  assert.deepEqual(addGpToPrice({ gp: 2, sp: 5 }, 45), { pp: 4, gp: 7, sp: 5 });
  assert.equal(maxRarity("rare", "common"), "rare");
});


test("container compatibility never treats an Accessory Rune document as its own host", () => {
  const family = { targetKind: "container", allowedSlots: [] };
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "etched onto a basket, bag, or other container", traits: [] }, family), false);
});
