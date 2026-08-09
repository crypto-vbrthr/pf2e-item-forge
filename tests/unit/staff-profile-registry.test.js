import test from "node:test";
import assert from "node:assert/strict";
import { StaffProfileRegistry, registerCoreStaffProfiles } from "../../src/engine/registries/staff-profile-registry.js";

test("core staff profiles register rules-style variant families", () => {
  const registry = registerCoreStaffProfiles(new StaffProfileRegistry());
  assert.deepEqual(registry.get("core.3-8-12").variants.map((variant) => variant.level), [3, 8, 12]);
  assert.deepEqual(registry.get("core.6-10-14").variants[1].ranks.map((entry) => entry.rank), [3, 4]);
});

test("staff profile registry rejects non-increasing variant levels", () => {
  const registry = new StaffProfileRegistry();
  assert.throws(() => registry.register({
    id: "bad",
    variants: [
      { level: 8, price: 100, ranks: [{ rank: 1 }] },
      { level: 8, price: 200, ranks: [{ rank: 2 }] }
    ]
  }));
});

test("core staff profiles expose reviewed rulebook-family provenance", () => {
  const registry = registerCoreStaffProfiles(new StaffProfileRegistry());
  assert.ok(registry.getAll().every((profile) => profile.balance.reviewed === true));
  assert.ok(registry.getAll().every((profile) => profile.balance.basis === "rulebook-family-patterns"));
});
