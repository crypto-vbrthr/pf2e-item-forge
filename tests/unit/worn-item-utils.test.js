import test from "node:test";
import assert from "node:assert/strict";
import { parseWornUsage, wornCategoryForSlot, isMagicWornTraits } from "../../src/engine/worn-item-utils.js";

test("parseWornUsage normalizes PF2e human and slug-like worn usages", () => {
  assert.deepEqual(parseWornUsage("worn cloak"), { worn: true, slot: "cloak", raw: "worn cloak" });
  assert.equal(parseWornUsage("worn-eyepiece").slot, "eyepiece");
  assert.equal(parseWornUsage("wornshoes").slot, "footwear");
  assert.equal(parseWornUsage("worn armbands").slot, "bracers");
  assert.equal(parseWornUsage("worn crown").slot, "headwear");
  assert.equal(parseWornUsage("worn").slot, "unrestricted");
});

test("parseWornUsage rejects held/affixed usage and preserves unknown worn usage", () => {
  assert.equal(parseWornUsage("held in 1 hand").worn, false);
  assert.equal(parseWornUsage("affixed to armor").worn, false);
  assert.equal(parseWornUsage("worn shoulder charm").slot, "other");
  assert.equal(wornCategoryForSlot("footwear"), "magic.worn.footwear");
});

test("isMagicWornTraits recognizes invested and magical-tradition worn items", () => {
  assert.equal(isMagicWornTraits(["invested"]), true);
  assert.equal(isMagicWornTraits(["divine"]), true);
  assert.equal(isMagicWornTraits(["magical"]), true);
  assert.equal(isMagicWornTraits(["clockwork"]), false);
});
