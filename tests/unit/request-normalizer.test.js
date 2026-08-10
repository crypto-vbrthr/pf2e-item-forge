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
  assert.equal(defaults.magic.wandMode, "standard");
  assert.equal(defaults.magic.wandProfile, "automatic");
  assert.equal(defaults.magic.staffMode, "generated");
  assert.equal(defaults.magic.staffProfile, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.wand",
    magic: { theme: "fire", allowHeightened: false, wandMode: "special", wandProfile: "core.reaching", staffMode: "existing", staffProfile: "core.6-10-14" },
    seed: "x"
  });
  assert.equal(explicit.magic.theme, "fire");
  assert.equal(explicit.magic.allowHeightened, false);
  assert.equal(explicit.magic.wandMode, "special");
  assert.equal(explicit.magic.wandProfile, "core.reaching");
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

test("normalizeRequest hydrates specific magic weapon, armor, and shield settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.weapon", seed: "x" });
  assert.equal(defaults.magic.specificMode, "existing");
  assert.equal(defaults.magic.specificProfile, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.armor",
    magic: { specificMode: "generated", specificProfile: "core.elemental-ward-armor", theme: "cold" },
    seed: "x"
  });
  assert.equal(explicit.magic.specificMode, "generated");
  assert.equal(explicit.magic.specificProfile, "core.elemental-ward-armor");
  assert.equal(explicit.magic.theme, "cold");
});

test("validation accepts specific magic weapon, armor, and shield categories", async () => {
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  for (const category of ["magic.weapon", "magic.armor", "magic.shield"]) {
    const result = validateRequest(
      { mode: "magic", category, level: 8, source: { mode: "system" }, seed: "x" },
      { categories, generationModes: ["magic"] }
    );
    assert.equal(result.valid, true, category);
  }
});

test("normalizeRequest hydrates worn magic item settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.worn", seed: "x" });
  assert.equal(defaults.magic.wornMode, "existing");
  assert.equal(defaults.magic.wornProfile, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.worn.footwear",
    magic: { wornMode: "generated", wornProfile: "core.wayfarer-footwear" },
    seed: "x"
  });
  assert.equal(explicit.magic.wornMode, "generated");
  assert.equal(explicit.magic.wornProfile, "core.wayfarer-footwear");
  assert.equal(explicit.category, "magic.worn.footwear");
});

test("validation accepts worn magic root and worn usage subcategories", async () => {
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  for (const category of ["magic.worn", "magic.worn.cloak", "magic.worn.eyepiece", "magic.worn.footwear"]) {
    const result = validateRequest(
      { mode: "magic", category, level: 8, source: { mode: "system" }, seed: "x" },
      { categories, generationModes: ["magic"] }
    );
    assert.equal(result.valid, true, category);
  }
});


test("normalizeRequest hydrates accessory rune settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.accessory-rune", seed: "x" });
  assert.equal(defaults.magic.accessoryRune, "automatic");

  const explicit = normalizeRequest({
    mode: "magic",
    category: "magic.accessory-rune",
    magic: { accessoryRune: "trackless" },
    seed: "x"
  });
  assert.equal(explicit.magic.accessoryRune, "trackless");
  assert.equal(explicit.category, "magic.accessory-rune");
});

test("validation accepts the accessory rune magic category", async () => {
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  const result = validateRequest(
    { mode: "magic", category: "magic.accessory-rune", level: 6, source: { mode: "system" }, magic: { accessoryRune: "trackless" }, seed: "x" },
    { categories, generationModes: ["magic"] }
  );
  assert.equal(result.valid, true);
  assert.equal(result.request.category, "magic.accessory-rune");
  assert.equal(result.request.magic.accessoryRune, "trackless");
});

test("normalizeRequest hydrates held magic item settings", () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.held", seed: "x" });
  assert.equal(defaults.magic.heldMode, "existing");
  assert.equal(defaults.magic.heldProfile, "automatic");
  const explicit = normalizeRequest({ mode: "magic", category: "magic.held.two-hands", magic: { heldMode: "generated", heldProfile: "core.stormglass-sphere" }, seed: "x" });
  assert.equal(explicit.magic.heldMode, "generated");
  assert.equal(explicit.magic.heldProfile, "core.stormglass-sphere");
  assert.equal(explicit.category, "magic.held.two-hands");
});

test("validation accepts held magic root and handedness subcategories", async () => {
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  for (const category of ["magic.held", "magic.held.one-hand", "magic.held.two-hands"]) {
    const result = validateRequest({ mode: "magic", category, level: 8, source: { mode: "system" }, seed: "x" }, { categories, generationModes: ["magic"] });
    assert.equal(result.valid, true, category);
  }
});

test("normalizeRequest hydrates grimoire settings and validation accepts the category", async () => {
  const defaults = normalizeRequest({ mode: "magic", category: "magic.grimoire", seed: "x" });
  assert.equal(defaults.magic.grimoireMode, "existing");
  assert.equal(defaults.magic.grimoireProfile, "automatic");
  const explicit = normalizeRequest({ mode: "magic", category: "magic.grimoire", magic: { grimoireMode: "generated", grimoireProfile: "core.elemental-concordance" }, seed: "x" });
  assert.equal(explicit.magic.grimoireMode, "generated");
  assert.equal(explicit.magic.grimoireProfile, "core.elemental-concordance");

  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  const result = validateRequest({ mode: "magic", category: "magic.grimoire", level: 8, source: { mode: "system" }, seed: "x" }, { categories, generationModes: ["magic"] });
  assert.equal(result.valid, true);
});

test("normalizeRequest hydrates apex settings and validation accepts the apex category", async () => {
  const normalized = normalizeRequest({ mode: "magic", category: "magic.apex", magic: { apexMode: "generated", apexProfile: "core.apex-might", apexAttribute: "str" } });
  assert.equal(normalized.magic.apexMode, "generated");
  assert.equal(normalized.magic.apexProfile, "core.apex-might");
  assert.equal(normalized.magic.apexAttribute, "str");
  const { validateRequest } = await import("../../src/engine/request-normalizer.js");
  const { CategoryRegistry, registerCoreCategories } = await import("../../src/engine/category-registry.js");
  const categories = registerCoreCategories(new CategoryRegistry());
  const validation = validateRequest(normalized, { categories, generationModes: new Set(["magic"]) });
  assert.equal(validation.valid, true);
});

test("normalizeRequest hydrates the world-default selected compendium list only when the request omits it", () => {
  const defaults = { defaultSourceMode: "selected", defaultSourcePacks: ["pf2e.equipment-srd", "module.custom-items", "module.custom-items"] };
  const inherited = normalizeRequest({ mode: "existing", category: "item", seed: "x" }, defaults);
  assert.equal(inherited.source.mode, "selected");
  assert.deepEqual(inherited.source.includePacks, ["pf2e.equipment-srd", "module.custom-items"]);

  const explicit = normalizeRequest({
    mode: "existing",
    category: "item",
    source: { mode: "selected", includePacks: ["pf2e.spells-srd"] },
    seed: "x"
  }, defaults);
  assert.deepEqual(explicit.source.includePacks, ["pf2e.spells-srd"]);

  const explicitlyEmpty = normalizeRequest({
    mode: "existing",
    category: "item",
    source: { mode: "selected", includePacks: [] },
    seed: "x"
  }, defaults);
  assert.deepEqual(explicitlyEmpty.source.includePacks, []);
});
