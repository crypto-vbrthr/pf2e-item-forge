# Changelog

## 0.0.4

- Adds a second generation mode for composing weapons, armor, and shields from mundane compendium base items.
- Adds canonical Remaster fundamental-rune profiles for weapons and armor plus reinforcing-rune profiles for shields.
- Adds `ItemLevelResolver` and strict level validation based on the highest relevant component level.
- Adds property-rune capacity calculation in preparation for the next property-rune block.
- Extends the embedded editor with generation-mode and fundamental-rune controls.
- Extends preview data with the selected base item, rune summary, effective level, and property-rune slots.
- Extends the compendium index with rune, specific-item, base-item, slug, and material metadata.
- Adds localized generator errors and new German/English UI labels.
- Expands automated coverage for rune profiles, level resolution, deterministic equipment generation, armor, weapons, and shields.

## 0.0.3

- Korrigiert die Foundry-v14-Lokalisierungsdateien auf die erwartete verschachtelte JSON-Struktur.
- Entfernt kollidierende Kategorie-Lokalisierungspfade und verwendet stabile, eindeutige Kategorie-Label-Keys.
- Lokalisiert den ApplicationV2-Fenstertitel explizit.
- Lokalisiert den Tooltip zum Aktualisieren des Kompendienindex explizit.
- Ergänzt Regressionstests für die vollständige deutsche und englische Lokalisierung.

## 0.0.2

- Fixed the Item Forge button not appearing in the Foundry v14 Item Directory.
- Item-directory detection now uses the v14 `documentName` API and supports PF2e subclasses instead of relying on the exact constructor name.
- The public API is now exposed during `init`, so an Item Directory rendered before `ready` can already receive a working button.
- Added a generic ApplicationV2 render fallback and an explicit post-ready injection for an already-rendered Item Directory.
- Fixed module-setting labels, hints, and choices showing localization IDs by resolving them when settings are registered.

## 0.0.1

- Initial module scaffold for Foundry VTT v14 / PF2e.
- Added public Item Forge API and reusable engine.
- Added hierarchical category registry and compendium index.
- Added compendium source selection and level constraints.
- Added deterministic seeded generation of existing compendium items.
- Added embedded ApplicationV2 Item Forge Editor and standalone container.
- Added preview, reroll, Item Directory integration, and world-item creation.
- Added extensible treasure registries and generic bounded ValueSolver.
- Added German/English localization and automated test suite.
