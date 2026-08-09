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
        +-- GeneratorRegistry
        |     +-- ExistingItemGenerator [v0.0.1]
        |     +-- WeaponGenerator        [planned]
        |     +-- ArmorGenerator         [planned]
        |     +-- ShieldGenerator        [planned]
        |     +-- TreasureGenerator      [planned]
        |
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
