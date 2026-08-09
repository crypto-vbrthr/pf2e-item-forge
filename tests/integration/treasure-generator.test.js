import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRegistry, registerCoreCategories } from "../../src/engine/category-registry.js";
import { TreasureRegistry } from "../../src/engine/registries/treasure-registry.js";
import { registerCoreTreasureContent } from "../../src/engine/treasure/core-treasure-content.js";
import { TreasureGenerator } from "../../src/engine/generators/treasure-generator.js";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

function setup() {
  const categories = registerCoreCategories(new CategoryRegistry());
  const treasure = registerCoreTreasureContent(new TreasureRegistry());
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  return { categories, treasure, generator };
}

function request(overrides = {}) {
  return normalizeRequest({
    mode: "treasure",
    category: "treasure",
    value: { mode: "target", target: 50, tolerance: 0.2 },
    solver: { maxAttempts: 50 },
    treasure: { material: "any", condition: "any", craftsmanship: "any", motif: "any", style: "any" },
    seed: "treasure-test",
    ...overrides
  });
}

test("TreasureGenerator creates a valid PF2e treasure source", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({ category: "treasure.jewelry" }));

  assert.equal(result.itemSource.type, "treasure");
  assert.equal(result.itemSource.system.category, "art-object");
  assert.equal(result.itemSource.system.level.value, 0);
  assert.equal(result.itemSource.system.quantity, 1);
  assert.ok(Object.keys(result.itemSource.system.price.value).length > 0);
  assert.ok(result.itemSource.system.description.value.includes("<p>"));
  assert.ok(result.metadata.value > 0);
  assert.equal(result.plan.type.categories.includes("treasure.jewelry"), true);
});

test("TreasureGenerator is deterministic for identical seed and request", async () => {
  const { generator } = setup();
  const req = request({ category: "treasure.art" });
  const first = await generator.generate(req);
  const second = await generator.generate(req);
  assert.equal(first.itemSource.name, second.itemSource.name);
  assert.equal(first.metadata.value, second.metadata.value);
  assert.deepEqual(first.plan, second.plan);
});

test("TreasureGenerator obeys the configured maximum solver attempts", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.jewelry",
    value: { mode: "target", target: 100000, tolerance: 0.0001 },
    solver: { maxAttempts: 3 }
  }));
  assert.equal(result.metadata.solverAttempts, 3);
  assert.equal(result.metadata.solverExact, false);
  assert.equal(result.warnings[0]?.code, "VALUE_TARGET_APPROXIMATED");
});

test("more valuable material increases an otherwise fixed treasure value", async () => {
  const { generator } = setup();
  const fixed = {
    category: "treasure.jewelry",
    value: { mode: "target", target: 5000, tolerance: 0.0001 },
    solver: { maxAttempts: 1 },
    treasure: {
      condition: "core.condition.good",
      craftsmanship: "core.craftsmanship.solid",
      motif: "core.motif.geometric",
      style: "core.style.merchant"
    },
    seed: "material-comparison"
  };
  const silver = await generator.generate(request({ ...fixed, treasure: { ...fixed.treasure, material: "core.material.silver" } }));
  const gold = await generator.generate(request({ ...fixed, treasure: { ...fixed.treasure, material: "core.material.gold" } }));
  assert.ok(gold.metadata.value > silver.metadata.value);
});

test("condition affects an otherwise fixed treasure value", async () => {
  const { generator } = setup();
  const fixed = {
    category: "treasure.jewelry",
    value: { mode: "target", target: 5000, tolerance: 0.0001 },
    solver: { maxAttempts: 1 },
    treasure: {
      material: "core.material.silver",
      craftsmanship: "core.craftsmanship.solid",
      motif: "core.motif.geometric",
      style: "core.style.merchant"
    },
    seed: "condition-comparison"
  };
  const pristine = await generator.generate(request({ ...fixed, treasure: { ...fixed.treasure, condition: "core.condition.pristine" } }));
  const damaged = await generator.generate(request({ ...fixed, treasure: { ...fixed.treasure, condition: "core.condition.damaged" } }));
  assert.ok(pristine.metadata.value > damaged.metadata.value);
});

