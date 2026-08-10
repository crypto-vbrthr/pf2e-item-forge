import test from "node:test";
import assert from "node:assert/strict";
import { GrimoireProfileRegistry, registerCoreGrimoireProfiles } from "../../src/engine/registries/grimoire-profile-registry.js";

test("core grimoire profiles cover every generated level 4 through 20", () => {
  const registry = registerCoreGrimoireProfiles(new GrimoireProfileRegistry());
  const profiles = registry.getAll();
  assert.equal(profiles.length, 5);
  const levels = new Set(profiles.flatMap((profile) => profile.variants.map((variant) => variant.level)));
  assert.equal(levels.has(1), false);
  assert.equal(levels.has(2), false);
  assert.equal(levels.has(3), false);
  for (let level = 4; level <= 20; level += 1) assert.ok(levels.has(level), `missing generated grimoire level ${level}`);
  for (const profile of profiles) {
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
    assert.match(profile.physical.bulk, /^(?:L|\d+)$/);
    for (const variant of profile.variants) {
      assert.ok(variant.activation);
      assert.equal(variant.activation.spellFilter.preparedFromGrimoire, true);
      assert.equal(variant.activation.spellFilter.slotsOnly, true);
      assert.ok(["action", "reaction", "free-action"].includes(variant.activation.type));
    }
  }
});

test("grimoire profile registry normalizes structured activation and spell filters", () => {
  const registry = new GrimoireProfileRegistry();
  const profile = registry.register({
    id: "test.reactive-grimoire",
    physical: { bulk: "1" },
    variants: [{
      id: "base",
      level: 8,
      price: 450,
      activation: {
        type: "reaction",
        traits: ["Concentrate", "concentrate"],
        frequency: { max: 2, period: "day" },
        trigger: "A spell misses.",
        requirements: "The spell was prepared from this grimoire.",
        duration: "1 round",
        spellFilter: { traitsAny: ["Fire", "fire"], requiresSpellAttack: true },
        effectText: "Correct the formula."
      }
    }]
  });
  const activation = profile.variants[0].activation;
  assert.equal(activation.type, "reaction");
  assert.equal(activation.actions, 0);
  assert.deepEqual(activation.traits, ["concentrate"]);
  assert.deepEqual(activation.spellFilter.traitsAny, ["fire"]);
  assert.equal(activation.spellFilter.requiresSpellAttack, true);
  assert.equal(activation.frequency.max, 2);
});

test("grimoire profile registry rejects malformed contracts", () => {
  const registry = new GrimoireProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.level", variants: [{ level: 5, price: 100 }, { level: 5, price: 200 }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad.rarity", rarity: "mythic", variants: [{ level: 5, price: 100 }] }), /invalid rarity/);
  assert.throws(() => registry.register({ id: "bad.bulk", physical: { bulk: "huge" }, variants: [{ level: 5, price: 100 }] }), /invalid bulk/);
  assert.throws(() => registry.register({ id: "bad.native", automation: "native", variants: [{ level: 5, price: 100 }] }), /cannot declare native automation/);
  assert.throws(() => registry.register({ id: "bad.type", variants: [{ level: 5, price: 100, activation: { type: "interrupt", effectText: "x" } }] }), /invalid activation type/);
  assert.throws(() => registry.register({ id: "bad.actions", variants: [{ level: 5, price: 100, activation: { type: "reaction", actions: 1, effectText: "x" } }] }), /must not declare action count/);
  assert.throws(() => registry.register({ id: "bad.frequency", variants: [{ level: 5, price: 100, activation: { frequency: { max: 0, period: "day" }, effectText: "x" } }] }), /invalid activation frequency/);
  assert.throws(() => registry.register({ id: "bad.filter", variants: [{ level: 5, price: 100, activation: { spellFilter: "fire", effectText: "x" } }] }), /spellFilter must be an object/);
});
