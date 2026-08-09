import { ABSOLUTE_SOLVER_ATTEMPTS, DEFAULT_SOLVER_ATTEMPTS } from "../constants.js";

export class ValueSolver {
  constructor({ absoluteMaxAttempts = ABSOLUTE_SOLVER_ATTEMPTS } = {}) {
    this.absoluteMaxAttempts = absoluteMaxAttempts;
  }

  solve({ target, tolerance = 0.15, maxAttempts = DEFAULT_SOLVER_ATTEMPTS, generateCandidate, calculateValue }) {
    if (!Number.isFinite(target) || target < 0) throw new TypeError("ValueSolver requires a non-negative target");
    if (typeof generateCandidate !== "function" || typeof calculateValue !== "function") {
      throw new TypeError("ValueSolver requires generateCandidate and calculateValue functions");
    }

    const limit = Math.max(1, Math.min(this.absoluteMaxAttempts, Number.parseInt(maxAttempts, 10) || DEFAULT_SOLVER_ATTEMPTS));
    const minimum = target * (1 - tolerance);
    const maximum = target * (1 + tolerance);
    let best = null;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const candidate = generateCandidate(attempt);
      const value = calculateValue(candidate);
      if (!Number.isFinite(value) || value < 0) continue;
      const distance = Math.abs(target - value);
      if (!best || distance < best.distance) best = { candidate, value, distance, attempts: attempt };
      if (value >= minimum && value <= maximum) {
        return { candidate, value, attempts: attempt, exact: true, warning: null };
      }
    }

    if (!best) {
      return {
        candidate: null,
        value: null,
        attempts: limit,
        exact: false,
        warning: { code: "NO_VALID_VALUE_CANDIDATE", requested: target, attempts: limit }
      };
    }

    return {
      candidate: best.candidate,
      value: best.value,
      attempts: limit,
      exact: false,
      warning: {
        code: "VALUE_TARGET_APPROXIMATED",
        requested: target,
        actual: best.value,
        attempts: limit
      }
    };
  }
}
