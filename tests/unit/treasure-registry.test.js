import test from "node:test";
import assert from "node:assert/strict";
import { TreasureRegistry } from "../../src/engine/registries/treasure-registry.js";

test("TreasureRegistry accepts new content without generator changes", () => {
  const treasure = new TreasureRegistry();
  treasure.materials.register({ id: "test.porcelain", tags: ["ceramic"], valueFactor: 1.2 });
  treasure.components.register({ id: "test.paint", baseValue: [1, 2], craftsmanshipMode: "inherit" });
  treasure.types.register({
    id: "test.decorative-spoon",
    categories: ["treasure", "treasure.luxury"],
    tags: ["luxury"],
    baseValue: [2, 10],
    materialTags: ["ceramic"],
    components: [{ id: "test.paint", chance: 0.5 }]
  });
  assert.equal(treasure.types.has("test.decorative-spoon"), true);
  assert.equal(treasure.materials.get("test.porcelain").tags.includes("ceramic"), true);
});

test("TreasureRegistry rejects invalid ranges and unknown component references at registration time", () => {
  const treasure = new TreasureRegistry();
  assert.throws(
    () => treasure.materials.register({ id: "bad.material", tags: [], componentValue: [10, 1] }),
    (error) => error?.code === "INVALID_CONTENT_DEFINITION"
  );
  assert.throws(
    () => treasure.types.register({
      id: "bad.type",
      categories: ["treasure"],
      tags: [],
      baseValue: [1, 2],
      materialTags: [],
      components: [{ id: "missing.component", chance: 1 }]
    }),
    (error) => error?.code === "INVALID_CONTENT_DEFINITION" && error?.details?.field === "components"
  );
});

test("TreasureRegistry exposes registry diagnostics", () => {
  const treasure = new TreasureRegistry();
  treasure.materials.register({ id: "test.material", tags: [] });
  assert.equal(treasure.getDiagnostics().materials, 1);
  assert.equal(treasure.getDiagnostics().types, 0);
});

test("TreasureRegistry can validate treasure categories when a CategoryRegistry is supplied", async () => {
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  const treasure = new TreasureRegistry({ categories });
  assert.throws(
    () => treasure.types.register({
      id: "bad.category.type",
      categories: ["treasure.missing"],
      tags: [],
      baseValue: [1, 2],
      materialTags: [],
      components: []
    }),
    (error) => error?.code === "INVALID_CONTENT_DEFINITION" && error?.details?.field === "categories"
  );
});
