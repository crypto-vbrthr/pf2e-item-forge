import test from "node:test";
import assert from "node:assert/strict";
import { ItemLevelResolver, levelAllowed, distanceToLevelRequest } from "../../src/engine/item-level-resolver.js";

test("ItemLevelResolver uses the highest level of base item and runes", () => {
  const resolver = new ItemLevelResolver();
  assert.equal(resolver.resolve({ baseLevel: 1, runeLevels: [2, 8] }), 8);
});

test("levelAllowed enforces both boundaries for strict requests", () => {
  const request = { level: { min: 6, max: 8 }, levelPolicy: "strict" };
  assert.equal(levelAllowed(5, request), false);
  assert.equal(levelAllowed(7, request), true);
  assert.equal(levelAllowed(9, request), false);
});

test("distanceToLevelRequest prefers the target when supplied", () => {
  const level = { min: 5, max: 9, target: 8 };
  assert.equal(distanceToLevelRequest(8, level), 0);
  assert.equal(distanceToLevelRequest(6, level), 2);
});
