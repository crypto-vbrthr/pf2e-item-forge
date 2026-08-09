# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.18 scope

This release adds specific magic weapons and armor with both exact predefined-item preservation and registry-driven custom generation, building on the stable magic-item, rune, compendium, and embedded-editor architecture.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Canonical request normalization shared by API validation, generation, and embedded-editor hydration
- Reusable `ItemForgeEngine`
- Priority-based, extensible `GeneratorRegistry` with dynamically registered generation modes
- Registry-based hierarchical item categories
- Configurable compendium source selection and physical-item/spell-support indexes
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded generation
- Existing physical compendium items, excluding feats/spells/rule documents
- Spell-bearing scroll generation with meaningful legal heightening
- Special magic-item mode for wands, staves, spellhearts, specific magic weapons, and specific magic armor
- Wands use the PF2e generic wand templates and embed one real spell at a legal base or meaningful heightened rank
- Staves can either be copied exactly from selected compendia or generated as rulebook-style variant families with inherited lower variants
- Spellhearts can either be selected as complete predefined PF2e items or generated from validated custom Spellheart profiles with coherent armor/weapon benefits, spell progressions, prices, and themes
- Specific magic weapons and armor can either be copied exactly from selected compendia or generated from validated profiles that own level, price, runes, theme, and special ability as one unit
- Public `specificItemProfiles` registry for extension modules and campaign content
- Magic themes for fire, cold, electricity, healing, illusion, mental, vitality, void, arcane, divine, occult, primal, and summoning
- Composed weapons, armor, and shields with fundamental runes
- Registry-driven property runes with automatic/random/fixed/none modes and compatibility rules
- Effective-level resolution including base item and rune levels
- Full generated sale-treasure mode with one item per request
- Broad treasure categories plus optional exact treasure-type selection
- Treasure target value/range and bounded ValueSolver attempts
- Materials, craftsmanship, conditions, motifs, styles, attributes, and reusable components
- 82 built-in treasure types, 45 materials, 17 reusable components, 18 motifs, 16 conditions, 6 craftsmanship levels, and 12 styles
- Style- and treasure-type-aware weighting for materials, motifs, workmanship, conditions, and component frequency
- Mild target-aware candidate weighting for more efficient bounded value solving without removing seeded randomness
- Coherent component craftsmanship and gemstone component-value support
- Books with edition/completeness, beverages with origin/quality/vessel/age, and expanded jewelry/art/tableware/ceremonial/luxury content
- Material-aware wear such as fading, patina, water/smoke damage, cracking, worm damage, and restoration
- Type-specific Bulk, reproducible generation flags, and detailed valuation breakdown metadata
- Registration-time validation for extension treasure content
- Embedded `ItemForgeEditor` with request editing, preview, reroll, description display, and no persistence side effects
- Standalone `ItemForgeApplication` container owning Foundry document creation
- German and English localization
- 136 automated unit/integration/statistical/contract tests

Not yet implemented:

- Generated/custom spellheart composition with validated armor/weapon effect templates (predefined spellhearts are supported now)
- Native PF2e staff-preparation/casting automation for generated custom staff-family manifests (predefined staves preserve their native PF2e data unchanged)
- Precious-material composition for functional weapons/armor
- Presets
- Actor/folder output targets
- Full property-rune catalog coverage from every optional PF2e source
- Loot Forge integration itself (the API contract is prepared for it)

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

Compose a weapon:

```js
await game.pf2eItemForge.generate({
  mode: "equipment",
  category: "weapon.melee",
  level: { min: 7, max: 9 },
  levelPolicy: "strict",
  source: { mode: "system" },
  equipment: {
    fundamentalRunes: "automatic",
    propertyRunes: { mode: "automatic" }
  }
});
```

Generate a spell-bearing wand:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.wand",
  level: { min: 7, max: 9 },
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: {
    theme: "fire",
    allowHeightened: true
  }
});
```

Generate one thematic staff family variant:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.staff",
  level: 10,
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: {
    staffMode: "generated",
    staffProfile: "core.6-10-14",
    theme: "illusion",
    allowHeightened: true
  }
});
```

Select a predefined rules staff without rewriting its spell list or special abilities:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.staff",
  level: 8,
  source: { mode: "system" },
  magic: { staffMode: "existing" }
});
```

Generate a custom specific magic weapon:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.weapon",
  level: 8,
  magic: {
    specificMode: "generated",
    specificProfile: "core.elemental-resonance-weapon",
    theme: "fire"
  },
  source: { mode: "system" }
});
```

Generated specific items use ordinary PF2e fundamental runes and only the property runes declared by their profile. Their unique homebrew ability is stored as readable rules text plus structured `flags.pf2e-item-forge.specificItem` metadata. Predefined specific items are copied whole and retain native PF2e automation.

Generate one custom Spellheart from a coherent effect profile:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.spellheart",
  level: 8,
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: {
    spellheartMode: "generated",
    spellheartProfile: "core.elemental-conduit",
    theme: "cold",
    allowHeightened: true
  }
});
```

Generated Spellhearts use one validated profile as a complete balance unit rather than mixing arbitrary armor and weapon effects. Their selected spells are linked in the description and stored in structured Item Forge flags. Attachment-specific custom benefits are currently emitted as rules text rather than guessed PF2e Rule Elements; predefined Spellhearts continue to preserve their native automation unchanged.


Select a predefined spellheart while preserving all published PF2e rules data:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.spellheart",
  level: { min: 7, max: 10 },
  levelPolicy: "strict",
  source: { mode: "system" }
});
```

Generate one sale treasure and pin an exact treasure type:

```js
await game.pf2eItemForge.generate({
  mode: "treasure",
  category: "treasure.jewelry",
  value: { mode: "target", target: 80, tolerance: 0.15 },
  solver: { maxAttempts: 50 },
  treasure: {
    type: "core.type.jewelry.tiara",
    material: "any",
    condition: "any",
    craftsmanship: "any",
    motif: "any",
    style: "core.style.noble"
  }
});
```

Register extension treasure content:

```js
Hooks.once("pf2eItemForgeReady", (api) => {
  api.treasure.materials.register({
    id: "my-addon.porcelain",
    label: { de: "Porzellan", en: "porcelain" },
    tags: ["ceramic", "art", "tableware"],
    valueFactor: 1.35
  });

  api.treasure.types.register({
    id: "my-addon.painting-miniature",
    categories: ["treasure", "treasure.art.painting"],
    label: { de: "Miniaturgemälde", en: "miniature painting" },
    tags: ["painting", "decorative"],
    baseValue: [10, 60],
    materialTags: ["painting"],
    supportsMotif: true,
    components: []
  });
});
```

Register a specialist generator with explicit priority/mode:

```js
Hooks.once("pf2eItemForgeReady", (api) => {
  api.generators.register(myGenerator, {
    modes: ["my-generation-mode"],
    priority: 300
  });
});
```

## Embedded editor contract

`ItemForgeEditor` is designed to be embedded by other modules. Partial requests are hydrated through the same canonical defaults as the engine. The editor may preview and reroll but does not create world/actor Items; the embedding container decides what persistence means.

## Development

```bash
npm test
npm run test:coverage
```


### PF2e v14 specific-item data model

Specific magic weapons and armor are detected from PF2e v14's non-null `system.specific` baseline data object. Legacy boolean marker shapes remain supported for compatibility.
