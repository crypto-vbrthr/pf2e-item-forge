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
        +-- WandProfileRegistry
        +-- StaffProfileRegistry
        +-- SpellheartProfileRegistry
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
- Spell documents are support data, not directly generatable physical items. `ScrollGenerator` and `WandGenerator` may select eligible spells and embed them into physical item results; `StaffGenerator` either copies a predefined PF2e staff unchanged or uses the spell index to build a structured staff-family manifest. `SpellheartGenerator` has separate predefined and generated paths. Predefined spellhearts preserve their complete native item data; generated spellhearts use validated whole-effect profiles so armor/weapon benefits, level progression, price, theme, and spell slots remain a coherent unit.

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

`mode: "magic"` currently owns `magic.wand`, `magic.staff`, and `magic.spellheart`. Wands, generated staves, and generated spellhearts reuse the spell-support index and meaningful-heightening helpers. Predefined spellhearts preserve complete native PF2e documents, while generated spellhearts compose from validated profile families rather than arbitrary effect fragments.

### Wands

`WandGenerator` selects one eligible non-cantrip, non-focus, non-ritual spell from the configured spell sources. The spell rank must correspond to a legal base rank or to heightening data actually present on the spell when `magic.allowHeightened` is enabled.

`magic.wandMode: "standard"` resolves the PF2e generic wand template for that rank, clones it, transfers rarity/traits, and embeds the selected spell into `system.spell` with the chosen `heightenedLevel`. Its physical item level and price therefore come from PF2e's rank-specific generic wand template.

`magic.wandMode: "special"` selects a validated whole modifier from `WandProfileRegistry`. Core profiles model generic special-wand families that can sensibly accept many spells: Reaching, Legerdemain, and Mercy. Each profile owns its rank-to-item-level/price progression and optional spell-shape constraints. Mercy, for example, only accepts damaging 1- or 2-action spells and excludes death, nonlethal, and void traits. The spell-support index therefore records cast-action count and whether a spell has damage data. Spell-specific published special wands are not generalized into free-form effects.

Generated special-wand effects are written as localized explicit rules text and stored in `flags.pf2e-item-forge.wand` with profile, spell, rank, price, and automation status. The structural item still comes from the PF2e generic wand template, but Item Forge deliberately does not invent unverified custom Rule Elements for the added special-wand behavior. External modules can register additional validated profiles through `game.pf2eItemForge.wandProfiles`.

### Staves

`StaffGenerator` has two explicit paths. `magic.staffMode: "existing"` selects a real staff from the configured compendia and clones its native PF2e item data unchanged, preserving its published spell list, special abilities, runes, price, and system automation.

`magic.staffMode: "generated"` creates a new thematic staff using a `StaffProfileRegistry`. Core profiles model common PF2e family progressions rather than a universal level ladder: `3 → 8 → 12`, `4 → 8 → 12`, and `6 → 10 → 14`. Each profile is a sequence of variants. The base variant introduces its own spell ranks; greater/major variants add only the ranks assigned to that tier and inherit every spell from all earlier variants. A generated level-12 staff in a `3 → 8 → 12` family therefore contains the base rank-1 list, the greater rank-2/3 additions, and the major rank-4/5 additions. It does not independently refill every rank from scratch.

Generated families use deterministic per-tier RNG streams so generating a stronger variant with the same seed preserves the exact lower-tier spell choices. A spell may reappear at a higher rank only when its indexed heightening data actually supports that rank. The shared spell utility never down-ranks a higher-rank spell merely because a lower maximum rank is requested.

Generated staff spell lists are stored as enriched `@UUID` links in the description and as a complete structured family manifest in `flags.pf2e-item-forge.staff`, including profile, selected variant, inherited tiers, and per-tier additions. Generated staves are marked as specific magic weapons. The implementation still deliberately avoids inventing an undocumented PF2e-native custom-staff spell-preparation storage schema; predefined staves use their native data, while generated family automation can later be wired to the verified live-system contract.


### Spellhearts

`SpellheartGenerator` resolves `mode: "magic"` + `category: "magic.spellheart"` and has two explicit paths. `magic.spellheartMode: "existing"` selects a published spellheart from the configured compendia and clones the complete PF2e item unchanged, preserving native armor/weapon benefits, activations, Rule Elements, price, and other system data.

`magic.spellheartMode: "generated"` composes a new homebrew spellheart from `SpellheartProfileRegistry`. A profile is a complete balance unit: it defines allowed themes, a strictly increasing family of item variants, prices, spell statistics, armor/weapon effect templates, and the daily spell ranks added at each variant. Core profiles currently cover elemental conduit, sonic resonator, void fang, and vitality/healing feather patterns. External modules can register additional validated profiles through `game.pf2eItemForge.spellheartProfiles`.

Generated spellhearts always select a themed cantrip plus the daily spells required by the chosen profile variant. Heightening is permitted only when the indexed spell actually exposes a meaningful fixed/interval heightened rank. A higher-rank spell is never down-ranked to fill a lower slot. Source-pack, rarity, seed, exact/range level, and level-policy constraints all remain part of the same canonical request.

A real indexed spellheart is used only as a structural PF2e `equipment` template. Its published description, slug, and Rule Elements are removed before the generated profile is applied, so unrelated automation can never leak into the custom result. The generated attachment benefits are rendered as explicit rules text and stored with the complete profile/spell manifest in `flags.pf2e-item-forge.spellheart`. This is deliberate: Item Forge does not invent unverified PF2e Rule Element predicates for arbitrary attachment-specific homebrew effects. Predefined spellhearts remain the path for native published automation.


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
