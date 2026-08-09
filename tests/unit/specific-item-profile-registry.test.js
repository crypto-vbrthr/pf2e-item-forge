import test from "node:test";
import assert from "node:assert/strict";
import { SpecificItemProfileRegistry, registerCoreSpecificItemProfiles } from "../../src/engine/registries/specific-item-profile-registry.js";

test("core specific item profiles register weapon and armor families", () => {
  const registry = registerCoreSpecificItemProfiles(new SpecificItemProfileRegistry());
  const weapons = registry.getForItemType("weapon");
  const armors = registry.getForItemType("armor");
  assert.ok(weapons.some((profile) => profile.id === "core.retributive-weapon"));
  assert.ok(weapons.some((profile) => profile.id === "core.elemental-resonance-weapon"));
  assert.ok(armors.some((profile) => profile.id === "core.elemental-ward-armor"));
  assert.ok(armors.some((profile) => profile.id === "core.guardian-reaction-armor"));
});

test("specific item profiles reject unknown fundamental rune profiles", () => {
  const registry = new SpecificItemProfileRegistry();
  assert.throws(() => registry.register({
    id: "test.bad",
    itemType: "weapon",
    variants: [{ level: 5, price: 100, fundamentalProfile: "no-such-rune" }]
  }), /Unknown fundamental profile/);
});

test("specific item profiles reject property runes beyond potency capacity", () => {
  const registry = new SpecificItemProfileRegistry();
  assert.throws(() => registry.register({
    id: "test.too-many-runes",
    itemType: "weapon",
    allowedThemes: ["fire"],
    propertyRunesByTheme: { fire: ["flaming", "frost"] },
    variants: [{ level: 8, price: 500, fundamentalProfile: "potency-1-striking" }]
  }), /property-rune capacity/);
});

test("core specific-item profiles expose reviewed balance provenance", () => {
  const registry = registerCoreSpecificItemProfiles(new SpecificItemProfileRegistry());
  assert.ok(registry.getAll().every((profile) => profile.balance.reviewed === true));
});

test("generated specific item profiles cannot claim native automation", () => {
  const registry = new SpecificItemProfileRegistry();
  assert.throws(() => registry.register({
    id: "fake-native",
    itemType: "weapon",
    automation: "native",
    variants: [{ level: 4, price: 100, fundamentalProfile: "potency-1-striking" }]
  }), /cannot declare native automation/);
});
