import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

test("normalizeRequest normalizes a single level into an exact range", () => {
  const request = normalizeRequest({ level: 8, seed: "x" });
  assert.deepEqual(request.level, { min: 8, max: 8, target: 8 });
});

test("normalizeRequest sorts reversed ranges and clamps solver attempts", () => {
  const request = normalizeRequest({ level: { min: 12, max: 8 }, solver: { maxAttempts: 999999 }, seed: "x" });
  assert.equal(request.level.min, 8);
  assert.equal(request.level.max, 12);
  assert.equal(request.solver.maxAttempts, 1000);
});


test("normalizeRequest supports composed equipment mode and fundamental rune policy", () => {
  const request = normalizeRequest({
    mode: "equipment",
    category: "weapon",
    equipment: { fundamentalRunes: "none" },
    seed: "x"
  });
  assert.equal(request.mode, "equipment");
  assert.equal(request.equipment.fundamentalRunes, "none");
});
