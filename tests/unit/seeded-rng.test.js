import test from "node:test";
import assert from "node:assert/strict";
import { SeededRng } from "../../src/engine/seeded-rng.js";

test("SeededRng is deterministic for the same seed", () => {
  const a = new SeededRng("forge-seed");
  const b = new SeededRng("forge-seed");
  assert.deepEqual([a.random(), a.random(), a.random()], [b.random(), b.random(), b.random()]);
});

test("SeededRng picks deterministically", () => {
  const values = ["sword", "shield", "ring", "book"];
  assert.equal(new SeededRng("x").pick(values), new SeededRng("x").pick(values));
});
