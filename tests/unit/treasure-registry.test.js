import test from "node:test";
import assert from "node:assert/strict";
import { TreasureRegistry } from "../../src/engine/registries/treasure-registry.js";

test("TreasureRegistry accepts new content without generator changes", () => {
  const treasure = new TreasureRegistry();
  treasure.types.register({ id: "test.decorative-spoon", baseValue: { min: 2, max: 10 } });
  treasure.materials.register({ id: "test.porcelain", tags: ["ceramic"] });
  assert.equal(treasure.types.has("test.decorative-spoon"), true);
  assert.equal(treasure.materials.get("test.porcelain").tags.includes("ceramic"), true);
});
