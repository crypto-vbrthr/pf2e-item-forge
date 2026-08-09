# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.4 scope

This release adds the first composed-equipment generator while keeping the public API and embedded-editor architecture introduced in the earlier foundation releases.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Reusable `ItemForgeEngine`
- Registry-based hierarchical item categories
- Configurable compendium source selection and compendium item index
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded random generation
- Existing-item generator using indexed compendium items
- New composed equipment mode for mundane base weapons, armor, and shields
- Canonical Remaster fundamental-rune progressions for weapons and armor
- Reinforcing-rune progression for shields
- `ItemLevelResolver`: final composed-item level is derived from the highest relevant component level
- Property-rune capacity is calculated now so the later property-rune block can plug into the same plan/validator
- Embedded `ItemForgeEditor` with generation-mode selection and rune preview
- Standalone `ItemForgeApplication` container
- Item Directory button, preview, reroll, and world-item creation
- German and English localization
- Extensible treasure content registries
- Generic bounded ValueSolver
- Automated Node.js unit/integration tests

Not yet implemented:

- Property-rune selection and compatibility filtering
- Precious-material composition
- Generated treasure objects and valuation content
- Presets
- Actor/folder output targets

## API examples

Select a predefined item:

```js
await game.pf2eItemForge.generate({
  mode: "existing",
  category: "weapon.melee",
  level: { min: 5, max: 7 },
  levelPolicy: "strict",
  source: { mode: "system" }
});
```

Compose a weapon from a mundane base item and fundamental runes:

```js
await game.pf2eItemForge.generate({
  mode: "equipment",
  category: "weapon.melee",
  level: 4,
  levelPolicy: "strict",
  source: { mode: "system" },
  equipment: { fundamentalRunes: "automatic" }
});
```

Register treasure content for later treasure generation:

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
