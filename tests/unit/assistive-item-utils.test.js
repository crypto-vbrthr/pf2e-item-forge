import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ASSISTIVE_ITEM_IDENTIFIERS, isAssistiveItem } from "../../src/engine/assistive-item-utils.js";

function raw(name, { slug = null, category = null, traits = [] } = {}) {
  return {
    name,
    type: "equipment",
    system: {
      slug,
      category,
      traits: { value: traits }
    }
  };
}

test("assistive item detection accepts explicit PF2e category and trait markers", () => {
  assert.equal(isAssistiveItem(raw("Future Aid", { category: "assistive" })), true);
  assert.equal(isAssistiveItem(raw("Future Aid", { traits: ["magical", "assistive-item"] })), true);
});

test("assistive item detection recognizes published aid families without scanning descriptions", () => {
  for (const slug of ["chair-of-inventions", "prosthesis", "frog-chair", "batsbreath-cane", "voicebox"]) {
    assert.equal(CORE_ASSISTIVE_ITEM_IDENTIFIERS.has(slug), true);
    assert.equal(isAssistiveItem(raw("Unrelated Display Name", { slug })), true, slug);
  }
  assert.equal(isAssistiveItem(raw("Chair of Inventions")), true, "name fallback should work when an index has no slug");
});

test("assistive item detection stays narrow for ordinary equipment", () => {
  assert.equal(isAssistiveItem(raw("Armory Bracelet", { slug: "armory-bracelet", traits: ["magical"] })), false);
  assert.equal(isAssistiveItem({
    ...raw("Ordinary Boots", { slug: "ordinary-boots" }),
    system: {
      ...raw("Ordinary Boots").system,
      slug: "ordinary-boots",
      description: { value: "These boots can be used beside a wheelchair." }
    }
  }), false);
});
