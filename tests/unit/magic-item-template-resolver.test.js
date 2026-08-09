import test from "node:test";
import assert from "node:assert/strict";
import { MagicItemTemplateResolver } from "../../src/engine/magic-item-template-resolver.js";

test("MagicItemTemplateResolver keeps implementation templates separate from selected content sources", () => {
  const entries = [
    { id: "addon-staff", type: "weapon", level: 0, slug: "staff", pack: "addon.items", packageType: "module", packageName: "addon", categories: ["weapon"] },
    { id: "system-staff", type: "weapon", level: 0, slug: "staff", pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["weapon"] },
    { id: "addon-heart", pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.spellheart"] },
    { id: "system-heart", pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.spellheart"] }
  ];
  const resolver = new MagicItemTemplateResolver({ compendiumIndex: { entries } });
  assert.equal(resolver.resolveStaffBaseEntry().id, "system-staff");
  assert.equal(resolver.resolveSpellheartTemplateEntry().id, "system-heart");
  assert.equal(resolver.templateMetadata(resolver.resolveStaffBaseEntry(), { kind: "staff-base" }).source, "implementation-template");
});

test("MagicItemTemplateResolver resolves configured scroll and wand templates through UUIDs", async () => {
  const resolver = new MagicItemTemplateResolver({
    compendiumIndex: { entries: [] },
    configProvider: () => ({ PF2E: { spellcastingItems: {
      scroll: { compendiumUuids: { 2: "Compendium.pf2e.scroll2" } },
      wand: { compendiumUuids: { 2: "Compendium.pf2e.wand2" } }
    } } }),
    uuidResolver: async (uuid) => ({ type: "consumable", toObject: () => ({ name: uuid, type: "consumable", system: {} }) })
  });
  assert.equal((await resolver.resolveScrollTemplate(2)).uuid, "Compendium.pf2e.scroll2");
  assert.equal((await resolver.resolveWandTemplate(2)).uuid, "Compendium.pf2e.wand2");
});