test("beverage treasure uses the requested beverage branch", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({ category: "treasure.beverage.wine", seed: "wine" }));
  assert.equal(result.plan.type.categories.includes("treasure.beverage.wine"), true);
  assert.ok(result.plan.attributes.kind);
  assert.ok(result.plan.attributes.vessel);
  assert.ok(result.itemSource.name.length > 0);
});

test("book treasure carries book-specific subject data", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({ category: "treasure.book", seed: "book" }));
  assert.equal(result.plan.type.categories.includes("treasure.book"), true);
  assert.ok(result.plan.attributes.subject);
});

test("new registered treasure types and materials work without generator changes", async () => {
  const { categories, treasure } = setup();
  treasure.materials.register({ id: "test.material.moonwood", label: { de: "Mondholz", en: "moonwood" }, tags: ["fan-material"], valueFactor: 2 });
  treasure.types.register({
    id: "test.type.fan",
    categories: ["treasure", "treasure.luxury"],
    label: { de: "Fächer", en: "fan" },
    tags: ["luxury"],
    baseValue: [5, 10],
    materialTags: ["fan-material"],
    supportsMotif: true,
    components: [],
    systemCategory: "art-object",
    nameTemplates: { de: ["Fächer aus {material}"], en: ["Fan of {material}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} {conditionSentence}"] }
  });
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  const result = await generator.generate(request({
    category: "treasure.luxury",
    treasure: { material: "test.material.moonwood", condition: "core.condition.good", craftsmanship: "core.craftsmanship.solid", motif: "core.motif.geometric", style: "core.style.merchant" },
    seed: "extension"
  }));
  assert.equal(result.plan.material.id, "test.material.moonwood");
  assert.equal(result.plan.type.id, "test.type.fan");
});

test("unknown treasure registry selections fail explicitly", async () => {
  const { generator } = setup();
  await assert.rejects(
    () => generator.generate(request({ treasure: { material: "missing.material", condition: "any", craftsmanship: "any", motif: "any", style: "any" } })),
    (error) => error?.code === "UNKNOWN_TREASURE_CONTENT"
  );
});

test("a concrete treasure type can be selected inside a broader category", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.jewelry",
    treasure: {
      type: "core.type.jewelry.tiara",
      material: "any",
      condition: "any",
      craftsmanship: "any",
      motif: "any",
      style: "any"
    },
    seed: "specific-tiara"
  }));
  assert.equal(result.plan.type.id, "core.type.jewelry.tiara");
});

test("component craftsmanship stays coherent with fixed parent craftsmanship", async () => {
  const { categories, treasure } = setup();
  treasure.components.register({
    id: "test.component.frame",
    label: { de: "Test-Rahmen", en: "test frame" },
    baseValue: [1, 1],
    craftsmanshipMode: "near-parent",
    sentence: { de: "Rahmen.", en: "Frame." }
  });
  treasure.types.register({
    id: "test.type.coherent",
    categories: ["treasure", "treasure.art"],
    label: { de: "Testkunst", en: "test art" },
    tags: ["decorative"],
    baseValue: [1, 1],
    materialTags: [],
    supportsMotif: false,
    components: [{ id: "test.component.frame", chance: 1 }]
  });
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  const result = await generator.generate(request({
    category: "treasure.art",
    treasure: {
      type: "test.type.coherent",
      material: "any",
      condition: "core.condition.good",
      craftsmanship: "core.craftsmanship.masterful",
      motif: "any",
      style: "core.style.merchant"
    },
    value: { mode: "target", target: 1000, tolerance: 0.0001 },
    solver: { maxAttempts: 1 },
    seed: "coherence"
  }));
  const componentCraftsmanship = result.plan.components[0].craftsmanship;
  assert.ok(["fein gearbeitet", "meisterlich", "außergewöhnlich"].includes(componentCraftsmanship));
});

