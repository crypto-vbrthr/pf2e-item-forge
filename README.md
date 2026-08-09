# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.8 scope

This release adds the first full generated-treasure pipeline on top of the existing predefined-item, scroll, and composed-equipment generators.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Reusable `ItemForgeEngine`
- Embedded `ItemForgeEditor` plus standalone workflow container
- Hierarchical item categories and compendium source selection
- Exact level / level-range handling for regular items
- Existing-item generation, spell-bearing scrolls, and rune-composed weapons/armor/shields
- Deterministic seeded random generation
- `mode: "treasure"` for one generated nonmagical sale object per request
- Target value or value range for generated treasure
- Bounded `ValueSolver` with configurable `maxAttempts` and closest-valid fallback warning
- Material, craftsmanship, condition, motif, and style controls
- Material, craftsmanship, condition, style, attributes, and components all contribute to valuation
- Generated PF2e `treasure` item sources with valid physical-item fields and coin-denominated price data
- Initial treasure library:
  - 45 treasure archetypes
  - 29 materials
  - 8 reusable components
  - 9 motifs
  - 9 conditions
  - 6 craftsmanship grades
  - 8 styles
- Treasure families include gemstones, paintings, portraits, sculpture, textile art, jewelry, tableware, ceremonial objects, luxury goods, books/manuscripts, wine, beer, mead, and spirits
- Bottles, amphorae, small casks, bindings, frames, pedestals, gemstone settings, gilding, engraving, illustrations, and wax seals are represented through reusable data-driven components/attributes
- Registry-driven extension API: new treasure types, materials, components, motifs, conditions, craftsmanship grades, and styles can be registered without generator changes
- Dynamic treasure UI hides controls that are not meaningful for the selected category and filters material choices to those usable by the category
- Treasure preview displays value, type, material, craftsmanship, condition, style, motif, components, and description
- Generated item flags retain the complete generation plan for later diagnostics/reproduction
- German and English localization
- Automated unit, integration, regression, extension, and statistical generation tests

Not yet implemented:

- User-created treasure-content JSON import/export
- Culture/theme weighting profiles beyond the initial style registry
- Presets
- Actor/folder output targets
- Precious-material composition for functional weapons/armor
- Full catalog coverage for every optional PF2e property rune

## API examples

Generate one sale treasure around 60 gp:

```js
await game.pf2eItemForge.generate({
  mode: "treasure",
  category: "treasure.jewelry",
  value: {
    mode: "target",
    target: 60,
    tolerance: 0.15
  },
  treasure: {
    material: "any",
    craftsmanship: "any",
    condition: "any",
    motif: "any",
    style: "any"
  },
  solver: {
    maxAttempts: 50
  }
});
```

Generate one book worth 40–80 gp:

```js
await game.pf2eItemForge.generate({
  mode: "treasure",
  category: "treasure.book",
  value: {
    mode: "range",
    min: 40,
    max: 80
  }
});
```

Generate a valuable wine container:

```js
await game.pf2eItemForge.generate({
  mode: "treasure",
  category: "treasure.beverage.wine",
  value: { mode: "target", target: 25, tolerance: 0.2 }
});
```

Register an additional treasure material and type:

```js
Hooks.once("pf2eItemForgeReady", (api) => {
  api.treasure.materials.register({
    id: "my-addon.material.moonwood",
    label: "Moonwood",
    tags: ["my-addon-fan-material"],
    valueFactor: 1.8
  });

  api.treasure.types.register({
    id: "my-addon.type.folding-fan",
    categories: ["treasure", "treasure.luxury"],
    label: "Folding Fan",
    tags: ["luxury"],
    baseValue: [5, 25],
    materialTags: ["my-addon-fan-material"],
    supportsMotif: true,
    components: [],
    systemCategory: "art-object",
    nameTemplates: { en: ["Folding fan of {material}"] },
    descriptionTemplates: { en: ["{craftsmanshipSentence} {motifSentence} {conditionSentence}"] }
  });
});
```

The module emits `pf2eItemForgeReady(api)` after initialization so optional extensions can register content without hard dependencies.

## Development

```bash
npm test
```

The current suite contains 51 passing tests, including a 300-seed treasure variety run.
