# PF2E Item Forge

Reusable Item Forge architecture for Foundry VTT v14 and Pathfinder 2e.


## Part of the Forge Suite

**Item Forge** is part of the **Forge Suite**, a growing collection of Foundry VTT modules and add-ons built for the busy Game Master. The suite is designed to reduce preparation and bookkeeping, make common GM tasks easier, and add useful tools that help make running and playing campaigns smoother and more enjoyable.

An overview of the Forge Suite, its modules, add-ons, and shared documentation is available here:

**Forge Suite:** https://github.com/crypto-vbrthr/pf2e-forge-suite


## v0.0.37-rc.1 scope

This is the first release candidate built from the fully hardened v0.0.36 baseline. It contains no generator-family redesign or new feature work; the RC freezes the reviewed contracts, source-policy behavior, editor/API integration, diagnostics, localization, and release packaging for final Foundry validation.
> Foundry compatibility is declared for v14. The PF2e system relationship remains intentionally unpinned because the exact tested PF2e system version has not been recorded in the project metadata; the RC does not guess a system-version range.


Implemented:

- Public `game.pf2eItemForge` API (API version 1)
- Canonical world source policy now persists `mode`, `includePacks`, and `excludePacks` together, while retaining legacy hidden settings for migration/backward compatibility
- Source checklists preserve selected pack IDs that are temporarily unavailable; only an explicit “Select none” clears them
- Worn/Held/Grimoire/Apex existing-item capabilities are source-policy-aware, while generated implementation-template availability remains independent from user content selection
- New `magic.*` descendant categories can be supplied by extension modules together with a registered supporting generator; request validation no longer hard-codes the core magic category list
- Reopening the standalone Item Forge with `api.open({ request })` replaces the request in an already-rendered window instead of silently ignoring it
- Public generation results are creation-ready and never expose a copied Compendium `_id`; provenance remains in metadata and Forge flags
- Canonical request normalization shared by API validation, generation, and embedded-editor hydration
- Reusable `ItemForgeEngine`
- Priority-based, extensible `GeneratorRegistry` with dynamically registered generation modes
- Registry-based hierarchical item categories
- Configurable compendium source selection and physical-item/spell-support indexes, with a dedicated GM world-default settings window, per-request editor overrides, Select all/none controls, and public source-policy API helpers
- Exact level or level range with strict/nearest/not-above/not-below policies
- Deterministic seeded generation
- Existing physical compendium items, excluding feats/spells/rule documents
- Spell-bearing scroll generation with meaningful legal heightening
- Special magic-item mode for wands, staves, spellhearts, grimoires, apex items, specific magic weapons, specific magic armor, specific magic shields, worn magic items, held magic items, and Accessory Runes
- Wands use the PF2e generic wand templates and embed one real spell at a legal base or meaningful heightened rank
- Staves can either be copied exactly from selected compendia or generated as rulebook-style variant families with inherited lower variants
- Spellhearts can either be selected as complete predefined PF2e items or generated from validated custom Spellheart profiles with coherent armor/weapon benefits, spell progressions, prices, and themes
- Specific magic weapons and armor can either be copied exactly from selected compendia or generated from validated profiles that own level, price, runes, theme, and special ability as one unit
- Specific magic shields have their own predefined/generated paths plus a dedicated `specificShieldProfiles` registry and explicit Hardness/HP/Broken Threshold contracts
- Worn magic items have predefined/generated paths, usage-aware categories, a public `wornMagicProfiles` registry, mode-aware `wornSlots` capabilities, and continuous automatic core coverage from item level 1 through 20
- Published worn items preserve native PF2e usage, Rule Elements, activations, price, traits, and automation; generated worn items use whole-effect profiles plus rules-text manifests. Fourteen core families cover item levels 1 through 20 across footwear, eyepieces, belts, cloaks, masks, circlets, gloves, bracers, garments, unrestricted jewelry, and headwear
- Generated worn profiles use `equipment` documents only as generic structural templates; backpack/container schemas are not borrowed by the generic worn generator
- Worn profiles support an explicit `invested` contract (default `true`), normalize canonical rarity/variant IDs, and treat arcane/divine/occult/primal as sufficient magic markers without redundantly forcing the `magical` trait
- Held magic items have dedicated `magic.held`, `magic.held.one-hand`, and `magic.held.two-hands` categories plus a public `heldMagicProfiles` registry. Published held items preserve native PF2e data; generated held items use only matching `equipment` templates and rules-text manifests. Activation manifests distinguish actions, reactions, and free actions and can carry frequency, trigger, requirements, and duration.
- Ten reviewed generated held-item families provide independent automatic strict coverage at every item level from 1 through 20 for both one-hand and two-hand categories; explicitly selected families remain strict to their own progression. Automatic generation filters handedness families that lack a safe PF2e system template before seeded selection.
- Grimoires have a dedicated `magic.grimoire` category with predefined/native and generated/rules-text paths plus a public `grimoireProfiles` registry. Published grimoires preserve their complete PF2e document data.
- Generated grimoires use only PF2e-system `book`/`equipment` documents carrying the `grimoire` trait as structural implementation templates; native Rule Elements, descriptions, subitems, apex/publication data, foreign flags, material/base/container identity, and template quantity are removed or normalized before composition.
- Five reviewed generated grimoire families provide automatic strict coverage from item level 4 through 20. Their structured contracts record daily-preparation restrictions, spell-slot-only use, eligible-spell filters, activation type, traits, frequency, trigger, requirements, duration, and effect text without pretending to provide unverified native automation.
- `getGrimoireCapabilities()` / `grimoireCapabilities` reports predefined availability, safe system-template count, generated-profile count, and generated levels; the Embedded Editor uses the same capability state for predefined/generated mode availability.
- Assistive Items use the cross-cutting `assistive` category in existing-only mode. Classification recognizes explicit PF2e assistive markers and a narrow source-backed identifier allow-list without description heuristics; selected items are copied whole with native rules. `getCapabilities().assistiveItems` explicitly reports `existing-only` so integrations do not invent a generated mode.
- Apex Items have a cross-cutting `magic.apex` category. Published apex items can remain worn items, armor, or weapons and are copied whole with native PF2e automation. Generated apex items deliberately use a safe PF2e-system `equipment` apex template and generic worn shape rather than trying to synthesize weapon/armor schemas.
- Six reviewed generated Apex families cover Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma at exact item levels 17–20. The core apex benefit is written to native `system.apex.attribute`; secondary passive/activation abilities remain localized rules text plus structured metadata, with explicit hybrid automation ownership.
- `getApexCapabilities()` / `apexCapabilities` reports existing/generated availability, native attribute coverage, generated profile count, and generated levels; the Embedded Editor filters mode, attribute, and profile choices from the same capability state.
- Accessory Runes are a separate `magic.accessory-rune` composition path with a public `accessoryRunes` registry; the core library contains the Treasure Vault Menacing, Pontoon, Preserving, and Trackless progressions
- Accessory Rune variants are source-backed by indexed `sourceSlug`, so both host and rune must exist in the selected content sources; result metadata records both content packs and exact rune provenance
- Accessory Rune host contracts declare document types, worn slots, and magic policy. The four core Treasure Vault families are `mundane-only`, matching the default rule that a magic host is legal only when a rune Usage explicitly permits it
- Greater Accessory Rune activations are structured as actions/traits/frequency/spell metadata and rendered into localized rules text; custom native Rule Elements are still not guessed
- Public `specificItemProfiles`, `specificShieldProfiles`, `wornMagicProfiles`, `heldMagicProfiles`, `grimoireProfiles`, and `apexProfiles` registries for extension modules and campaign content; `getWornSlotCapabilities()` / `wornSlots`, `getHeldHandCapabilities()` / `heldHandCapabilities`, `getGrimoireCapabilities()` / `grimoireCapabilities`, and `getApexCapabilities()` / `apexCapabilities` expose actual predefined/generated availability
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
- Live Magic diagnostics for predefined and generated magic paths including representative worn contracts, low/high one-/two-handed held contracts, predefined/generated Grimoire contracts, and predefined plus level-17/20 Apex contracts, with exact-level checks, native apex schema verification, system-template provenance, structured activation/physical/daily-preparation contracts, pack-index failures, and composed-equipment price preparation
- 294 automated unit/integration/statistical/contract tests

