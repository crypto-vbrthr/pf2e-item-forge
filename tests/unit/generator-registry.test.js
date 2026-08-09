import test from "node:test";
import assert from "node:assert/strict";
import { GeneratorRegistry } from "../../src/engine/generator-registry.js";

function generator(id, { supports = () => true } = {}) {
  return { id, supports, async generate() { return id; } };
}

test("GeneratorRegistry resolves the highest-priority compatible generator", () => {
  const registry = new GeneratorRegistry();
  registry.register(generator("generic"), { priority: 0, modes: ["existing"] });
  registry.register(generator("specific"), { priority: 100, modes: ["existing"] });
  assert.equal(registry.resolve({ mode: "existing" }).id, "specific");
});

test("GeneratorRegistry exposes dynamically registered generation modes", () => {
  const registry = new GeneratorRegistry();
  registry.register(generator("custom"), { priority: 50, modes: ["custom-mode"] });
  assert.deepEqual(registry.getModes(), ["custom-mode"]);
  assert.equal(registry.resolve({ mode: "custom-mode" }).id, "custom");
  assert.equal(registry.resolve({ mode: "other" }), null);
});
