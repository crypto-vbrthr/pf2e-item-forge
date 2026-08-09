import test from "node:test";
import assert from "node:assert/strict";
import { PropertyRuneRegistry, registerCorePropertyRunes } from "../../src/engine/registries/property-rune-registry.js";

function registry() {
  return registerCorePropertyRunes(new PropertyRuneRegistry());
}

test("core property rune registry exposes weapon and armor runes", () => {
  const runes = registry();
  assert.ok(runes.getBySlug("weapon", "flaming"));
  assert.ok(runes.getBySlug("armor", "shadow"));
});

test("property rune compatibility filters melee-only weapon runes", () => {
  const runes = registry();
  const ranged = { type: "weapon", range: 60, traits: [], damageType: "piercing" };
  const compatible = runes.getCompatible(ranged, { maxLevel: 20 });
  assert.equal(compatible.some((rune) => rune.slug === "shifting"), false);
  assert.equal(compatible.some((rune) => rune.slug === "flaming"), true);
});

test("property rune compatibility enforces armor category restrictions", () => {
  const runes = registry();
  const heavy = { type: "armor", armorCategory: "heavy", traits: [] };
  const compatible = runes.getCompatible(heavy, { maxLevel: 20 });
  assert.equal(compatible.some((rune) => rune.slug === "shadow"), false);
  assert.equal(compatible.some((rune) => rune.slug === "fortification"), true);
});

test("external property runes can be registered without modifying the engine", () => {
  const runes = registry();
  runes.register({
    id: "test.radiant",
    slug: "test-radiant",
    itemType: "weapon",
    level: 9,
    rarity: "uncommon",
    label: "Test Radiant"
  });
  assert.equal(runes.getBySlug("weapon", "test-radiant")?.level, 9);
});
