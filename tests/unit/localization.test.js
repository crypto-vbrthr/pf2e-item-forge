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
  "PF2E_ITEM_FORGE.Fields.PropertyRunes",
  "PF2E_ITEM_FORGE.Fields.FixedPropertyRunes",
  "PF2E_ITEM_FORGE.LevelMode.Single",
  "PF2E_ITEM_FORGE.LevelMode.Range",
  "PF2E_ITEM_FORGE.LevelPolicy.Strict",
  "PF2E_ITEM_FORGE.SourceMode.All",
  "PF2E_ITEM_FORGE.Rarity.Common",
  "PF2E_ITEM_FORGE.GenerationMode.Existing",
  "PF2E_ITEM_FORGE.GenerationMode.Equipment",
  "PF2E_ITEM_FORGE.GenerationMode.Treasure",
  "PF2E_ITEM_FORGE.GenerationMode.Magic",
  "PF2E_ITEM_FORGE.Fields.MagicTheme",
  "PF2E_ITEM_FORGE.Fields.AllowHeightenedSpells",
  "PF2E_ITEM_FORGE.Hints.MagicMode",
  "PF2E_ITEM_FORGE.Hints.MagicSources",
  "PF2E_ITEM_FORGE.Hints.MagicTheme",
  "PF2E_ITEM_FORGE.Hints.AllowHeightenedSpells",
  "PF2E_ITEM_FORGE.Preview.MagicKind",
  "PF2E_ITEM_FORGE.Preview.MagicTheme",
  "PF2E_ITEM_FORGE.Preview.HighestSpellRank",
  "PF2E_ITEM_FORGE.Preview.SpellList",
  "PF2E_ITEM_FORGE.Magic.SettingsHeading",
  "PF2E_ITEM_FORGE.Magic.StaffName",
  "PF2E_ITEM_FORGE.Magic.Cantrip",
  "PF2E_ITEM_FORGE.Magic.SpellRankLabel",
  "PF2E_ITEM_FORGE.Errors.UnsupportedMagicCategory",
  "PF2E_ITEM_FORGE.Errors.NoWandSpellCandidate",
  "PF2E_ITEM_FORGE.Errors.NoStaffSpellCandidate",
  "PF2E_ITEM_FORGE.Errors.NoStaffBaseItem",
  "PF2E_ITEM_FORGE.MagicThemes.Automatic",
  "PF2E_ITEM_FORGE.MagicThemes.Fire",
  "PF2E_ITEM_FORGE.MagicThemes.Primal",
  "PF2E_ITEM_FORGE.Fields.ValueMode",
  "PF2E_ITEM_FORGE.Fields.ValueTarget",
  "PF2E_ITEM_FORGE.Fields.Material",
  "PF2E_ITEM_FORGE.Fields.Craftsmanship",
  "PF2E_ITEM_FORGE.Fields.Condition",
  "PF2E_ITEM_FORGE.Fields.Motif",
  "PF2E_ITEM_FORGE.Fields.Style",
  "PF2E_ITEM_FORGE.Fields.TreasureType",
  "PF2E_ITEM_FORGE.Hints.TreasureType",
  "PF2E_ITEM_FORGE.Treasure.Any",
  "PF2E_ITEM_FORGE.Treasure.ValueHeading",
  "PF2E_ITEM_FORGE.Preview.Value",
  "PF2E_ITEM_FORGE.Preview.TreasureType",
  "PF2E_ITEM_FORGE.Errors.NoTreasureCandidate",
  "PF2E_ITEM_FORGE.Errors.UnknownTreasureContent",
  "PF2E_ITEM_FORGE.FundamentalRunes.Automatic",
  "PF2E_ITEM_FORGE.PropertyRuneMode.Automatic",
  "PF2E_ITEM_FORGE.PropertyRuneMode.Random",
  "PF2E_ITEM_FORGE.PropertyRuneMode.Fixed",
  "PF2E_ITEM_FORGE.PropertyRuneMode.None",
  "PF2E_ITEM_FORGE.Preview.Empty",
  "PF2E_ITEM_FORGE.Preview.BaseItem",
  "PF2E_ITEM_FORGE.Preview.RuneProfile",
  "PF2E_ITEM_FORGE.Preview.PropertySlots",
  "PF2E_ITEM_FORGE.Preview.Potency",
  "PF2E_ITEM_FORGE.Preview.Striking",
  "PF2E_ITEM_FORGE.Preview.Resilient",
  "PF2E_ITEM_FORGE.Preview.Reinforcing",
  "PF2E_ITEM_FORGE.Preview.PropertyRunes",
  "PF2E_ITEM_FORGE.Preview.Spell",
  "PF2E_ITEM_FORGE.Preview.SpellRank",
  "PF2E_ITEM_FORGE.Preview.HeightenedFrom",
  "PF2E_ITEM_FORGE.Preview.Description",
  "PF2E_ITEM_FORGE.Errors.NoScrollSpellCandidate",
  "PF2E_ITEM_FORGE.Errors.SpellDocumentNotFound",
  "PF2E_ITEM_FORGE.Sources.Items",
  "PF2E_ITEM_FORGE.Sources.Spells",
  "PF2E_ITEM_FORGE.Hints.ScrollSources",
  "PF2E_ITEM_FORGE.Errors.InvalidPropertyRuneSelection",
  "PF2E_ITEM_FORGE.PropertyRunes.Flaming",
  "PF2E_ITEM_FORGE.PropertyRunes.Shadow",
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
