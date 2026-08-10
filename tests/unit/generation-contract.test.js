import test from "node:test";
import assert from "node:assert/strict";
import { applyGenerationContract, validateGeneratedProfileAutomation } from "../../src/engine/generation-contract.js";

test("applyGenerationContract normalizes content/template/automation metadata", () => {
  const result = applyGenerationContract({
    metadata: {
      sourcePack: "pf2e.items",
      automation: { level: "native" },
      specificItem: { mode: "existing", automation: "rules-text" }
    }
  });
  assert.deepEqual(result.metadata.contentSources, ["pf2e.items"]);
  assert.equal(result.metadata.templateSource, null);
  assert.deepEqual(result.metadata.automation, { level: "native" });
  assert.equal(result.metadata.specificItem.automation, "native");
});

test("applyGenerationContract forces generated specific items to rules-text automation", () => {
  const result = applyGenerationContract({
    metadata: {
      sourcePack: "pf2e.equipment-srd",
      automation: { level: "native" },
      specificItem: { mode: "generated", automation: "native" }
    }
  });
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.metadata.specificItem.automation, "rules-text");
});

test("custom generated profiles cannot claim native automation", () => {
  assert.equal(validateGeneratedProfileAutomation(undefined, { kind: "Test", id: "x" }), "rules-text");
  assert.throws(
    () => validateGeneratedProfileAutomation("native", { kind: "Test", id: "x" }),
    /cannot declare native automation/
  );
});

test("applyGenerationContract normalizes predefined/generated worn automation", () => {
  const existing = applyGenerationContract({ metadata: { automation: { level: "rules-text" }, wornItem: { mode: "existing", automation: "rules-text" } } });
  assert.equal(existing.metadata.automation.level, "native");
  assert.equal(existing.metadata.wornItem.automation, "native");

  const generated = applyGenerationContract({ metadata: { automation: { level: "native" }, wornItem: { mode: "generated", automation: "native" } } });
  assert.equal(generated.metadata.automation.level, "rules-text");
  assert.equal(generated.metadata.wornItem.automation, "rules-text");
});


test("applyGenerationContract always marks composed accessory runes as rules-text automation", () => {
  const result = applyGenerationContract({
    metadata: {
      automation: { level: "native" },
      accessoryRune: { family: "trackless", automation: "native" }
    }
  });
  assert.equal(result.metadata.automation.level, "rules-text");
  assert.equal(result.metadata.accessoryRune.automation, "rules-text");
});
