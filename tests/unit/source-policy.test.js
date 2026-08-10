import test from "node:test";
import assert from "node:assert/strict";
import { mergeVisibleSourceSelection, normalizeSourcePolicy, sourceAllowsEntry } from "../../src/engine/source-policy.js";
import { deserializeSourcePolicy, serializeSourcePolicy } from "../../src/engine/source-policy-storage.js";

test("full source-policy storage round-trips include and exclude packs", () => {
  const source = { mode: "selected", includePacks: ["pf2e.items", "module.loot"], excludePacks: ["module.bad"] };
  const restored = deserializeSourcePolicy(serializeSourcePolicy(source));
  assert.deepEqual(restored, source);
});

test("source-policy storage falls back to legacy mode/include values", () => {
  const restored = deserializeSourcePolicy("{broken", { legacyMode: "selected", legacyIncludePacks: ["pf2e.items"] });
  assert.deepEqual(restored, { mode: "selected", includePacks: ["pf2e.items"], excludePacks: [] });
});

test("visible source edits preserve temporarily unavailable selected pack IDs", () => {
  const merged = mergeVisibleSourceSelection(
    ["pf2e.items", "module.temporarily-missing"],
    ["pf2e.items", "module.loot"],
    ["module.loot"]
  );
  assert.deepEqual(merged, ["module.temporarily-missing", "module.loot"]);
});

test("sourceAllowsEntry applies selected, system, and exclude contracts", () => {
  const system = { pack: "pf2e.items", packageType: "system", packageName: "pf2e" };
  const module = { pack: "module.loot", packageType: "module", packageName: "loot" };
  assert.equal(sourceAllowsEntry(system, normalizeSourcePolicy({ mode: "system" })), true);
  assert.equal(sourceAllowsEntry(module, normalizeSourcePolicy({ mode: "system" })), false);
  assert.equal(sourceAllowsEntry(module, { mode: "selected", includePacks: ["module.loot"], excludePacks: [] }), true);
  assert.equal(sourceAllowsEntry(module, { mode: "all", includePacks: [], excludePacks: ["module.loot"] }), false);
});
