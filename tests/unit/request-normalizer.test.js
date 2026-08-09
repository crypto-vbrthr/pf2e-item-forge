import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequest } from "../../src/engine/request-normalizer.js";

test("normalizeRequest normalizes a single level into an exact range", () => {
  const request = normalizeRequest({ level: 8, seed: "x" });
  assert.deepEqual(request.level, { min: 8, max: 8, target: 8 });
});

test("normalizeRequest sorts reversed ranges and clamps solver attempts", () => {
  const request = normalizeRequest({ level: { min: 12, max: 8 }, solver: { maxAttempts: 999999 }, seed: "x" });
  assert.equal(request.level.min, 8);
  assert.equal(request.level.max, 12);
  assert.equal(request.solver.maxAttempts, 1000);
});


test("normalizeRequest supports composed equipment mode and fundamental rune policy", () => {
  const request = normalizeRequest({
    mode: "equipment",
    category: "weapon",
    equipment: { fundamentalRunes: "none" },
    seed: "x"
  });
  assert.equal(request.mode, "equipment");
  assert.equal(request.equipment.fundamentalRunes, "none");
});


test("normalizeRequest supports property rune modes and removes duplicate fixed selections", () => {
  const request = normalizeRequest({
    mode: "equipment",
    equipment: {
      propertyRunes: { mode: "fixed", selected: ["flaming", "flaming", "frost"] }
    },
    seed: "x"
  });
  assert.equal(request.equipment.propertyRunes.mode, "fixed");
  assert.deepEqual(request.equipment.propertyRunes.selected, ["flaming", "frost"]);
});

test("normalizeRequest supports treasure mode and value constraints", () => {
  const request = normalizeRequest({
    mode: "treasure",
    category: "treasure.jewelry",
    value: { mode: "range", min: 80, max: 40 },
    treasure: { material: "core.material.silver" },
    seed: "x"
  });
  assert.equal(request.mode, "treasure");
  assert.equal(request.value.mode, "range");
  assert.equal(request.value.min, 40);
  assert.equal(request.value.max, 80);
  assert.equal(request.treasure.material, "core.material.silver");
});


test("normalizeRequest keeps registered future generation modes and normalizes exact treasure type", () => {
  const request = normalizeRequest({ mode: "custom-mode", treasure: { type: "custom.type" }, seed: "x" });
  assert.equal(request.mode, "custom-mode");
  assert.equal(request.treasure.type, "custom.type");
});

test("normalizeRequest hydrates magic item settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.staff", seed: "x" });
  assert.equal(defaults.magic.theme, "automatic");
  assert.equal(defaults.magic.allowHeightened, true);
  assert.equal(defaults.magic.staffMode, "generated");
  assert.equal(defaults.magic.staffProfile, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.wand",
    magic: { theme: "fire", allowHeightened: false, staffMode: "existing", staffProfile: "core.6-10-14" },
    seed: "x"
  });
  assert.equal(explicit.magic.theme, "fire");
  assert.equal(explicit.magic.allowHeightened, false);
  assert.equal(explicit.magic.staffMode, "existing");
  assert.equal(explicit.magic.staffProfile, "core.6-10-14");
});


test("magic spellheart requests retain the dedicated category", () => {
  const request = normalizeRequest({ mode: "magic", category: "magic.spellheart", level: 7, seed: "x" });
  assert.equal(request.category, "magic.spellheart");
  assert.deepEqual(request.level, { min: 7, max: 7, target: 7 });
});

test("validation accepts spellheart as a supported magic category", async () => {
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  const result = validateRequest(
    { mode: "magic", category: "magic.spellheart", level: 7, source: { mode: "system" }, seed: "x" },
    { categories, generationModes: ["magic"] }
  );
  assert.equal(result.valid, true);
  assert.equal(result.request.category, "magic.spellheart");
});

test("normalizeRequest hydrates custom spellheart settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.spellheart", seed: "x" });
  assert.equal(defaults.magic.spellheartMode, "existing");
  assert.equal(defaults.magic.spellheartProfile, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.spellheart",
    magic: { spellheartMode: "generated", spellheartProfile: "core.elemental-conduit", theme: "fire", allowHeightened: false },
    seed: "x"
  });
  assert.equal(explicit.magic.spellheartMode, "generated");
  assert.equal(explicit.magic.spellheartProfile, "core.elemental-conduit");
  assert.equal(explicit.magic.theme, "fire");
  assert.equal(explicit.magic.allowHeightened, false);
});
