# Architecture

```text
ItemForgeApplication (workflow container / persistence)
        |
        v
ItemForgeEditor (embedded ApplicationV2 child / request + preview)
        |
        v
ItemForgeEngine (canonical normalization, validation, generation)
        |
        +-- CategoryRegistry
        +-- CompendiumIndex
        |     +-- physical item index
        |     +-- spell index (support data for spell consumables)
        |
        +-- GeneratorRegistry (priority + declared generation modes)
        |     +-- WandGenerator
        |     +-- StaffGenerator
        |     +-- SpellheartGenerator
        |     +-- TreasureGenerator
        |     +-- ScrollGenerator
        |     +-- EquipmentGenerator
        |     +-- ExistingItemGenerator
        |     +-- extension generators
        |
        +-- shared spell-item utilities / magic themes
        +-- ItemLevelResolver
        +-- PropertyRuneRegistry
        +-- StaffProfileRegistry
        +-- ValueSolver
        +-- TreasureRegistry
              +-- types
              +-- materials
              +-- components
              +-- motifs
              +-- conditions
              +-- craftsmanship
              +-- styles
```

## Boundaries

- The engine creates exactly one item result per request.
- `normalize()`, `validate()`, `generate()`, and the embedded editor use the same canonical request hydration path.
- The editor edits one request and previews one result. It does not create Foundry documents.
- The application container owns persistence/workflow actions such as `Item.create()`.
- Other modules should use the public engine API and may embed `ItemForgeEditor` without the standalone Item Forge window.
- Future Loot Forge integration should distribute budgets/counts/themes and issue individual Item Forge requests.
- Built-in and external treasure content use the same validated registries.
- Spell documents are support data, not directly generatable physical items. `ScrollGenerator` and `WandGenerator` may select eligible spells and embed them into physical item results; `StaffGenerator` either copies a predefined PF2e staff unchanged or uses the spell index to build a structured staff-family manifest. `SpellheartGenerator` deliberately copies complete predefined spellheart items because each published spellheart has bespoke armor/weapon benefits and activation rules.

## Generator resolution

Generators are registered with a declared generation mode and priority. Resolution is deterministic: the highest-priority generator whose `supports(request)` returns true wins. This lets specialist and extension generators override broad core strategies without depending on registration order.

Core priorities:

```text
WandGenerator         220  mode magic
SpellheartGenerator   215  mode magic
StaffGenerator        210  mode magic
TreasureGenerator     200  mode treasure
ScrollGenerator       200  mode existing
EquipmentGenerator    150  mode equipment
ExistingItemGenerator   0  mode existing
```

Registered generation modes are exposed through the public capabilities API and are validated dynamically rather than being hard-coded in the request normalizer.


## Spell-bound permanent magic items

`mode: "magic"` currently owns `magic.wand`, `magic.staff`, and `magic.spellheart`. Wands and generated staves reuse the spell-support index and meaningful-heightening helpers. Spellhearts are handled as complete predefined items because their attachment benefits and activations are item-specific rather than a generic spell-container schema.

### Wands

`WandGenerator` selects one eligible non-cantrip, non-focus, non-ritual spell from the configured spell sources. The spell rank must correspond to a legal base rank or to heightening data actually present on the spell when `magic.allowHeightened` is enabled. The generator resolves the PF2e generic wand template for that rank, clones it, transfers rarity/traits, and embeds the selected spell into `system.spell` with the chosen `heightenedLevel`. The physical wand level and price therefore come from PF2e's own rank-specific wand templates.

### Staves

`StaffGenerator` has two explicit paths. `magic.staffMode: "existing"` selects a real staff from the configured compendia and clones its native PF2e item data unchanged, preserving its published spell list, special abilities, runes, price, and system automation.

`magic.staffMode: "generated"` creates a new thematic staff using a `StaffProfileRegistry`. Core profiles model common PF2e family progressions rather than a universal level ladder: `3 → 8 → 12`, `4 → 8 → 12`, and `6 → 10 → 14`. Each profile is a sequence of variants. The base variant introduces its own spell ranks; greater/major variants add only the ranks assigned to that tier and inherit every spell from all earlier variants. A generated level-12 staff in a `3 → 8 → 12` family therefore contains the base rank-1 list, the greater rank-2/3 additions, and the major rank-4/5 additions. It does not independently refill every rank from scratch.

