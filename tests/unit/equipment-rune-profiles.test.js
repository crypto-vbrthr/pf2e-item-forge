import test from "node:test";
import assert from "node:assert/strict";
import {
  WEAPON_FUNDAMENTAL_PROFILES,
  ARMOR_FUNDAMENTAL_PROFILES,
  SHIELD_REINFORCING_PROFILES,
  applyFundamentalProfile,
  propertyRuneCapacity
} from "../../src/engine/equipment-rune-profiles.js";

test("canonical fundamental profiles expose the expected progression levels", () => {
  assert.deepEqual(WEAPON_FUNDAMENTAL_PROFILES.map((p) => p.level), [0, 2, 4, 10, 12, 16, 19]);
  assert.deepEqual(ARMOR_FUNDAMENTAL_PROFILES.map((p) => p.level), [0, 5, 8, 11, 14, 18, 20]);
  assert.deepEqual(SHIELD_REINFORCING_PROFILES.map((p) => p.level), [0, 4, 7, 10, 13, 16, 19]);
});

test("property rune capacity follows potency and shields have no property slots", () => {
  assert.equal(propertyRuneCapacity("weapon", 2), 2);
  assert.equal(propertyRuneCapacity("armor", 3), 3);
  assert.equal(propertyRuneCapacity("shield", 3), 0);
});

test("applyFundamentalProfile writes weapon, armor, and shield rune data", () => {
  const weapon = { type: "weapon", system: {} };
  applyFundamentalProfile(weapon, { potency: 1, striking: 1 });
  assert.equal(weapon.system.runes.potency, 1);
  assert.equal(weapon.system.runes.striking, 1);

  const armor = { type: "armor", system: {} };
  applyFundamentalProfile(armor, { potency: 2, resilient: 1 });
  assert.equal(armor.system.runes.potency, 2);
  assert.equal(armor.system.runes.resilient, 1);

  const shield = { type: "shield", system: {} };
  applyFundamentalProfile(shield, { reinforcing: 2 });
  assert.equal(shield.system.runes.reinforcing, 2);
});
