import test from "node:test";
import assert from "node:assert/strict";
import { CandidateLevelResolver } from "../../src/engine/candidate-level-resolver.js";

const resolver = new CandidateLevelResolver();

function request(levelPolicy = "strict", level = { min: 5, max: 7, target: 6 }) {
  return { levelPolicy, level };
}

test("CandidateLevelResolver applies strict range and target preference", () => {
  const result = resolver.resolve([{ level: 5 }, { level: 6 }, { level: 7 }, { level: 8 }], request());
  assert.deepEqual(result.candidates.map((candidate) => candidate.level), [6]);
  assert.equal(result.exact, true);
  assert.deepEqual(result.warnings, []);
});

test("CandidateLevelResolver uses nearest fallback only when requested", () => {
  const result = resolver.resolve([{ level: 3 }, { level: 9 }], request("nearest"));
  assert.deepEqual(result.candidates.map((candidate) => candidate.level), [3, 9]);
  assert.equal(result.exact, false);
  assert.equal(result.warnings[0]?.code, "LEVEL_TARGET_APPROXIMATED");
});

test("CandidateLevelResolver supports custom level accessors", () => {
  const result = resolver.resolve([{ variant: { level: 4 } }, { variant: { level: 8 } }], {
    levelPolicy: "notAbove",
    level: { min: 0, max: 6, target: null }
  }, { getLevel: (candidate) => candidate.variant.level });
  assert.deepEqual(result.candidates.map((candidate) => candidate.variant.level), [4]);
});
