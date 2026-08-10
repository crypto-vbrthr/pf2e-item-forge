# Architecture

```text
ItemForgeApplication (workflow container / persistence)
        |
        v
ItemForgeEditor (embedded ApplicationV2 child / request + preview)
        |
        v
ItemForgeEngine (canonical normalization, validation, generation)
        |
        +-- CategoryRegistry
        +-- CompendiumIndex
        |     +-- physical item index
        |     +-- spell index (support data for spell consumables)
        |
        +-- GeneratorRegistry (priority + declared generation modes)
        |     +-- WandGenerator
        |     +-- SpecificMagicShieldGenerator
        |     +-- SpecificMagicEquipmentGenerator
        |     +-- WornMagicItemGenerator
        |     +-- AccessoryRuneGenerator
        |     +-- HeldMagicItemGenerator
        |     +-- GrimoireGenerator
        |     +-- SpellheartGenerator
        |     +-- StaffGenerator
        |     +-- TreasureGenerator
        |     +-- ScrollGenerator
        |     +-- EquipmentGenerator
        |     +-- ExistingItemGenerator
        |     +-- extension generators
        |
        +-- CandidateLevelResolver
        +-- SpellCandidateService
        +-- MagicItemTemplateResolver
        +-- generation-result contract
        +-- MagicItemDiagnostics
        +-- shared spell-item utilities / magic themes
        +-- ItemLevelResolver
        +-- PropertyRuneRegistry
        +-- StaffProfileRegistry
        +-- SpellheartProfileRegistry
        +-- SpecificItemProfileRegistry
        +-- SpecificShieldProfileRegistry
        +-- WornMagicProfileRegistry
        +-- HeldMagicProfileRegistry
        +-- GrimoireProfileRegistry
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
- `normalize()`, `validate()`, `generate()`, and the embedded editor use the same canonical request hydration path.
- The editor edits one request and previews one result. It does not create Foundry documents.
- The application container owns persistence/workflow actions such as `Item.create()`.
- Other modules should use the public engine API and may embed `ItemForgeEditor` without the standalone Item Forge window.
- Future Loot Forge integration should distribute budgets/counts/themes and issue individual Item Forge requests.
- Built-in and external treasure content use the same validated registries.
- Spell documents are support data, not directly generatable physical items. `ScrollGenerator` and `WandGenerator` may select eligible spells and embed them into physical item results; `StaffGenerator` either copies a predefined PF2e staff unchanged or uses the spell index to build a structured staff-family manifest. `SpellheartGenerator` has separate predefined and generated paths. `SpecificMagicEquipmentGenerator` does not require spell sources and either preserves a complete published specific weapon/armor or composes one validated profile onto a mundane base item. Predefined magic items preserve native PF2e automation; generated custom abilities remain explicit rules text plus structured flags unless a verified system contract exists. Worn magic items follow the same split: published worn items are cloned whole, while generated worn items select a validated usage-specific profile and use an indexed PF2e worn item only as a structural implementation template. Grimoires also use a dedicated split: published books remain native, while generated grimoires use a system-only grimoire document as schema/physical scaffolding and place their custom ability in localized rules text plus a structured grimoire contract.

## Generator resolution

Generators are registered with a declared generation mode and priority. Resolution is deterministic: the highest-priority generator whose `supports(request)` returns true wins. This lets specialist and extension generators override broad core strategies without depending on registration order.

Core priorities:

```text
WandGenerator                    220  mode magic
SpecificMagicShieldGenerator     219  mode magic
SpecificMagicEquipmentGenerator  218  mode magic
WornMagicItemGenerator           217  mode magic
AccessoryRuneGenerator           216  mode magic
SpellheartGenerator              215  mode magic
HeldMagicItemGenerator           214  mode magic
GrimoireGenerator                213  mode magic
StaffGenerator                   210  mode magic
TreasureGenerator     200  mode treasure
ScrollGenerator       200  mode existing
EquipmentGenerator    150  mode equipment
ExistingItemGenerator   0  mode existing
```

Registered generation modes are exposed through the public capabilities API and are validated dynamically rather than being hard-coded in the request normalizer.


## Spell-bound permanent magic items

`mode: "magic"` owns `magic.wand`, `magic.staff`, `magic.spellheart`, `magic.grimoire`, `magic.weapon`, `magic.armor`, `magic.shield`, `magic.worn` with worn-usage subcategories, and `magic.held` with one-/two-hand subcategories. Wands, generated staves, and generated spellhearts reuse the spell-support index and meaningful-heightening helpers. Specific weapons/armor, shields, and worn items instead use the physical-item index and dedicated profile registries. Predefined items preserve complete native PF2e documents, while generated custom items compose from validated whole-effect profiles rather than arbitrary effect fragments.

### Wands

`WandGenerator` selects one eligible non-cantrip, non-focus, non-ritual spell from the configured spell sources. The spell rank must correspond to a legal base rank or to heightening data actually present on the spell when `magic.allowHeightened` is enabled. The generator resolves the PF2e generic wand template for that rank, clones it, transfers rarity/traits, and embeds the selected spell into `system.spell` with the chosen `heightenedLevel`. The physical wand level and price therefore come from PF2e's own rank-specific wand templates.

### Staves

`StaffGenerator` has two explicit paths. `magic.staffMode: "existing"` selects a real staff from the configured compendia and clones its native PF2e item data unchanged, preserving its published spell list, special abilities, runes, price, and system automation.

`magic.staffMode: "generated"` creates a new thematic staff using a `StaffProfileRegistry`. Core profiles model common PF2e family progressions rather than a universal level ladder: `3 → 8 → 12`, `4 → 8 → 12`, and `6 → 10 → 14`. Each profile is a sequence of variants. The base variant introduces its own spell ranks; greater/major variants add only the ranks assigned to that tier and inherit every spell from all earlier variants. A generated level-12 staff in a `3 → 8 → 12` family therefore contains the base rank-1 list, the greater rank-2/3 additions, and the major rank-4/5 additions. It does not independently refill every rank from scratch.

Generated families use deterministic per-tier RNG streams so generating a stronger variant with the same seed preserves the exact lower-tier spell choices. A spell may reappear at a higher rank only when its indexed heightening data actually supports that rank. The shared spell utility never down-ranks a higher-rank spell merely because a lower maximum rank is requested.

Generated staff spell lists are stored as enriched `@UUID` links in the description and as a complete structured family manifest in `flags.pf2e-item-forge.staff`, including profile, selected variant, inherited tiers, and per-tier additions. Generated staves are marked as specific magic weapons. The implementation still deliberately avoids inventing an undocumented PF2e-native custom-staff spell-preparation storage schema; predefined staves use their native data, while generated family automation can later be wired to the verified live-system contract.


### Spellhearts

`SpellheartGenerator` resolves `mode: "magic"` + `category: "magic.spellheart"` and has two explicit paths. `magic.spellheartMode: "existing"` selects a published spellheart from the configured compendia and clones the complete PF2e item unchanged, preserving native armor/weapon benefits, activations, Rule Elements, price, and other system data.

`magic.spellheartMode: "generated"` composes a new homebrew spellheart from `SpellheartProfileRegistry`. A profile is a complete balance unit: it defines allowed themes, a strictly increasing family of item variants, prices, spell statistics, armor/weapon effect templates, and the daily spell ranks added at each variant. Core profiles currently cover elemental conduit, sonic resonator, void fang, and vitality/healing feather patterns. External modules can register additional validated profiles through `game.pf2eItemForge.spellheartProfiles`.

Generated spellhearts always select a themed cantrip plus the daily spells required by the chosen profile variant. Heightening is permitted only when the indexed spell actually exposes a meaningful fixed/interval heightened rank. A higher-rank spell is never down-ranked to fill a lower slot. Source-pack, rarity, seed, exact/range level, and level-policy constraints all remain part of the same canonical request.

A real indexed spellheart is used only as a structural PF2e `equipment` template. Its published description, slug, and Rule Elements are removed before the generated profile is applied, so unrelated automation can never leak into the custom result. The generated attachment benefits are rendered as explicit rules text and stored with the complete profile/spell manifest in `flags.pf2e-item-forge.spellheart`. This is deliberate: Item Forge does not invent unverified PF2e Rule Element predicates for arbitrary attachment-specific homebrew effects. Predefined spellhearts remain the path for native published automation.


### Specific magic weapons and armor

`SpecificMagicEquipmentGenerator` resolves `magic.weapon` and `magic.armor`. `magic.specificMode: "existing"` selects only indexed PF2e items whose `system.specific` marker is present. In PF2e v14 this is a non-null baseline object containing material/rune data; legacy boolean and `{ value: true }` markers remain readable for compatibility. The complete published document is cloned, preserving Rule Elements, activations, runes, price, and description.

`magic.specificMode: "generated"` starts from a compatible non-specific, rune-free physical base and selects a `SpecificItemProfileRegistry` profile. Each profile owns the item type, allowed themes, compatibility constraints, a strict level/price variant progression, fundamental-rune profile, optional profile-owned property runes, and one special ability. The generated source receives the PF2e-v14-style non-null `system.specific` baseline snapshot. Its fundamental runes remain ordinary PF2e runes, but its property-rune list is written exclusively from the profile and the normal free property-rune editor is not exposed for this path. This enforces the specific-item rule that new property runes cannot simply be added later unless the item already possesses them.

Generated unique abilities are rendered into the description and stored in `flags.pf2e-item-forge.specificItem` with profile, variant, theme, base item, runes, level, price, seed, and automation status. They intentionally use `automation: "rules-text"` rather than guessed Rule Elements. Extension modules can register additional complete families through `game.pf2eItemForge.specificItemProfiles`.


### Specific magic shields

`SpecificMagicShieldGenerator` resolves `magic.shield` separately from weapon/armor specifics. Predefined mode clones the complete published PF2e shield. Generated mode starts from a mundane shield and applies one validated `SpecificShieldProfile` containing variant level, price, final Hardness/HP/Broken Threshold values, optional theme, compatibility constraints, and one rules-text special ability.

Generated shield profiles currently use explicit final durability as their contract. Non-zero reinforcing runes are therefore rejected by the registry until their interaction with explicit profile durability has been verified against the live PF2e preparation pipeline. This avoids accidental double-scaling. Generated profile automation is always `rules-text`; only copied published items may report `native`.



### Worn magic items

`WornMagicItemGenerator` resolves `magic.worn` and its usage-aware descendants such as `magic.worn.cloak`, `magic.worn.eyepiece`, and `magic.worn.footwear`. The compendium index normalizes PF2e usage strings defensively so human-readable and slug-like forms such as `worn cloak`, `worn-cloak`, and `worncloak` map to the same usage family. Worn armor remains an armor concern, and spellhearts are explicitly excluded from worn-item classification.

`magic.wornMode: "existing"` selects a published worn magic item from the configured content sources and clones the complete source document. Native usage, Rule Elements, activations, traits, price, and automation remain untouched. `magic.wornMode: "generated"` selects a validated `WornMagicProfileRegistry` family. Each profile owns one worn usage, rarity, whole-effect description, balance provenance, an explicit `invested` contract (default `true`), and a strictly increasing level/price variant progression. Canonical rarity values and non-empty unique variant IDs are validated at registration time. Core profiles cover footwear, eyepieces, belts, cloaks, masks, circlets, gloves, bracers, garments, unrestricted jewelry, and headwear. Their variant levels are deliberately interleaved so automatic strict-mode generation has at least one core candidate at every item level from 1 through 20. A specifically selected profile remains strict to its own profile progression; the wider coverage does not synthesize missing tiers inside an individual family. External modules can register additional validated families through `game.pf2eItemForge.wornMagicProfiles`.

A generated worn item may use only a system-indexed `equipment` document with the same normalized usage as a structural implementation template. Generic worn generation deliberately does not borrow `backpack`, `kit`, `book`, or other specialized document schemas. Container-style worn items can still be selected intact in predefined mode; future generated container families require their own verified builder/template contract. The template's PF2e usage field is preserved rather than guessing a version-specific storage value, while its original description, slug, Rule Elements, subitems, apex data, publication data, and foreign flag scopes are removed before composition. The generated result applies `invested` only when the profile requests it. If a profile already carries a magical tradition trait (`arcane`, `divine`, `occult`, or `primal`), the generator does not redundantly add `magical`. Generated worn abilities use `automation.level: "rules-text"` and store profile, variant, usage, investment state, special effect, seed, and balance provenance in `flags.pf2e-item-forge.wornItem`.

The public API exposes worn availability through `getWornSlotCapabilities()` and `getCapabilities().wornSlots`. Each slot reports whether predefined content exists, whether a safe generated path currently exists, its generated profile/template counts, and the exact generated levels. The Embedded Editor uses the same capabilities to disable worn subcategories that cannot be fulfilled in the selected predefined/generated mode instead of allowing a dead-end request. `other` remains a read/classification fallback for unknown published worn usages and is intentionally not a valid generated profile slot.

Live Magic diagnostics exercise predefined worn items plus representative generated contracts for unrestricted worn items, eyepieces, headwear, and footwear. They verify normalized usage/slot agreement, `equipment` document type, profile-driven investment state, a valid magic marker trait, absence of inherited Rule Elements/subitems/apex data/foreign flag scopes, and the `rules-text` automation contract.



### Held magic items

`HeldMagicItemGenerator` resolves `magic.held`, `magic.held.one-hand`, and `magic.held.two-hands`. The compendium index recognizes magical `equipment` documents whose PF2e Usage is `held in 1 hand` or `held in 2 hands` (including normalized slug-like forms), records `heldHands`, and deliberately does not classify weapons or specialized `book`/`backpack`/`kit` schemas into this family.

`magic.heldMode: "existing"` selects a published held magic item from the configured content sources and clones its complete PF2e document, preserving Usage, Rule Elements, activations, traits, price, and native automation. `magic.heldMode: "generated"` selects a validated `HeldMagicProfileRegistry` family. A profile owns its handedness, rarity, optional investment state, traits, whole-effect description, balance provenance, and a strictly increasing level/price variant progression. Ten core families are arranged as five one-hand and five two-hand progressions. Each handedness independently has an automatic strict candidate at every item level from 1 through 20; explicitly selected profiles do not synthesize missing tiers.

Generated held items resolve only a PF2e-system-indexed `equipment` implementation template with the same handedness; there is no silent module-content fallback. The PF2e Usage field is retained as a verified structural value, while original description, slug, Rule Elements, subitems, apex/publication data, foreign flag scopes, material identity, base-item/container identity, and template quantity are cleared or normalized. Profiles own physical Bulk plus a structured activation contract (`type: action|reaction|free-action`, action count for ordinary actions, traits, frequency, optional trigger/requirements/duration, and effect text). The renderer derives the full localized activation header from that contract, including multi-use frequencies, so built-in effect prose does not repeat structural activation metadata. The result remains `automation.level: "rules-text"`. Live diagnostics exercise predefined Held Items plus low/high generated one-hand and two-hand cases against the current PF2e document constructor, including exact level, implementation-template provenance, physical cleanup, and activation structure.

Held Items are intentionally a narrow permanent-equipment family, not a synonym for all miscellaneous magic. Grimoires now have their own dedicated generator. Assistive items and apex items remain separate rule families for future dedicated handling. Magical Tattoos are deliberately outside Item Forge generation scope because the Forge models transferable/findable inventory objects rather than a body-application workflow.

The public API exposes `getHeldHandCapabilities()` and `getCapabilities().heldHandCapabilities`. Each entry reports handedness, predefined availability/count, safe PF2e system-template count, generated-profile count, and generated levels so Loot Forge does not need to reverse-engineer the profile registry. Generated requests filter unavailable handedness before candidate selection, and the Embedded Editor uses the same capability data to disable dead-end handedness categories and hide generated profiles whose handedness lacks a safe system template.

### Grimoires

`GrimoireGenerator` resolves `magic.grimoire` and has explicit `magic.grimoireMode: "existing" | "generated"` paths. The compendium index classifies `book`/`equipment`-family documents carrying the `grimoire` trait as `magic.grimoire` and excludes them from generic worn/held classification. Existing mode selects a published grimoire under the request source policy and clones the complete PF2e document unchanged, preserving native effects, Rule Elements, description, price, traits, and automation.

Generated mode selects one validated `GrimoireProfileRegistry` family. The core library contains five reviewed families whose variant levels interleave to provide automatic strict-mode coverage from item level 4 through 20. A profile owns rarity, Bulk, description, balance provenance, whole-effect variants, and a structured activation contract. Activation data can represent ordinary actions, reactions, or free actions plus traits, arbitrary count/period frequency, trigger, requirements, duration, and an explicit eligible-spell filter (`preparedFromGrimoire`, `slotsOnly`, next-action casting, spell traits, damage/healing/summon/spell-attack requirements). Explicit profile selection remains strict to that family rather than manufacturing missing tiers.

The generated path requires a PF2e-system implementation template whose loaded document is still a safe `book` or `equipment` document carrying the `grimoire` trait. No third-party template fallback is permitted. The template provides schema-compatible physical structure only. Its Rule Elements, description, subitems, slug, apex/publication data, foreign flag scopes, material/base-item/container identity, and quantity are stripped or normalized before the Item Forge profile is written. Generated results use `automation.level: "rules-text"`; Item Forge does not guess a PF2e-native automation schema for custom grimoire spell modifications.

Every generated result stores a daily-preparation contract in `metadata.grimoire.rules` and `flags.pf2e-item-forge.grimoire.rules`: the bearer studies the grimoire during daily preparations, benefits apply to qualifying prepared spells cast from spell slots, cantrips/focus/innate spells are excluded, one caster can benefit from only one grimoire per day, one grimoire can benefit only one caster per day, and continued possession after preparation is not required. These fields mirror the rule assumptions the generated prose is built around and provide a stable contract for future automation or integrations.

The public API exposes `grimoireProfiles`, `getGrimoireCapabilities()`, and `getCapabilities().grimoireCapabilities`. Capabilities report predefined availability/count, safe PF2e system-template count, generated-profile count, and exact generated levels. The Embedded Editor uses this to disable an unavailable predefined/generated mode rather than accepting an impossible request. Live diagnostics exercise published selection plus exact low/high generated cases, verify system-template provenance, cleaned template identity, the `grimoire`/magic marker traits, empty custom Rule Elements, structured daily-preparation rules, and structured activation/spell-filter metadata.

### Accessory Runes

`AccessoryRuneGenerator` resolves `magic.accessory-rune` as a composition of two content objects: one compatible host item and one published Accessory Rune variant. The built-in `AccessoryRuneRegistry` provides the rules contract, but it no longer bypasses source selection. Every variant declares a `sourceSlug`; generation first resolves a matching indexed rune entry under the same `request.source` policy used for the host. If the chosen sources do not contain the rune itself, that variant is not a candidate. Result provenance therefore includes both host and rune packs in `metadata.contentSources` plus exact `runeSource` UUID/pack/slug metadata.

Each family has a declarative host contract:

```js
host: {
  documentTypes: ["equipment"],
  wornSlots: ["footwear"],
  magicPolicy: "mundane-only"
}
```

`magicPolicy: "mundane-only"` is the default and is used by all four core Treasure Vault families. A host carrying `magical`, `arcane`, `divine`, `occult`, or `primal` is rejected even when it is not invested. Extension profiles may use `magicPolicy: "allowed"` only when the rune's Usage explicitly permits a non-invested magic host. The registry accepts broader target families such as shields/items/vehicles so future source-backed runes do not require family-specific generator branches; unsupported host document types simply cannot become indexed candidates until Item Forge gains a verified builder/index contract for them.

The generator always rejects invested hosts, hosts already carrying an Item Forge Accessory Rune manifest, and loaded documents whose usage/magic state changed after indexing. Effective item level is `max(baseLevel, runeLevel)`, while existing base abilities are preserved without scaling. Rune price is added to the host price and normalized to gp/sp/cp. The resulting item gains `invested` and `magical`, and the added rune remains `automation.level: "rules-text"` rather than fabricating unverified PF2e Rule Elements.

Activation-capable variants carry structured data (`actions`, activation `traits`, frequency, optional spell slug/rank/DC, and localized effect text). This currently covers greater Menacing, greater Preserving, and greater Trackless. The same structure is stored in result metadata and `flags.pf2e-item-forge.accessoryRune`, while the item description renders the complete activation line including concentrate/manipulate traits.

Live Magic diagnostics exercise Trackless footwear and Preserving container hosts, verify exact source-backed rune provenance and `contentSources`, validate the `mundane-only` core host policy, and inspect that registered activation variants expose the structured activation contract.

## Equipment/Magic result contracts

`ItemForgeEngine` applies a shared post-generation contract before results leave the public API. `metadata.contentSources` is always an array, `metadata.templateSource` is either a structural-template descriptor or `null`, and automation uses `metadata.automation.level` with `native` or `rules-text`. Generated specific-item metadata is normalized to `rules-text` even if an extension profile attempts to claim native behavior; profile registries reject unsupported native declarations up front.

World creation adds `flags.pf2e-item-forge.createdByForge = true` without erasing the engine's `generated` meaning. A copied published item therefore remains `generated: false`, while a composed/profile-generated item is `generated: true`. This distinction is intended for Loot Forge and other downstream consumers.

The Embedded Editor may construct a temporary, non-persisted PF2e Item document for preview-only derived values. This is especially important for composed rune equipment because current PF2e preparation computes level/rarity/price from runes and other factors. The live diagnostics use the same principle to detect schema drift without creating world items. Failed compendium indexes are retained as structured diagnostics instead of disappearing behind a later “no candidates” result.

## Treasure generation

`TreasureGenerator` is implemented and data-driven. A request may choose a broad category such as `treasure.jewelry` or additionally pin one concrete registry type such as `core.type.jewelry.tiara`.

```text
Treasure request
   |
   +-- category + optional exact type
   +-- value target/range + bounded ValueSolver
   +-- material / condition / craftsmanship / motif / style
   |
   v
