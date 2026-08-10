import test from "node:test";
import assert from "node:assert/strict";
import { HeldMagicProfileRegistry, registerCoreHeldMagicProfiles } from "../../src/engine/registries/held-magic-profile-registry.js";

test("core held magic profiles cover every level 1 through 20 for both handedness families", () => {
  const registry = registerCoreHeldMagicProfiles(new HeldMagicProfileRegistry());
  const profiles = registry.getAll();
  assert.equal(profiles.length, 10);
  assert.deepEqual(new Set(profiles.map((profile) => profile.hands)), new Set([1, 2]));
  for (const hands of [1, 2]) {
    const levels = new Set(registry.getForHands(hands).flatMap((profile) => profile.variants.map((variant) => variant.level)));
    for (let level = 1; level <= 20; level += 1) assert.ok(levels.has(level), `missing ${hands}-hand held-item level ${level}`);
  }
  for (const profile of profiles) {
    assert.equal(profile.automation, "rules-text");
    assert.equal(profile.balance.reviewed, true);
    assert.match(profile.physical.bulk, /^(?:L|\d+)$/);
    for (const variant of profile.variants) {
      assert.ok(variant.activation);
      assert.equal(variant.activation.type, "action");
      assert.ok(Number.isInteger(variant.activation.actions));
      assert.ok(Array.isArray(variant.activation.traits));
      assert.equal(variant.activation.frequency.max, 1);
      assert.ok(variant.activation.frequency.period);
    }
  }
});

test("held magic profile registry normalizes physical and activation contracts", () => {
  const registry = new HeldMagicProfileRegistry();
  const profile = registry.register({
    id: "test.contract",
    hands: 2,
    physical: { bulk: "1" },
    effectText: "Effect",
    variants: [{
      id: "base",
      level: 4,
      price: 90,
      activation: {
        actions: 2,
        traits: ["Concentrate", "manipulate", "concentrate"],
        frequency: { max: 1, period: "day" }
      }
    }]
  });
  assert.deepEqual(profile.physical, { bulk: "1" });
  assert.equal(profile.variants[0].activation.type, "action");
  assert.deepEqual(profile.variants[0].activation.traits, ["concentrate", "manipulate"]);
  assert.equal(profile.variants[0].activation.effectText, "Effect");

  const reaction = registry.register({
    id: "test.reaction",
    hands: 1,
    variants: [{ id: "base", level: 5, price: 125, activation: { type: "reaction", frequency: { max: 2, period: "day" }, trigger: "Trigger", effectText: "Effect" } }]
  });
  assert.equal(reaction.variants[0].activation.type, "reaction");
  assert.equal(reaction.variants[0].activation.actions, 0);
  assert.equal(reaction.variants[0].activation.frequency.max, 2);

  const freeAction = registry.register({
    id: "test.free-action",
    hands: 1,
    variants: [{ id: "base", level: 6, price: 225, activation: { type: "free-action", effectText: "Effect" } }]
  });
  assert.equal(freeAction.variants[0].activation.type, "free-action");
  assert.equal(freeAction.variants[0].activation.actions, 0);
});

test("held magic profile registry rejects malformed contracts", () => {
  const registry = new HeldMagicProfileRegistry();
  assert.throws(() => registry.register({ id: "bad.hands", hands: 3, variants: [{ level: 1, price: 15 }] }), /hands 1 or 2/);
  assert.throws(() => registry.register({ id: "bad.level", hands: 1, variants: [{ level: 5, price: 100 }, { level: 5, price: 200 }] }), /increase in level/);
  assert.throws(() => registry.register({ id: "bad.rarity", hands: 1, rarity: "mythic", variants: [{ level: 1, price: 15 }] }), /invalid rarity/);
  assert.throws(() => registry.register({ id: "bad.invested", hands: 1, invested: "yes", variants: [{ level: 1, price: 15 }] }), /invested must be boolean/);
  assert.throws(() => registry.register({ id: "bad.native", hands: 1, automation: "native", variants: [{ level: 1, price: 15 }] }), /cannot declare native automation/);
  assert.throws(() => registry.register({ id: "bad.bulk", hands: 1, physical: { bulk: "huge" }, variants: [{ level: 1, price: 15 }] }), /invalid bulk/);
  assert.throws(() => registry.register({ id: "bad.activation", hands: 1, effectText: "Effect", variants: [{ level: 1, price: 15, activation: { actions: 9 } }] }), /invalid activation actions/);
  assert.throws(() => registry.register({ id: "bad.activation-type", hands: 1, variants: [{ level: 1, price: 15, activation: { type: "interrupt", effectText: "Effect" } }] }), /invalid activation type/);
  assert.throws(() => registry.register({ id: "bad.reaction-actions", hands: 1, variants: [{ level: 1, price: 15, activation: { type: "reaction", actions: 1, effectText: "Effect" } }] }), /must not declare action count/);
  assert.throws(() => registry.register({ id: "bad.frequency", hands: 1, effectText: "Effect", variants: [{ level: 1, price: 15, activation: { actions: 1, frequency: { max: 0, period: "day" } } }] }), /invalid activation frequency/);
});
