import test from "node:test";
import assert from "node:assert/strict";
import { ValueSolver } from "../../src/engine/value-solver.js";

test("ValueSolver respects configured maximum attempts", () => {
  const solver = new ValueSolver();
  const result = solver.solve({
    target: 100, tolerance: 0, maxAttempts: 7,
    generateCandidate: (attempt) => attempt,
    calculateValue: (candidate) => candidate
  });
  assert.equal(result.attempts, 7);
  assert.equal(result.exact, false);
});

test("ValueSolver returns the closest candidate when no exact solution exists", () => {
  const solver = new ValueSolver();
  const values = [40, 80, 92, 130];
  const result = solver.solve({
    target: 100, tolerance: 0.01, maxAttempts: values.length,
    generateCandidate: (attempt) => values[attempt - 1],
    calculateValue: (candidate) => candidate
  });
  assert.equal(result.value, 92);
  assert.equal(result.warning.code, "VALUE_TARGET_APPROXIMATED");
});
