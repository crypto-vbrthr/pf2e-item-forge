# PF2E Item Forge

Early implementation of the reusable Item Forge architecture for Foundry VTT and Pathfinder 2e.

## v0.0.3 scope

This first implementation deliberately builds the foundation before rune composition and generated treasures are added.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Reusable `ItemForgeEngine`
- Registry-based hierarchical item categories
- Configurable compendium source selection
- Compendium item index
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded random generation
- Existing-item generator using indexed compendium items
- Embedded `ItemForgeEditor` built as an ApplicationV2 child
- Standalone `ItemForgeApplication` container
- Item Directory button
- Preview, reroll, and creation of the previewed world Item
- German and English localization
- Extensible treasure content registries (types, materials, components, motifs, conditions, styles)
- Generic ValueSolver with configurable max attempts and absolute safety cap
- Node.js built-in unit/integration test suite

Not yet implemented:

- Rune-composed weapon/armor/shield generation
- Treasure object generation and valuation content
- Presets
- Actor/folder output targets
- Advanced category-specific editor fields

## API examples

```js
await game.pf2eItemForge.generate({
  mode: "existing",
  category: "weapon.melee",
  level: { min: 5, max: 7 },
  levelPolicy: "strict",
  source: { mode: "system" }
});
```

```js
game.pf2eItemForge.treasure.materials.register({
  id: "my-addon.porcelain",
  tags: ["ceramic", "decorative"],
  valueFactor: 1.35
});
```

The module emits `pf2eItemForgeReady(api)` after initialization so optional extensions can register content without hard dependencies.

## Development

```bash
npm test
```
