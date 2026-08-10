import test from "node:test";
import assert from "node:assert/strict";
import { MagicItemTemplateResolver } from "../../src/engine/magic-item-template-resolver.js";

test("MagicItemTemplateResolver keeps implementation templates separate from selected content sources", () => {
  const entries = [
    { id: "addon-staff", type: "weapon", level: 0, slug: "staff", pack: "addon.items", packageType: "module", packageName: "addon", categories: ["weapon"] },
    { id: "system-staff", type: "weapon", level: 0, slug: "staff", pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["weapon"] },
    { id: "addon-heart", pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.spellheart"] },
    { id: "system-heart", pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.spellheart"] },
    { id: "addon-cloak", type: "equipment", level: 2, pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.worn", "magic.worn.cloak"] },
    { id: "system-cloak-backpack", type: "backpack", level: 1, pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.worn", "magic.worn.cloak"] },
    { id: "system-cloak", type: "equipment", level: 5, pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.worn", "magic.worn.cloak"] },
    { id: "addon-held-one", type: "equipment", level: 1, pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.held", "magic.held.one-hand"] },
    { id: "system-held-one", type: "equipment", level: 4, pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.held", "magic.held.one-hand"] },
    { id: "addon-held-two", type: "equipment", level: 1, pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.held", "magic.held.two-hands"] },
    { id: "addon-grimoire", type: "book", level: 4, pack: "addon.items", packageType: "module", packageName: "addon", categories: ["magic.grimoire"] },
    { id: "system-grimoire", type: "book", level: 6, pack: "pf2e.equipment", packageType: "system", packageName: "pf2e", categories: ["magic.grimoire"] }
  ];
  const resolver = new MagicItemTemplateResolver({ compendiumIndex: { entries } });
  assert.equal(resolver.resolveStaffBaseEntry().id, "system-staff");
  assert.equal(resolver.resolveSpellheartTemplateEntry().id, "system-heart");
  assert.equal(resolver.resolveWornTemplateEntry("cloak").id, "system-cloak", "default worn templates must use the safe equipment document type");
  assert.equal(resolver.resolveWornTemplateEntry("cloak", { allowedTypes: ["backpack"] }).id, "system-cloak-backpack");
  assert.equal(resolver.resolveHeldTemplateEntry(1).id, "system-held-one", "held implementation templates are system-only");
  assert.equal(resolver.resolveHeldTemplateEntry(2), null, "held templates do not silently fall back to module content");
  assert.equal(resolver.resolveHeldTemplateEntry(2, { sourcePolicy: "prefer-system" }).id, "addon-held-two", "an explicit non-core policy may opt into fallback behavior");
  assert.equal(resolver.resolveGrimoireTemplateEntry().id, "system-grimoire", "generated grimoires use system-only implementation templates");
  assert.equal(resolver.resolveGrimoireTemplateEntry({ allowedTypes: ["equipment"] }), null);
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
