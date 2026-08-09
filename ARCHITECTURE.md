# Architecture

```text
ItemForgeApplication (workflow container)
        |
        v
ItemForgeEditor (embedded ApplicationV2 child, request + preview)
        |
        v
ItemForgeEngine (business logic)
        |
        +-- CategoryRegistry
        +-- CompendiumIndex
        |     +-- physical item index
        |     +-- spell index (support data for spell consumables)
        |
        +-- GeneratorRegistry
        |     +-- ScrollGenerator
        |     +-- ExistingItemGenerator
        |     +-- EquipmentGenerator
        |     +-- TreasureGenerator [planned]
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
              +-- styles
```

## Boundaries

- The engine creates one item result per request.
- The editor edits one request and previews one result.
- The application container owns persistence/workflow actions.
- Other modules should use the public engine API, not the standalone GUI.
- Future Loot Forge integration should distribute budgets and issue individual Item Forge requests.
- Built-in and external treasure content use the same registries.
- Spell documents are support data, not directly generatable physical items. The `ScrollGenerator` may select an eligible spell and embed it into a physical scroll result.

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

The generic scroll templates are infrastructure and are suppressed from ordinary predefined-item selection so an empty scroll cannot leak into broad `item` or `consumable` generation.
