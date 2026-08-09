# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.24 scope

This release expands generated worn magic items into a continuous core level band. Published PF2e worn items can still be selected intact, while generated homebrew worn items now have at least one automatic strict-mode core candidate at every item level from 4 through 20.

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
- Special magic-item mode for wands, staves, spellhearts, specific magic weapons, specific magic armor, specific magic shields, and worn magic items
- Wands use the PF2e generic wand templates and embed one real spell at a legal base or meaningful heightened rank
- Staves can either be copied exactly from selected compendia or generated as rulebook-style variant families with inherited lower variants
- Spellhearts can either be selected as complete predefined PF2e items or generated from validated custom Spellheart profiles with coherent armor/weapon benefits, spell progressions, prices, and themes
- Specific magic weapons and armor can either be copied exactly from selected compendia or generated from validated profiles that own level, price, runes, theme, and special ability as one unit
- Specific magic shields have their own predefined/generated paths plus a dedicated `specificShieldProfiles` registry and explicit Hardness/HP/Broken Threshold contracts
- Worn magic items have predefined/generated paths, usage-aware categories, a public `wornMagicProfiles` registry, and continuous automatic core coverage from item level 4 through 20
- Published worn items preserve native PF2e usage, Rule Elements, activations, price, traits, and automation; generated worn items use whole-effect profiles plus rules-text manifests. Eleven core families now cover footwear, eyepieces, belts, cloaks, masks, circlets, gloves, bracers, garments, unrestricted jewelry, and headwear
- Public `specificItemProfiles`, `specificShieldProfiles`, and `wornMagicProfiles` registries for extension modules and campaign content
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
- Embedded `ItemForgeEditor` with request editing, preview, reroll, description display, runtime-derived PF2e price preview, and no persistence side effects
- Standalone `ItemForgeApplication` container owning Foundry document creation and preserving `createdByForge` versus `generated` provenance
- German and English localization
- Shared generation-result contract for `contentSources`, `templateSource`, and automation level
- Live Magic diagnostics for predefined and generated magic paths including worn items, strict source-shape checks, pack-index failures, and composed-equipment price preparation
- 190 automated unit/integration/statistical/contract tests

Not yet implemented:

- Native PF2e staff-preparation/casting automation for generated custom staff-family manifests (predefined staves preserve their native PF2e data unchanged)
- Verified native automation builders for generated custom wands/staves/spellhearts/specific items
- Non-zero reinforcing runes inside generated specific-shield profiles (blocked until final-durability interaction is verified against PF2e runtime)
- Precious-material composition for functional weapons/armor
- Presets
- Actor/folder output targets
- Full property-rune catalog coverage from every optional PF2e source
- Loot Forge integration itself (the API contract is prepared for it)

## API examples

Generate a worn magic item from a validated profile:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.worn.footwear",
  level: 10,
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: {
    wornMode: "generated",
    wornProfile: "core.wayfarer-footwear"
  }
});
```

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
