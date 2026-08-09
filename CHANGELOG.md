# Changelog

## 0.0.12

- Adds a new `magic` generation mode for generated spell-bound permanent magic items.
- Adds `magic.wand` generation using PF2e's rank-specific generic wand templates and a real embedded spell.
- Wand spells exclude cantrips, focus spells, and rituals, and may be heightened only to ranks supported by the spell's actual heightening data.
- Adds `magic.staff` generation using a real PF2e staff weapon base plus a thematic multi-rank spell manifest.
- Generated staves can include cantrips and may repeat a spell at higher ranks only when that spell supports the selected heightened rank.
- Adds data-driven magic themes for fire, cold, electricity, healing, illusion, mental, vitality, void, arcane, divine, occult, primal, and summoning.
- Adds `magic.theme` and `magic.allowHeightened` to the canonical request schema and embedded editor.
- Extends the source picker so spell compendiums are available for magic-item generation without making spells directly generatable items.
- Adds magic-item category hierarchy (`magic`, `magic.wand`, `magic.staff`) and public capability metadata for supported magic themes/item kinds.
- Extends previews with contained spell, staff spell list, spell ranks, heightening information, theme, and highest staff spell rank.
- Stores generated staff spell manifests in `flags.pf2e-item-forge.staff` and renders enriched spell links into the description for immediate inspection/use.
- Keeps custom staff spell storage deliberately Item-Forge-owned until the PF2e live-system contract for native custom-staff preparation/casting automation is verified.
- Adds integration/regression coverage for wand embedding, legal heightening, magic themes, staff profiles, staff spell-list generation, deterministic seeds, unsupported levels, base-template failures, category classification, request hydration, and localization.
- Automated suite now contains 92 passing tests.

## 0.0.11

- Fixed treasure-type labels for books: the selector now shows concrete types such as Chronik, Atlas, Bestiarium, Kochbuch, and Manuskript instead of repeated "Buch" entries.
- Fixed beverage treasure-type labels: Wein, Bier, Met, Spirituose, and Obstwein are now shown explicitly instead of repeated "alkoholisches Getränk" entries.
- Embedded editor re-renders now preserve parameter/preview scroll positions, expanded details sections, and focus where possible. Selecting a treasure type no longer jumps the parameter panel back to the top.
- Added regression coverage for distinct core book/beverage labels and scroll-preserving dependent-field re-renders.

## 0.0.10

- Deepens the TreasureGenerator content library and valuation behavior while keeping one treasure per engine request.
- Expands the built-in library to 82 treasure types, 45 materials, 17 reusable components, 18 motifs, 16 conditions, 6 craftsmanship levels, and 12 styles.
- Adds new art objects, textiles, jewelry, tableware, ceremonial objects, luxury goods, book subjects, cider, and additional beverage variants.
- Adds additional precious/decorative materials including electrum, rosewood, vellum, mother-of-pearl, amber, turquoise, moonstone, topaz, aquamarine, and diamond.
- Adds material-aware conditions including patina, fading, smoke/water staining, cracking, worm damage, and restoration.
- Adds more reusable treasure components such as inlay, filigree, enamel, lacquer, embroidery, book clasps, inscriptions, signatures, and maker marks.
- Adds type-specific condition/craftsmanship/motif weighting and style-level condition weighting for more coherent treasure families.
- Makes candidate construction mildly target-aware so value solving preferentially explores treasure types/materials/workmanship and component density appropriate to the requested value while retaining bounded random generation.
- Expands book generation with edition and completeness, and beverage generation with origin, quality, vessel, age, and broader variety.
- Adds type-specific Bulk for large art objects and other treasure instead of treating every generated treasure as light Bulk.
- Adds reproducible Item Forge flags and a full valuation breakdown to generated treasure Item sources.
- Preview now surfaces generated treasure detail attributes such as edition, completeness, vessel, age, quality, and origin.
- Improves German treasure-name/description grammar and singular gemstone-setting text.
- Extends registration validation for treasure type weight maps and Bulk.
- Automated suite now contains 78 passing tests, including new depth, condition compatibility, metadata, weighting, and Bulk regressions.

## 0.0.9