Generated families use deterministic per-tier RNG streams so generating a stronger variant with the same seed preserves the exact lower-tier spell choices. A spell may reappear at a higher rank only when its indexed heightening data actually supports that rank. The shared spell utility never down-ranks a higher-rank spell merely because a lower maximum rank is requested.

Generated staff spell lists are stored as enriched `@UUID` links in the description and as a complete structured family manifest in `flags.pf2e-item-forge.staff`, including profile, selected variant, inherited tiers, and per-tier additions. Generated staves are marked as specific magic weapons. The implementation still deliberately avoids inventing an undocumented PF2e-native custom-staff spell-preparation storage schema; predefined staves use their native data, while generated family automation can later be wired to the verified live-system contract.


### Spellhearts

`SpellheartGenerator` resolves `mode: "magic"` + `category: "magic.spellheart"`. The compendium index classifies physical `equipment` items carrying the `spellheart` trait into the dedicated magic category. Generation then applies the normal source, rarity, seed, and level/level-policy constraints and clones one matching spellheart document.

The generator intentionally does **not** synthesize arbitrary new spellhearts yet. Published spellhearts can grant different benefits when affixed to armor versus a weapon and often carry bespoke activated spells and rule elements. Preserving the complete source document avoids producing attractive-looking but mechanically incomplete homebrew items. A future generated-spellheart composer should therefore be built from validated effect/activation templates rather than by mixing text fragments.

## Treasure generation

`TreasureGenerator` is implemented and data-driven. A request may choose a broad category such as `treasure.jewelry` or additionally pin one concrete registry type such as `core.type.jewelry.tiara`.

```text
Treasure request
   |
   +-- category + optional exact type
   +-- value target/range + bounded ValueSolver
   +-- material / condition / craftsmanship / motif / style
   |
   v
style-aware candidate construction
   |
   +-- type
   +-- material
   +-- condition
   +-- craftsmanship
   +-- motif
   +-- attributes
   +-- coherent optional components
   |
   v
valuation -> PF2e treasure Item source
```

Styles can weight material tags, motifs, craftsmanship, type tags, component chances, and condition profiles. Individual treasure types may additionally weight condition, craftsmanship, and motif choices, so books can age differently from metal jewelry and ceremonial objects can prefer different visual language from merchant luxury goods. Component craftsmanship can inherit the parent quality, stay close to it, roll independently, or be disabled. Gemstone materials may define their own `componentValue` range for inlays/settings.

Candidate construction is mildly target-aware: treasure type, material, workmanship, and optional component density are biased toward combinations that are more plausible for the requested sale value, while the bounded `ValueSolver` remains the final authority and all random choices remain seed-reproducible. Generated treasure keeps a full valuation breakdown and generation plan in `flags.pf2e-item-forge`.

Treasure types may also define a physical Bulk value. Book and beverage types use the generic attribute mechanism for details such as edition/completeness and origin/quality/vessel/age; these attributes contribute to valuation and are exposed in preview metadata.

Treasure registry definitions are validated when registered. Invalid ranges, missing component references, invalid fixed materials, malformed weights, and (when the CategoryRegistry is supplied) unknown categories fail immediately instead of surfacing during a later generation.

## Scroll generation

`ScrollGenerator` owns `mode: "existing"` + `category: "consumable.scroll"` before the general existing-item strategy resolves.

```text
Scroll request
   |
   +-- selected spell compendiums
   |      -> eligible non-cantrip/non-focus/non-ritual spells
   |
   +-- meaningful base/heightened ranks
   |      -> interval or fixed heightening definitions
   |
   +-- PF2e generic scroll template for that rank
   |      -> determines physical scroll level/price
   |
   v
physical Consumable source with embedded system.spell
```

Generic scroll templates are infrastructure and are suppressed from ordinary predefined-item selection so an empty scroll cannot leak into broad `item` or `consumable` generation.
