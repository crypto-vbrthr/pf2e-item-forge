import test from "node:test";
import assert from "node:assert/strict";
import { SpellCandidateService } from "../../src/engine/spell-candidate-service.js";

const service = new SpellCandidateService();
const request = { rarity: [], source: { mode: "all", includePacks: [], excludePacks: [] } };

function spell(id, data = {}) {
  return {
    id,
    uuid: id,
    baseRank: data.baseRank ?? 1,
    cantrip: data.cantrip ?? false,
    focus: data.focus ?? false,
    ritual: data.ritual ?? false,
    traits: data.traits ?? ["fire"],
    traditions: data.traditions ?? ["arcane"],
    heightening: data.heightening ?? null,
    slug: id
  };
}

test("SpellCandidateService centralizes normal spell and theme filtering", () => {
  const index = { querySpells: () => [spell("fire"), spell("cold", { traits: ["cold"] }), spell("ritual", { ritual: true })] };
  const result = service.getEligibleSpells(index, request, { allowSlotted: true, theme: "fire" });
  assert.deepEqual(result.map((entry) => entry.id), ["fire"]);
});

test("SpellCandidateService returns only meaningful heightened ranks", () => {
  const scaling = spell("scaling", { baseRank: 1, heightening: { type: "interval", interval: 2 } });
  assert.deepEqual(service.getAvailableRanks(scaling, { maxRank: 7, allowHeightened: true }), [1, 3, 5, 7]);
  assert.deepEqual(service.getAvailableRanks(scaling, { maxRank: 7, allowHeightened: false }), [1]);
});
