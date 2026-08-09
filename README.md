# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.5 scope

This release completes the first property-rune block for composed weapons and armor while keeping property-rune content registry-driven and reusable through the public API.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Reusable `ItemForgeEngine`
- Registry-based hierarchical item categories
- Configurable compendium source selection and compendium item index
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded random generation
- Existing-item generator using indexed compendium items
- Composed equipment mode for mundane base weapons, armor, and shields
- Canonical Remaster fundamental-rune progressions for weapons and armor
- Reinforcing-rune progression for shields
- Registry-driven property runes for weapons and armor
- Property-rune modes: automatic, random, fixed selection, or none
- Compatibility filtering for melee/ranged use, damage type, weapon group, traits, and armor category
- Property-rune slot limits derived from the potency rune; shields never receive property runes
- `ItemLevelResolver`: final composed-item level includes base, fundamental-rune, and property-rune levels
- Final rarity can rise to the highest rarity contributed by a selected property rune
- Property runes can bridge item levels not represented by the fundamental-rune progression alone
- Extensible `game.pf2eItemForge.propertyRunes` registry for later add-ons
- Embedded `ItemForgeEditor` with property-rune controls and rune preview
- Standalone `ItemForgeApplication` container
- Item Directory button, preview, reroll, and world-item creation
- German and English localization
- Extensible treasure content registries
- Generic bounded ValueSolver
- Automated Node.js unit/integration tests

The built-in property-rune catalog is deliberately a conservative starter set. More runes can be added through the registry without changing the generator.

Not yet implemented:

- Precious-material composition
- Generated treasure objects and valuation content
- Presets
- Actor/folder output targets
- Full catalog coverage for every property rune from every optional PF2e source

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

Compose a weapon with automatically selected property runes:

```js
await game.pf2eItemForge.generate({
  mode: "equipment",
  category: "weapon.melee",
  level: { min: 7, max: 9 },
  levelPolicy: "strict",
  source: { mode: "system" },
  equipment: {
    fundamentalRunes: "automatic",
    propertyRunes: {
      mode: "automatic"
    }
  }
});
```

Compose a weapon with a fixed property rune:

```js
await game.pf2eItemForge.generate({
  mode: "equipment",
  category: "weapon.melee",
  level: 8,
  levelPolicy: "strict",
  source: { mode: "system" },
  equipment: {
    fundamentalRunes: "automatic",
    propertyRunes: {
      mode: "fixed",
      selected: ["flaming"]
    }
  }
});
```

Register an additional property rune from an extension module:

```js
Hooks.once("pf2eItemForgeReady", (api) => {
  api.propertyRunes.register({
    id: "my-addon.example-rune",
    slug: "example-rune",
    label: "My Add-on: Example Rune",
    itemType: "weapon",
    level: 9,
    rarity: "uncommon",
    compatibility: {
      melee: true
    }
  });
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
