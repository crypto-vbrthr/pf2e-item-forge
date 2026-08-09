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
        |     +-- TreasureGenerator
        |     +-- ScrollGenerator
        |     +-- EquipmentGenerator
        |     +-- ExistingItemGenerator
        |     +-- extension generators
        |
        +-- ItemLevelResolver
        +-- PropertyRuneRegistry
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
- Spell documents are support data, not directly generatable physical items. `ScrollGenerator` may select an eligible spell and embed it into a physical scroll result.

## Generator resolution

Generators are registered with a declared generation mode and priority. Resolution is deterministic: the highest-priority generator whose `supports(request)` returns true wins. This lets specialist and extension generators override broad core strategies without depending on registration order.

Core priorities:

```text
TreasureGenerator     200  mode treasure
ScrollGenerator       200  mode existing
EquipmentGenerator    150  mode equipment
ExistingItemGenerator   0  mode existing
```

Registered generation modes are exposed through the public capabilities API and are validated dynamically rather than being hard-coded in the request normalizer.

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