Not yet implemented:

- Generated Assistive Items are intentionally not implemented: published assistive items span bespoke physical forms and rules, so Item Forge exposes them as existing-only instead of fabricating generic variants.
- Magical Tattoos are intentionally out of scope for Item Forge generation: this module generates transferable/findable inventory objects, while a tattoo is applied to a creature rather than existing as ordinary loot after application. Formulae, services, or tattooing workflows would belong to a different feature surface.
- Native PF2e staff-preparation/casting automation for generated custom staff-family manifests (predefined staves preserve their native PF2e data unchanged)
- Verified native automation builders for generated custom wands/staves/spellhearts/specific items
- Verified native PF2e Accessory Rune carrier/activation automation (current compositions retain the host's native data and store the added rune as rules text plus a structured manifest)
- Non-zero reinforcing runes inside generated specific-shield profiles (blocked until final-durability interaction is verified against PF2e runtime)
- Precious-material composition for functional weapons/armor
- Presets
- Actor/folder output targets
- Full property-rune catalog coverage from every optional PF2e source
- Loot Forge integration itself (the API contract is prepared for it)

## Compendium source policy

Every non-treasure request carries the same canonical source object:

```js
source: {
  mode: "all" | "system" | "selected",
  includePacks: ["pf2e.equipment-srd", "pf2e.spells-srd"],
  excludePacks: []
}
```

Foundry module settings expose a dedicated **Source Compendiums** submenu. It owns the complete world-default policy in one place: `all`, `system`, or `selected`, plus the canonical `includePacks` and `excludePacks` arrays used by the public API. Since v0.0.36, Item Forge persists that full policy together in one hidden world setting and keeps the older hidden mode/include settings synchronized only for migration/backward compatibility. When `selected` is active, the stable union of indexed physical-item and spell-bearing Item compendiums appears directly beneath the mode. Temporarily unavailable saved pack IDs are retained across ordinary checkbox edits and are surfaced as missing; an explicit **Select none** is the action that clears the complete allow-list. The Item Forge itself displays the active world policy compactly and offers **Override the world default for this request**; only then are the local mode and pack checklist shown. Turning the override off immediately returns the request to the current world default. New API requests that omit source fields inherit the stored policy; explicit `source` requests still win. `game.pf2eItemForge.getDefaultSourcePolicy()` and `setDefaultSourcePolicy(source)` expose the same workflow to integrations.

Source selection governs actual content: published items, mundane base equipment, spell pools, and source-backed Accessory Runes. Structural implementation templates used to construct generated items are intentionally resolved outside that policy and are reported separately as `metadata.templateSource`. Individual generators may require PF2e-system templates or prefer them according to their hardened template contract.

Capability queries follow the same split. `getWornSlotCapabilities(source)`, `getHeldHandCapabilities(source)`, `getGrimoireCapabilities(source)`, and `getApexCapabilities(source)` filter their **existing** availability through the supplied source policy (or the current world default when omitted), while their **generated** availability still checks the global technical-template pool. `getCapabilities({ source })` exposes the same source-aware view.

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

Compose a source-backed Accessory Rune onto a compatible mundane host:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.accessory-rune",
  level: 6,
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: { accessoryRune: "trackless" }
});
```

The same source policy is applied to the host and the published rune entry. The result records the exact rune source in `metadata.accessoryRune.runeSource` and both packs in `metadata.contentSources`. Core Treasure Vault Accessory Runes reject magic hosts unless a future profile explicitly declares that its Usage permits one.

Generate a rules-text grimoire from a reviewed profile:

```js
await game.pf2eItemForge.generate({
  mode: "magic",
  category: "magic.grimoire",
  level: 12,
  levelPolicy: "strict",
  source: { mode: "system" },
  magic: {
    grimoireMode: "generated",
    grimoireProfile: "automatic"
  }
});
```

Generated core grimoires currently cover exact item levels 4 through 20. Their abilities are rules text plus structured Item Forge metadata; a PF2e system grimoire document is used only as the physical/schema implementation template.

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
