import test from "node:test";
import assert from "node:assert/strict";
import { ItemForgeEngine } from "../../src/engine/item-forge-engine.js";
import { GeneratorRegistry } from "../../src/engine/generator-registry.js";
import { CategoryRegistry } from "../../src/engine/category-registry.js";

function setup() {
  const categories = new CategoryRegistry();
  categories.register({ id: "item" });
  const generators = new GeneratorRegistry();
  let captured = null;
  generators.register({
    id: "capture",
    supports: (request) => request.mode === "custom",
    async generate(request) { captured = request; return { request }; }
  }, { modes: ["custom"], priority: 10 });
  const engine = new ItemForgeEngine({
    categories,
    generators,
    compendiumIndex: { async refresh() {} },
    defaultOptions: { defaultSourceMode: "system", defaultSolverAttempts: 7 }
  });
  return { engine, getCaptured: () => captured };
}

test("validate and generate hydrate requests with the same engine defaults", async () => {
  const { engine, getCaptured } = setup();
  const raw = { mode: "custom", category: "item", seed: "contract" };
  const validation = engine.validate(raw);
  assert.equal(validation.valid, true);
  assert.equal(validation.request.source.mode, "system");
  assert.equal(validation.request.solver.maxAttempts, 7);

  await engine.generate(raw);
  assert.equal(getCaptured().source.mode, validation.request.source.mode);
  assert.equal(getCaptured().solver.maxAttempts, validation.request.solver.maxAttempts);
});

test("registered custom generation modes are accepted while unknown modes are rejected", () => {
  const { engine } = setup();
  assert.equal(engine.validate({ mode: "custom", category: "item", seed: "x" }).valid, true);
  const invalid = engine.validate({ mode: "missing", category: "item", seed: "x" });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.some((error) => error.code === "UNKNOWN_GENERATION_MODE"), true);
});

test("engine default options can be supplied dynamically without reconstructing the API", () => {
  const categories = new CategoryRegistry();
  categories.register({ id: "item" });
  const generators = new GeneratorRegistry();
  generators.register({ id: "capture", supports: (request) => request.mode === "custom", async generate(request) { return { request }; } }, { modes: ["custom"], priority: 1 });
  let sourceMode = "system";
  const engine = new ItemForgeEngine({
    categories,
    generators,
    compendiumIndex: { async refresh() {} },
    defaultOptions: () => ({ defaultSourceMode: sourceMode, defaultSolverAttempts: 9 })
  });
  assert.equal(engine.normalize({ mode: "custom", category: "item", seed: "a" }).source.mode, "system");
  sourceMode = "all";
  assert.equal(engine.normalize({ mode: "custom", category: "item", seed: "b" }).source.mode, "all");
});