test("gemstone componentValue contributes to component valuation", async () => {
  const { categories, treasure } = setup();
  treasure.materials.register({
    id: "test.material.expensive-gem",
    label: { de: "Testjuwel", en: "test jewel" },
    tags: ["special-gem"],
    valueFactor: 1,
    componentValue: [100, 100]
  });
  treasure.components.register({
    id: "test.component.gem",
    label: { de: "Juwel", en: "jewel" },
    materialTags: ["special-gem"],
    baseValue: [1, 1],
    quantity: [1, 1],
    craftsmanshipMode: "none",
    sentence: { de: "Juwel.", en: "Jewel." }
  });
  treasure.types.register({
    id: "test.type.gem-component",
    categories: ["treasure", "treasure.luxury"],
    label: { de: "Teststück", en: "test piece" },
    tags: ["luxury"],
    baseValue: [1, 1],
    materialTags: [],
    supportsMotif: false,
    usesCraftsmanship: false,
    components: [{ id: "test.component.gem", chance: 1 }]
  });
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  const result = await generator.generate(request({
    category: "treasure.luxury",
    treasure: {
      type: "test.type.gem-component",
      material: "any",
      condition: "core.condition.good",
      craftsmanship: "any",
      motif: "any",
      style: "core.style.merchant"
    },
    value: { mode: "target", target: 101, tolerance: 0.001 },
    solver: { maxAttempts: 1 },
    seed: "gem-component-value"
  }));
  assert.equal(result.plan.components[0].value, 100);
  assert.equal(result.metadata.value, 101);
});

test("selected styles materially weight treasure content", async () => {
  const { categories, treasure } = setup();
  treasure.materials.register({ id: "test.material.preferred", label: { de: "Bevorzugt", en: "preferred" }, tags: ["test-material", "preferred-tag"], valueFactor: 1 });
  treasure.materials.register({ id: "test.material.other", label: { de: "Andere", en: "other" }, tags: ["test-material", "other-tag"], valueFactor: 1 });
  treasure.styles.register({
    id: "test.style.weighted",
    label: { de: "Gewichtet", en: "weighted" },
    valueFactor: 1,
    weights: { materialTags: { "preferred-tag": 100 } }
  });
  treasure.types.register({
    id: "test.type.weighted",
    categories: ["treasure", "treasure.luxury"],
    label: { de: "Gewichtetes Stück", en: "weighted piece" },
    tags: ["luxury"],
    baseValue: [1, 1],
    materialTags: ["test-material"],
    supportsMotif: false,
    components: []
  });
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  let preferred = 0;
  for (let i = 0; i < 100; i += 1) {
    const result = await generator.generate(request({
      category: "treasure.luxury",
      treasure: {
        type: "test.type.weighted",
        material: "any",
        condition: "core.condition.good",
        craftsmanship: "core.craftsmanship.solid",
        motif: "any",
        style: "test.style.weighted"
      },
      solver: { maxAttempts: 1 },
      value: { mode: "target", target: 1, tolerance: 1 },
      seed: `weighted-${i}`
    }));
    if (result.plan.material.id === "test.material.preferred") preferred += 1;
  }
  assert.ok(preferred >= 90, `preferred material selected only ${preferred}/100 times`);
});

test("German tapestry names avoid the known adjective-case regression", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.art.textile",
    treasure: {
      type: "core.type.art.tapestry",
      material: "any",
      condition: "core.condition.good",
      craftsmanship: "core.craftsmanship.solid",
      motif: "core.motif.religious",
      style: "core.style.merchant"
    },
    seed: "grammar-tapestry"
  }));
  assert.equal(result.itemSource.name.includes("mit religiöses Motiv"), false);
});
