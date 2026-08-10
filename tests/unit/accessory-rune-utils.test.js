import test from "node:test";
import assert from "node:assert/strict";
import { addGpToPrice, coinsToCopper, copperToCoins, isAccessoryRuneBaseCompatible, maxRarity } from "../../src/engine/accessory-rune-utils.js";

test("accessory rune compatibility respects usage, investment, and host magic policy", () => {
  const footwear = { targetKind: "footwear", host: { documentTypes: ["equipment"], wornSlots: ["footwear"], magicPolicy: "mundane-only" } };
  const clothing = { targetKind: "clothing", host: { documentTypes: ["equipment"], wornSlots: ["cloak", "garment"], magicPolicy: "mundane-only" } };
  const container = { targetKind: "container", host: { documentTypes: ["equipment", "backpack"], wornSlots: [], magicPolicy: "mundane-only" } };
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn shoes", traits: [] }, footwear), true);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn shoes", traits: ["invested"] }, footwear), false);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn shoes", traits: ["magical"] }, footwear), false);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn cloak", traits: [] }, clothing), true);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "worn eyepiece", traits: [] }, clothing), false);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "backpack", usage: "worn backpack", traits: [] }, container), true);
});

test("host contracts can explicitly allow a non-invested magical item", () => {
  const shieldFamily = { targetKind: "shield", host: { documentTypes: ["shield"], wornSlots: [], magicPolicy: "allowed" } };
  assert.equal(isAccessoryRuneBaseCompatible({ type: "shield", usage: "held in 1 hand", traits: ["magical"] }, shieldFamily), true);
  assert.equal(isAccessoryRuneBaseCompatible({ type: "shield", usage: "held in 1 hand", traits: ["magical", "invested"] }, shieldFamily), false);
});

test("accessory rune price helpers preserve exact value while preferring gp over pp", () => {
  assert.equal(coinsToCopper({ gp: 2, sp: 5, cp: 3 }), 253);
  assert.deepEqual(copperToCoins(253), { gp: 2, sp: 5, cp: 3 });
  assert.deepEqual(addGpToPrice({ gp: 2, sp: 5 }, 45), { gp: 47, sp: 5 });
  assert.deepEqual(addGpToPrice({ pp: 2, gp: 2 }, 45), { gp: 67 });
  assert.equal(maxRarity("rare", "common"), "rare");
});

test("container compatibility never treats an Accessory Rune document as its own host", () => {
  const family = { targetKind: "container", host: { documentTypes: ["equipment", "backpack"], wornSlots: [], magicPolicy: "mundane-only" } };
  assert.equal(isAccessoryRuneBaseCompatible({ type: "equipment", usage: "etched onto a basket, bag, or other container", traits: ["magical"] }, family), false);
});
