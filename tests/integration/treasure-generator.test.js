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

test("deepened core treasure library exposes broad content registries", () => {
  const { treasure } = setup();
  const diagnostics = treasure.getDiagnostics();
  assert.ok(diagnostics.types >= 70, `expected at least 70 treasure types, got ${diagnostics.types}`);
  assert.ok(diagnostics.materials >= 40, `expected at least 40 materials, got ${diagnostics.materials}`);
  assert.ok(diagnostics.conditions >= 14, `expected at least 14 conditions, got ${diagnostics.conditions}`);
  assert.ok(diagnostics.motifs >= 16, `expected at least 16 motifs, got ${diagnostics.motifs}`);
  assert.ok(diagnostics.styles >= 12, `expected at least 12 styles, got ${diagnostics.styles}`);
});

test("generated treasure stores reproducible forge metadata and a detailed valuation breakdown", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.jewelry",
    treasure: {
      type: "core.type.jewelry.diadem",
      material: "core.material.gold",
      condition: "core.condition.good",
      craftsmanship: "core.craftsmanship.fine",
      motif: "core.motif.heraldry",
      style: "core.style.noble"
    },
    seed: "metadata-diadem"
  }));
  const flag = result.itemSource.flags?.["pf2e-item-forge"];
  assert.equal(flag.generated, true);
  assert.equal(flag.seed, "metadata-diadem");
  assert.equal(flag.treasure.type.id, "core.type.jewelry.diadem");
  assert.ok(Number.isFinite(result.plan.valuation.materialFactor));
  assert.ok(Number.isFinite(result.plan.valuation.craftsmanshipFactor));
  assert.equal(result.plan.valuation.finalValue, result.metadata.value);
});

test("book treasure now carries edition and completeness details", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.book",
    treasure: {
      type: "core.type.book.genealogy",
      material: "any",
      condition: "core.condition.worn",
      craftsmanship: "any",
      motif: "any",
      style: "core.style.scholarly"
    },
    seed: "deep-book"
  }));
  assert.ok(result.plan.attributes.subject);
  assert.ok(result.plan.attributes.edition);
  assert.ok(result.plan.attributes.completeness);
  assert.ok(result.itemSource.system.description.value.includes(result.plan.attributes.edition.label));
});

test("beverage treasure carries origin, quality, vessel, and age details", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.beverage.wine",
    seed: "deep-wine"
  }));
  for (const field of ["kind", "vessel", "age", "quality", "origin"]) {
    assert.ok(result.plan.attributes[field], `missing beverage attribute ${field}`);
  }
});

test("material-aware conditions accept water damage for books but reject it for gemstones", async () => {
  const { generator } = setup();
  const book = await generator.generate(request({
    category: "treasure.book",
    treasure: {
      type: "core.type.book.history",
      material: "core.material.parchment",
      condition: "core.condition.water-stained",
      craftsmanship: "core.craftsmanship.solid",
      motif: "any",
      style: "core.style.scholarly"
    },
    seed: "water-book"
  }));
  assert.equal(book.plan.condition.id, "core.condition.water-stained");

  await assert.rejects(
    () => generator.generate(request({
      category: "treasure.gemstone",
      treasure: {
        type: "core.type.gem.cut",
        material: "core.material.ruby",
        condition: "core.condition.water-stained",
        craftsmanship: "core.craftsmanship.fine",
        motif: "any",
        style: "core.style.noble"
      },
      solver: { maxAttempts: 3 },
      seed: "water-gem"
    })),
    (error) => error?.code === "NO_TREASURE_CANDIDATE"
  );
});

test("treasure type condition weights materially influence condition selection", async () => {
  const { categories, treasure } = setup();
  treasure.conditions.register({ id: "test.condition.a", label: { de: "A", en: "A" }, sentence: { de: "A.", en: "A." }, valueFactor: 1, weight: 1 });
  treasure.conditions.register({ id: "test.condition.b", label: { de: "B", en: "B" }, sentence: { de: "B.", en: "B." }, valueFactor: 1, weight: 1 });
  treasure.types.register({
    id: "test.type.condition-weighted",
    categories: ["treasure", "treasure.luxury"],
    label: { de: "Teststück", en: "test piece" },
    tags: ["luxury"],
    baseValue: [10, 10],
    materialTags: [],
    supportsMotif: false,
    usesCraftsmanship: false,
    components: [],
    conditionWeights: { "test.condition.a": 1000, "test.condition.b": 0 }
  });
  const generator = new TreasureGenerator({ categories, treasure, localeProvider: () => "de" });
  let selectedA = 0;
  for (let index = 0; index < 60; index += 1) {
    const result = await generator.generate(request({
      category: "treasure.luxury",
      treasure: {
        type: "test.type.condition-weighted",
        material: "any",
        condition: "any",
        craftsmanship: "any",
        motif: "any",
        style: "core.style.merchant"
      },
      value: { mode: "target", target: 10, tolerance: 1 },
      solver: { maxAttempts: 1 },
      seed: `condition-weight-${index}`
    }));
    if (result.plan.condition.id === "test.condition.a") selectedA += 1;
  }
  assert.ok(selectedA >= 50, `preferred condition selected only ${selectedA}/60 times`);
});

test("large sculpture treasure preserves type-specific bulk", async () => {
  const { generator } = setup();
  const result = await generator.generate(request({
    category: "treasure.art.sculpture",
    treasure: {
      type: "core.type.art.statue",
      material: "core.material.marble",
      condition: "core.condition.good",
      craftsmanship: "core.craftsmanship.solid",
      motif: "core.motif.ancestral",
      style: "core.style.ancient"
    },
    seed: "heavy-statue"
  }));
  assert.equal(result.itemSource.system.bulk.value, 4);
});

test("core book and beverage treasure types expose distinct selector labels", () => {
  const { treasure } = setup();
  const label = (entry) => entry.label?.de ?? entry.label;

  const books = treasure.types.getAll().filter((entry) => entry.id.startsWith("core.type.book."));
  const beverages = treasure.types.getAll().filter((entry) => entry.id.startsWith("core.type.beverage."));

  assert.equal(new Set(books.map(label)).size, books.length);
  assert.equal(new Set(beverages.map(label)).size, beverages.length);
  assert.ok(books.some((entry) => label(entry) === "Chronik"));
  assert.ok(books.some((entry) => label(entry) === "Bestiarium"));
  assert.ok(beverages.some((entry) => label(entry) === "Wein"));
  assert.ok(beverages.some((entry) => label(entry) === "Met"));
});