style-aware candidate construction
   |
   +-- type
   +-- material
   +-- condition
   +-- craftsmanship
   +-- motif
   +-- attributes
   +-- coherent optional components
   |
   v
valuation -> PF2e treasure Item source
```

Styles can weight material tags, motifs, craftsmanship, type tags, component chances, and condition profiles. Individual treasure types may additionally weight condition, craftsmanship, and motif choices, so books can age differently from metal jewelry and ceremonial objects can prefer different visual language from merchant luxury goods. Component craftsmanship can inherit the parent quality, stay close to it, roll independently, or be disabled. Gemstone materials may define their own `componentValue` range for inlays/settings.

Candidate construction is mildly target-aware: treasure type, material, workmanship, and optional component density are biased toward combinations that are more plausible for the requested sale value, while the bounded `ValueSolver` remains the final authority and all random choices remain seed-reproducible. Generated treasure keeps a full valuation breakdown and generation plan in `flags.pf2e-item-forge`.

Treasure types may also define a physical Bulk value. Book and beverage types use the generic attribute mechanism for details such as edition/completeness and origin/quality/vessel/age; these attributes contribute to valuation and are exposed in preview metadata.

Treasure registry definitions are validated when registered. Invalid ranges, missing component references, invalid fixed materials, malformed weights, and (when the CategoryRegistry is supplied) unknown categories fail immediately instead of surfacing during a later generation.

## Scroll generation

`ScrollGenerator` owns `mode: "existing"` + `category: "consumable.scroll"` before the general existing-item strategy resolves.

```text
Scroll request
   |
   +-- selected spell compendiums
   |      -> eligible non-cantrip/non-focus/non-ritual spells
   |
   +-- meaningful base/heightened ranks
   |      -> interval or fixed heightening definitions
   |
   +-- PF2e generic scroll template for that rank
   |      -> determines physical scroll level/price
   |
   v
physical Consumable source with embedded system.spell
```

Generic scroll templates are infrastructure and are suppressed from ordinary predefined-item selection so an empty scroll cannot leak into broad `item` or `consumable` generation.


## Specific-item compatibility

The compendium index treats PF2e v14's non-null `system.specific` object as the canonical specific weapon/armor marker, while retaining legacy marker support. Generated specific physical items snapshot their intrinsic material and rune state into `system.specific`.
