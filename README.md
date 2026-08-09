# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.

## v0.0.20 scope

This release hardens the complete magic-item stack before additional magic families are added. It keeps the existing generator behavior while making shared level/spell selection, structural templates, automation status, diagnostics, and settings semantics explicit and reusable.

Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Canonical request normalization shared by API validation, generation, and embedded-editor hydration
- Dynamic engine defaults: source mode and ValueSolver attempts are read from current Foundry settings for every request, so changing settings no longer requires rebuilding the API
- Reusable `ItemForgeEngine` and embedded `ItemForgeEditor`
- Priority-based, extensible `GeneratorRegistry` with dynamically registered generation modes
- Shared `CandidateLevelResolver` for strict/nearest/not-above/not-below candidate policies across item generators
- Shared `SpellCandidateService` for spell eligibility, themes, and meaningful legal heightening
- `MagicItemTemplateResolver` that cleanly separates user-selected content sources from internal PF2e implementation templates
- Magic-result metadata distinguishes `contentSources`, `templateSource`, and automation level (`native` versus `rules-text`)
- Live `MagicItemDiagnostics` available through the API and the Item Forge header; diagnostics construct temporary PF2e documents without persisting world items
- Registry-based hierarchical item categories and configurable compendium source selection
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded generation
- Existing physical compendium items, excluding feats/spells/rule documents
- Spell-bearing scroll generation with meaningful legal heightening
- Standard and special wands with validated profile constraints
- Predefined and generated staff families with inherited rulebook-style variant progressions
- Predefined and generated Spellhearts with coherent profile families; generated cantrips explicitly follow the PF2e rule allowing the user's own higher spell attack/DC
- Predefined and generated specific magic weapons and armor using the current PF2e v14 non-null `system.specific` data-object contract
- Core magic profiles expose balance provenance metadata (`basis`, `reviewed`, `notes`) for diagnostics/extensions
- Defensive spell casting-time parsing for current/common PF2e data shapes
- Composed weapons, armor, and shields with fundamental and property runes
- Effective-level resolution including base item and rune levels
- Full generated sale-treasure mode with one item per request
- Broad treasure categories plus optional exact treasure-type selection
- Treasure target value/range and bounded ValueSolver attempts
- Materials, craftsmanship, conditions, motifs, styles, attributes, and reusable components
- 82 built-in treasure types, 45 materials, 17 reusable components, 18 motifs, 16 conditions, 6 craftsmanship levels, and 12 styles
- German and English localization
- 152 automated unit/integration/statistical/contract tests plus an in-Foundry magic smoke-diagnostic path

Not yet implemented:

- Native PF2e preparation/casting automation for generated custom staff-family manifests; predefined staves preserve native PF2e data unchanged
- Native Rule Element automation for generated custom Spellheart/special-wand/specific-item abilities; generated homebrew abilities remain explicit rules text plus structured manifests
- Specific magic shields
- Precious-material composition for functional weapons/armor
- Presets
- Actor/folder output targets
- Full property-rune catalog coverage from every optional PF2e source
- Loot Forge integration itself (the API contract is prepared for it)

## API examples

Run the live Foundry/PF2e magic smoke diagnostics (no world items are persisted):

```js
const diagnostics = await game.pf2eItemForge.runMagicDiagnostics();
console.table(diagnostics.checks);
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