- Hardens the public request contract: `normalize()`, `validate()`, `generate()`, and the embedded editor now share one canonical hydration/default path.
- Fixes `ItemForgeEditor.setRequest()` so partial requests from embedding modules receive all required defaults instead of depending on the standalone Item Forge container.
- Adds priority-based `GeneratorRegistry` resolution and dynamically registered generation modes, allowing specialist/extension generators to override broad core generators without registration-order tricks.
- Adds priority metadata as the additive `generatorMetadata` field in `getCapabilities()` while preserving the existing `generators` ID list.
- Adds optional exact treasure-type selection beneath broad treasure categories (for example a specific ring, tiara, book type, or art object).
- Adds registration-time validation for treasure types, materials, components, conditions, craftsmanship, motifs, and styles; invalid ranges and missing references now fail early.
- Adds optional category validation for treasure types when the Item Forge CategoryRegistry is available.
- Makes treasure styles influence generation weights for materials, motifs, craftsmanship, type tags, and component frequency rather than acting only as a price label.
- Makes component workmanship coherent with the parent object through `inherit`, `near-parent`, `independent`, and `none` craftsmanship modes.
- Uses gemstone material `componentValue` ranges for gemstone settings/inlays instead of leaving that data unused.
- Fixes the known German tapestry-name grammar regression.
- Adds API, engine-contract, GeneratorRegistry, embedded-editor, application-container, registry-validation, exact-treasure-type, style-weighting, component-coherence, and gemstone-valuation regression tests.
- Automated suite now contains 70 passing tests.

## 0.0.8

- Adds the first full `TreasureGenerator` implementation for non-functional sale treasure.
- Generates one treasure item per engine request with target value/range, material, craftsmanship, condition, motif, style, and bounded ValueSolver attempts.
- Adds 45 built-in treasure types including jewelry, paintings, sculpture, tableware, ceremonial/luxury goods, books, gemstones, and alcoholic beverages in bottles/jugs/amphorae/small casks.
- Adds registry-driven materials, components, motifs, conditions, craftsmanship levels, and styles.
- Material, craftsmanship, condition, attributes, and optional components affect sale value.
- Adds generated descriptions, PF2e `treasure` Item sources, detailed preview metadata, and statistical variety tests.

## 0.0.7

- Adds a dedicated `ScrollGenerator` for `consumable.scroll` requests.
- Scrolls now contain an actual spell instead of returning an empty generic scroll template.
- Excludes cantrips, focus spells, and rituals from normal scroll generation.
- Selects the scroll rank through the PF2e scroll templates so the generated scroll's item level and spell rank remain aligned.
- Supports meaningful spell heightening: interval-heightened spells may use their valid interval ranks, fixed-heightened spells may use their defined ranks, and spells without heightening data remain at their base rank.
- Embeds the selected spell into `system.spell` with the chosen heightened rank, matching the current PF2e spell-consumable data model.
- Uses the contained spell's rarity and adds the spell reference to the generated scroll description.
- Generic scroll templates are no longer eligible for broad predefined-item generation unless a spell has first been attached by the dedicated generator.
- Spell-only Item compendiums are offered in the source picker when the Scroll category is selected, while remaining hidden for ordinary item generation.
- The preview panel now displays the item's enriched description text for all generated items.
- Scroll previews additionally show contained spell, spell rank, and whether it was heightened.
- Adds German and English localization for scroll generation, spell source counts, and description preview.
- Adds regression/integration tests for scroll embedding, legal heightening ranks, excluded spell types, determinism, and generic-scroll suppression.
- Automated suite now contains 40 passing tests.

## 0.0.6

- Fixes generic Item Forge generation incorrectly treating every Foundry `Item` document as a supported physical item.
- Feats, spells, actions, effects, conditions, class/ancestry/background documents, NPC melee actions, and other non-item rule documents are now excluded from the generation index.
- Adds an explicit allowlist for supported physical PF2e item document types.
- Maps PF2e backpacks, books, and kits into the general equipment category so they remain available as ordinary predefined items.
- Compendium source selection now hides Item compendiums that contain no supported physical items, reducing noise from spell- and feat-only packs.
- Adds regression tests proving that feats and spells cannot be selected even through the broad `item` category.

## 0.0.5

- Adds property-rune generation for composed weapons and armor.
- Adds automatic, random, fixed-selection, and disabled property-rune modes.
- Enforces property-rune slot limits from the potency rune; shields remain property-rune-free.
- Adds compatibility filtering for melee/ranged weapons, weapon groups, damage types, traits, and armor categories.
- Includes property-rune levels in effective item-level resolution so strict level requests remain hard constraints.
- Adds an extensible public property-rune registry at `game.pf2eItemForge.propertyRunes`.
- Extends the compendium index with weapon/armor metadata needed for rune compatibility.
- Extends the embedded editor and preview with property-rune controls, fixed rune selection, capacity, levels, and rarity.
- Adds German and English localization for the new property-rune UI and validation errors.
- Adds regression coverage for incompatible fixed runes, level bridging, deterministic random rune selection, armor restrictions, and external rune registration.
- Automated suite now contains 33 passing tests.

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
