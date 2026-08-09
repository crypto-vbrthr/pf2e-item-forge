import test from "node:test";
import assert from "node:assert/strict";
import { SpellheartProfileRegistry, registerCoreSpellheartProfiles } from "../../src/engine/registries/spellheart-profile-registry.js";

test("core spellheart profiles register coherent level progressions", () => {
  const registry = registerCoreSpellheartProfiles(new SpellheartProfileRegistry());
  assert.deepEqual(registry.get("core.elemental-conduit").variants.map((v) => v.level), [3, 8, 13]);
  assert.deepEqual(registry.get("core.sonic-resonator").variants.map((v) => v.level), [5, 7, 12]);
  assert.deepEqual(registry.get("core.void-fang").variants.map((v) => v.level), [9, 12, 15]);
  assert.deepEqual(registry.get("core.vitality-feather").variants.map((v) => v.level), [10, 14, 16]);
});

test("spellheart profile registry rejects malformed profiles early", () => {
  const registry = new SpellheartProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.no-theme", allowedThemes: [], variants: [{ id: "base", level: 3, price: 60, dailyRanks: [] }] }));
  assert.throws(() => registry.register({
    id: "bad.level-order",
    allowedThemes: ["fire"],
    variants: [
      { id: "base", level: 8, price: 100, dailyRanks: [] },
      { id: "greater", level: 3, price: 200, dailyRanks: [] }
    ]
  }));
});

test("core spellheart profiles expose reviewed balance provenance", () => {
  const registry = registerCoreSpellheartProfiles(new SpellheartProfileRegistry());
  assert.ok(registry.getAll().every((profile) => profile.balance.reviewed === true));
  assert.ok(registry.getAll().every((profile) => profile.balance.basis === "published-analogs"));
});
