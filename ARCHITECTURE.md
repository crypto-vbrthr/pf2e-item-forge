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
        |     +-- TreasureGenerator
        |     +-- ScrollGenerator
        |     +-- ExistingItemGenerator
        |     +-- EquipmentGenerator
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
- The editor edits one request and previews one result.
- The application container owns persistence/workflow actions.
- Other modules should use the public engine API, not the standalone GUI.
- A future Loot Forge should own total budget, quantity, and overall theme, then issue individual Item Forge requests.
- Built-in and external treasure content use the same registries.
- Spell documents are support data, not directly generatable physical items.

## Treasure generation

`TreasureGenerator` handles `mode: "treasure"`. Generated treasure is deliberately nonmagical and intended primarily for sale/flavor.

```text
Treasure request
   |
   +-- category -> matching TreasureType definitions
   +-- optional material / condition / craftsmanship / motif / style constraints
   +-- target value or value range
   |
   v
ValueSolver (bounded attempts)
   |
   +-- seeded candidate composition
   |     +-- base archetype value
   |     +-- material factor
   |     +-- craftsmanship factor (where applicable)
   |     +-- condition factor
   |     +-- style factor
   |     +-- data-defined attributes
   |     +-- reusable components
   |
   +-- closest valid candidate if no in-range result exists
   v
PF2e Treasure item source + generation plan
```

Treasure archetypes are data-driven. The generator does not require a code branch for each painting, ring, book, wine, or future custom type. A type definition declares its categories, allowed material tags, optional components/attributes, valuation data, and name/description templates.

### Extension rule

If a new treasure idea can be expressed as data, it should be added through the registries rather than generator code. Special generator strategies should be reserved for genuinely unusual behavior.

### ValueSolver

- Per-request `solver.maxAttempts`
- Global default from module settings
- Absolute safety cap of 1000
- Returns the first result inside the requested tolerance/range
- Otherwise returns the closest valid candidate with `VALUE_TARGET_APPROXIMATED`
- Never loops indefinitely
