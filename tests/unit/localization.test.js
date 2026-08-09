import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_CATEGORY_LABEL_KEYS } from "../../src/engine/category-registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getProperty(object, key) {
  return key.split(".").reduce((value, part) => value?.[part], object);
}

const REQUIRED_KEYS = [
  "PF2E_ITEM_FORGE.App.Title",
  "PF2E_ITEM_FORGE.App.Heading",
  "PF2E_ITEM_FORGE.App.Subtitle",
  "PF2E_ITEM_FORGE.Button.Open",
  "PF2E_ITEM_FORGE.Actions.Generate",
  "PF2E_ITEM_FORGE.Actions.Reroll",
  "PF2E_ITEM_FORGE.Actions.CreateItem",
  "PF2E_ITEM_FORGE.Actions.RefreshSources",
  "PF2E_ITEM_FORGE.Editor.Parameters",
  "PF2E_ITEM_FORGE.Editor.Preview",
  "PF2E_ITEM_FORGE.Fields.Category",
  "PF2E_ITEM_FORGE.Fields.LevelMode",
  "PF2E_ITEM_FORGE.Fields.Level",
  "PF2E_ITEM_FORGE.Fields.LevelPolicy",
  "PF2E_ITEM_FORGE.Fields.Rarity",
  "PF2E_ITEM_FORGE.Fields.Sources",
  "PF2E_ITEM_FORGE.Fields.GenerationMode",
  "PF2E_ITEM_FORGE.Fields.FundamentalRunes",
  "PF2E_ITEM_FORGE.LevelMode.Single",
  "PF2E_ITEM_FORGE.LevelMode.Range",
  "PF2E_ITEM_FORGE.LevelPolicy.Strict",
  "PF2E_ITEM_FORGE.SourceMode.All",
  "PF2E_ITEM_FORGE.Rarity.Common",
  "PF2E_ITEM_FORGE.GenerationMode.Existing",
  "PF2E_ITEM_FORGE.GenerationMode.Equipment",
  "PF2E_ITEM_FORGE.FundamentalRunes.Automatic",
  "PF2E_ITEM_FORGE.Preview.Empty",
  "PF2E_ITEM_FORGE.Preview.BaseItem",
  "PF2E_ITEM_FORGE.Preview.RuneProfile",
  "PF2E_ITEM_FORGE.Preview.PropertySlots",
  "PF2E_ITEM_FORGE.Preview.Potency",
  "PF2E_ITEM_FORGE.Preview.Striking",
  "PF2E_ITEM_FORGE.Preview.Resilient",
  "PF2E_ITEM_FORGE.Preview.Reinforcing",
  "PF2E_ITEM_FORGE.Errors.NoBaseEquipment",
  "PF2E_ITEM_FORGE.Errors.NoItemInLevelRange",
  "PF2E_ITEM_FORGE.Settings.DefaultSolverAttempts.Name",
  "PF2E_ITEM_FORGE.Settings.DefaultSourceMode.Name",
  ...Object.values(CORE_CATEGORY_LABEL_KEYS)
];

for (const language of ["de", "en"]) {
  test(`${language} localization resolves every UI key`, () => {
    const data = JSON.parse(fs.readFileSync(path.join(root, `lang/${language}.json`), "utf8"));
    for (const key of REQUIRED_KEYS) {
      const value = getProperty(data, key);
      assert.equal(typeof value, "string", `${language}: missing ${key}`);
      assert.ok(value.length > 0, `${language}: empty ${key}`);
      assert.notEqual(value, key, `${language}: unresolved ${key}`);
    }
  });
}
