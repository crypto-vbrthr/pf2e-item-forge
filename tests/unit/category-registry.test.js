import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRegistry, registerCoreCategories } from "../../src/engine/category-registry.js";

test("CategoryRegistry resolves descendant relationships", () => {
  const registry = registerCoreCategories(new CategoryRegistry());
  assert.equal(registry.isDescendant("weapon.ranged.firearm", "weapon"), true);
  assert.equal(registry.isDescendant("weapon.ranged.firearm", "weapon.ranged"), true);
  assert.equal(registry.isDescendant("armor", "weapon"), false);
});

test("CategoryRegistry supports multiple parents", () => {
  const registry = new CategoryRegistry();
  registry.register({ id: "item" });
  registry.register({ id: "melee", parent: "item" });
  registry.register({ id: "ranged", parent: "item" });
  registry.register({ id: "combination", parents: ["melee", "ranged"] });
  assert.equal(registry.isDescendant("combination", "melee"), true);
  assert.equal(registry.isDescendant("combination", "ranged"), true);
});

test("core categories expose wand and staff as magic items", async () => {
  const { registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const registry = registerCoreCategories(new CategoryRegistry());
  assert.equal(registry.isDescendant("magic.wand", "magic"), true);
  assert.equal(registry.isDescendant("magic.staff", "magic"), true);
  assert.equal(registry.isDescendant("magic.staff", "item"), true);
});
