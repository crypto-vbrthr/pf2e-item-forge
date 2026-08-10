import test from "node:test";
import assert from "node:assert/strict";
import { parseHeldUsage, heldCategoryForHands, heldHandsLabelKey, hasHeldMagicMarkerTraits } from "../../src/engine/held-item-utils.js";

test("parseHeldUsage recognizes PF2e one- and two-hand usage shapes", () => {
  assert.deepEqual(parseHeldUsage("held in 1 hand"), { held: true, hands: 1, id: "one-hand", raw: "held in 1 hand" });
  assert.equal(parseHeldUsage("held-in-one-hand").hands, 1);
  assert.equal(parseHeldUsage("held in 2 hands").hands, 2);
  assert.equal(parseHeldUsage("held-two-hands").hands, 2);
});

test("held helpers reject worn or affixed usage and map categories", () => {
  assert.equal(parseHeldUsage("worn cloak").held, false);
  assert.equal(parseHeldUsage("affixed to armor").held, false);
  assert.equal(heldCategoryForHands(1), "magic.held.one-hand");
  assert.equal(heldCategoryForHands(2), "magic.held.two-hands");
  assert.equal(heldHandsLabelKey(1), "PF2E_ITEM_FORGE.HeldHands.One");
  assert.equal(heldHandsLabelKey(2), "PF2E_ITEM_FORGE.HeldHands.Two");
});

test("held magic markers accept magical and tradition traits", () => {
  assert.equal(hasHeldMagicMarkerTraits(["magical"]), true);
  assert.equal(hasHeldMagicMarkerTraits(["Occult"]), true);
  assert.equal(hasHeldMagicMarkerTraits(["light"]), false);
});
