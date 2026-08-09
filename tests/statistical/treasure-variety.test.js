import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRegistry, registerCoreCategories } from "../../src/engine/category-registry.js";
import { TreasureRegistry } from "../../src/engine/registries/treasure-registry.js";
import { registerCoreTreasureContent } from "../../src/engine/treasure/core-treasure-content.js";
import { TreasureGenerator } from "../../src/engine/generators/treasure-generator.js";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

test("treasure mass generation stays valid and varied across many seeds", async () => {
  const categories = registerCoreCategories(new CategoryRegistry());
  const treasure = registerCoreTreasureContent(new TreasureRegistry());
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  const seenTypes = new Set();
  const seenMaterials = new Set();

  for (let index = 0; index < 300; index += 1) {
    const request = normalizeRequest({
      mode: "treasure",
      category: "treasure",
      value: { mode: "target", target: 50, tolerance: 1 },
      solver: { maxAttempts: 1 },
      seed: `mass-${index}`
    });
    const result = await generator.generate(request);
    assert.ok(result.itemSource.name.trim().length > 0);
    assert.ok(result.itemSource.system.description.value.length > 0);
    assert.ok(Number.isFinite(result.metadata.value));
    assert.ok(result.metadata.value > 0);
    seenTypes.add(result.plan.type.id);
    if (result.plan.material?.id) seenMaterials.add(result.plan.material.id);
  }

  assert.ok(seenTypes.size >= 15, `expected broad type variety, got ${seenTypes.size}`);
  assert.ok(seenMaterials.size >= 10, `expected broad material variety, got ${seenMaterials.size}`);
});
