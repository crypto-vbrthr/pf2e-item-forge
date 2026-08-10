# Changelog

## 0.0.36

- Final Contract & RC Hardening pass after the full v0.0.35 review; no generator-family redesign.
- Persists the complete world source policy (`mode`, `includePacks`, `excludePacks`) as one canonical hidden setting while keeping legacy mode/include settings synchronized for migration/backward compatibility.
- Fixes selected-compendium state so temporarily unavailable saved pack IDs survive ordinary settings/editor checkbox edits; explicit Select none remains the intentional full-clear operation.
- Makes Worn/Held/Grimoire/Apex existing-item capability reporting respect the active source policy while keeping generated technical-template availability independent from content-source selection. `getCapabilities({ source })` exposes the same view.
- Removes the hard-coded core magic-category allow-list from request validation. Registered descendants of `magic` are now accepted when a registered generator supports the normalized request, matching the extension-oriented Category/Generator registries.
- Makes `api.open({ request })` update an already-rendered standalone Item Forge instead of silently keeping the old request; stale preview/diagnostic state is cleared.
- Centralizes creation-ready result cleanup in the generation contract: public `itemSource` objects no longer retain copied Compendium `_id` values.
- Localizes preview warning messages instead of exposing raw internal warning codes and localizes the preview gold-piece suffix instead of hard-coding German `GM`.
- Removes the dangling `license: LICENSE` manifest entry because no license file is bundled. PF2e system compatibility remains intentionally unpinned until a concrete tested system version is recorded for the RC rather than guessing a range.
- Adds targeted regression tests for source-policy serialization/excludes, legacy fallback, missing-pack preservation, source-aware capability separation, extension magic categories, application request replacement, and creation-ready `_id` cleanup.
- Test suite: 294 passing tests; total line coverage 94.26%, branch coverage 74.74%, function coverage 89.14%.

## 0.0.35

- Reworks compendium-source UX so the world default mode and its selected pack list are configured together in a dedicated Foundry module-settings submenu instead of being split between generic settings and the Item Forge window.
- Hides the old standalone `defaultSourceMode` field from Foundry's generic settings form while retaining the same hidden world-setting storage and public API contract for backward compatibility.
- Makes the Item Forge use the current world source policy by default and displays that policy as a compact summary rather than exposing world-default editing controls in the generator window.
- Adds an explicit per-request **Override world default** toggle. Local source mode and pack selection only appear while the override is active; **Use world default** returns immediately to the current persisted policy.
- Preserves the canonical `source.mode` / `includePacks` / `excludePacks` engine contract and all existing API behavior. Explicit integration requests continue to override the world policy, while ordinary Item Forge requests follow later world-setting changes without reopening the window.
- Keeps the stable item-plus-spell compendium list, package/content summaries, missing-pack warnings, and Select all / Select none controls in the new settings UI and in request overrides where applicable.
- Adds DE/EN localization and regression coverage for the dedicated settings application and world-default/per-request override behavior.
- Test suite: 281 passing tests; total line coverage 94.19%.

## 0.0.34

- Promotes compendium source selection into a persistent world-level workflow instead of a transient per-editor choice.
- Keeps the existing canonical `source.mode` / `includePacks` / `excludePacks` request contract and adds world-default hydration for omitted `includePacks`, preserving explicit API overrides.
- Adds a hidden world setting for the selected compendium IDs plus public `getDefaultSourcePolicy()` / `setDefaultSourcePolicy()` API helpers. Saving from the Item Forge persists both the current source mode and selected pack list; only GMs are offered the save action.
- Expands the Embedded Editor source section with a stable item-plus-spell compendium list, package/content summaries, selected-count feedback, Select all / Select none controls, and Save/Load world-default actions.
- Preserves selected pack IDs when switching away from selected-source mode or between item types, including spell-only packs that are temporarily irrelevant to the current generator.
- Reports saved pack IDs that are currently unavailable instead of silently discarding them.
- Keeps implementation templates separate from content-source policy: validated implementation templates for generated scrolls/wands/worn/held/grimoires/apex items and other schema scaffolding remain implementation details, while published content, base equipment, spells, and source-backed runes continue to obey `request.source`.
- Extends DE/EN localization and regression coverage for default-source hydration, API persistence, editor bulk selection, save/load behavior, and hidden-list preservation.
- Test suite: 278 passing tests; total line coverage 94.13%.

## 0.0.33

- Adds `magic.apex` as a dedicated cross-cutting Apex Item family with explicit existing/native and generated/hybrid paths. Published apex weapons, armor, and worn items keep their complete PF2e document data.
- Adds public `ApexProfileRegistry` as `game.pf2eItemForge.apexProfiles` plus `getApexCapabilities()` / `getCapabilities().apexCapabilities`.
- Adds six reviewed generated Apex families for Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma with exact automatic strict coverage at item levels 17–20.
- Uses the verified PF2e native `system.apex.attribute` field for the defining generated Apex benefit while keeping custom secondary abilities as rules text plus structured metadata. Results explicitly declare hybrid ownership with native `apex-attribute` and rules-text secondary automation.
- Restricts generated Apex templates to PF2e-system apex `equipment` documents and emits a generic worn item shape; published apex weapon/armor schemas are never repurposed as hidden templates.
- Hardens Apex composition by clearing inherited Rule Elements, material/base/container identity, subitems, publication data, slug, quantity, and foreign flag scopes while retaining the native Apex schema shape.
- Adds structured Apex activation contracts supporting actions, reactions, free actions, traits including fortune, frequency, trigger, requirements, duration, and localized effect text.
- Extends the Embedded Editor with Apex existing/generated mode, attribute, and profile controls plus capability-aware filtering, preview metadata, localization, and dedicated errors.
- Extends live Magic diagnostics with existing Apex plus exact generated level-17/20 cases, native apex schema checks, system-template provenance, cleanup, activation structure, and hybrid automation ownership.
- Test suite: 272 passing tests; total line coverage 94.16%.

## 0.0.32

- Adds `assistive` as an existing-only cross-cutting item category for published PF2e assistive gear.
- Uses explicit assistive category/trait markers plus a narrow source-backed identifier allow-list; descriptions are deliberately not searched heuristically.
- Preserves the complete native PF2e item when selected, allowing assistive gear to retain its real weapon/equipment/container or other physical document shape and bespoke automation.
- Exposes `getCapabilities().assistiveItems` with `modes: ["existing"]`, `generated: false`, and `policy: "existing-only"` so integrations do not offer a synthetic assistive-item generator.
- Adds Embedded Editor category support, DE/EN localization, indexing tests, and assistive-classification regression coverage.
- Test suite: 259 passing tests; total line coverage 94.11%.

## 0.0.31

- Adds `magic.grimoire` as a dedicated magic-item family with explicit predefined/native and generated/rules-text paths.
- Adds public `GrimoireProfileRegistry` as `game.pf2eItemForge.grimoireProfiles` plus `getGrimoireCapabilities()` / `getCapabilities().grimoireCapabilities`.
- Classifies indexed `grimoire` documents separately from generic held/worn equipment and preserves complete published PF2e grimoires in predefined mode.
- Adds five reviewed generated grimoire families with interleaved variants that provide automatic exact strict coverage from item level 4 through 20.
- Generated grimoires use only PF2e-system `book`/`equipment` grimoire documents as implementation templates, re-check type/trait after document load, and reject third-party template fallback.
- Hardens generated grimoire composition by clearing inherited Rule Elements, descriptions, subitems, apex/publication data, foreign flags, material/base-item/container identity, slug, and template quantity before writing the profile.
- Adds a structured daily-preparation rules contract covering prepared-spell use, spell-slot-only benefits, cantrip/focus/innate exclusions, one-grimoire-per-caster/day, one-caster-per-grimoire/day, and no post-preparation possession requirement.
- Adds structured grimoire activation contracts for actions/reactions/free actions, traits, arbitrary frequency counts, trigger, requirements, duration, and qualifying-spell filters.
- Extends the Embedded Editor with Grimoire predefined/generated mode and profile controls, capability-aware availability, preview data, source guidance, localization, and dedicated errors.
- Extends live Magic diagnostics and regression coverage with predefined/generated Grimoire paths, exact-level coverage, system-template provenance, schema cleanup, activation/filter contracts, and runtime guards.
- Marks Magical Tattoos as intentionally out of Item Forge generation scope rather than an unfinished loot category; assistive items and apex items remain future dedicated blocks.
- Test suite: 255 passing tests; total line coverage 94.04%.

## 0.0.30

- Completes the Held Item contract review by making the structured activation manifest authoritative for activation type, action count, traits, frequency, trigger, requirements, duration, and effect text.
- Adds explicit `action`, `reaction`, and `free-action` activation types while retaining backward compatibility for older action-count-only extension profiles.
- Renders multi-use frequencies correctly (`2/day`, `3/hour`, and equivalent localized forms) instead of collapsing every known period to “once”.
- Renders trigger, requirements, and duration fields into localized held-item activation headers and stores their rendered forms alongside the structured metadata.
- Removes duplicated action/trait/frequency prose from the ten built-in Held Item effect texts so the activation contract is the single source of truth for activation metadata.
- Filters generated Held Item profile candidates by safe PF2e system-template availability before seeded selection, preventing an unavailable handedness from defeating an otherwise valid automatic request.
- Applies the same handedness capabilities in the Embedded Editor: unavailable one-/two-hand categories are disabled for the selected held mode and generated profile choices are limited to actually generatable handedness families.
- Extends live diagnostics and regression coverage for activation types, multi-use frequencies, trigger/requirements/duration rendering, and missing-template handedness fallback.
- Test suite: 241 passing tests; total line coverage 94.03%.

## 0.0.29

- Hardens generated Held Items with system-only PF2e implementation templates. Core generation no longer falls back to arbitrary module/third-party held equipment when no matching PF2e system template is available.
- Expands the reviewed core Held Item library from five to ten profile families so automatic strict generation has a candidate at every item level 1–20 independently for one-hand and two-hand requests.
- Adds structured held-item activation contracts per variant (`actions`, traits, frequency, trigger/requirements/duration slots, effect text) while retaining rules-text automation rather than inventing Rule Elements.
- Adds profile-owned physical metadata with explicit Bulk; generated held items overwrite template Bulk, clear material/base-item/container identity, normalize quantity, and keep only the verified held Usage shape.
- Adds `game.pf2eItemForge.getHeldHandCapabilities()` and `getCapabilities().heldHandCapabilities`, reporting existing/generated availability, profile/template counts, and generated levels per handedness.
- Expands live Magic diagnostics to low/high one-hand and two-hand generated cases, exact-level checks, system-template provenance, Bulk/material cleanup, and structured activation validation.
- Adds editor guidance that source selection governs predefined Held Items while generated Held Items come from Item Forge profiles plus a PF2e system implementation template.
- Adds guard regressions for missing/changed implementation-template documents and system-only template resolution.
- Test suite: 238 passing tests; total line coverage 93.90%.

## 0.0.28

- Adds `magic.held` with explicit one-hand and two-hand subcategories for permanent held magic equipment.
- Adds `HeldMagicItemGenerator` with separate predefined/native and generated/rules-text paths. Published PF2e held items are cloned whole; generated items use safe hand-matched `equipment` templates.
- Adds public `HeldMagicProfileRegistry` as `game.pf2eItemForge.heldMagicProfiles` and exposes held modes, handedness, profile levels, investment, and balance provenance through capabilities.
- Adds five reviewed generated families: Waylight Lantern, Scholar Prism, Resonance Baton, Stormglass Sphere, and Guardian Standard. Their interleaved variants provide automatic strict-mode coverage at every item level from 1 through 20.
- Compendium indexing now recognizes magical `held in 1 hand` / `held in 2 hands` equipment and records normalized handedness without absorbing weapons, grimoires/books, worn items, or other specialized document types.
- Generated held items strip template Rule Elements, subitems, apex/publication data, slugs, descriptions, and foreign flags while preserving the verified PF2e usage shape.
- Adds embedded-editor mode/profile controls, held-item preview fields, DE/EN localization, canonical request hydration, and dedicated error handling.
- Extends live Magic diagnostics with predefined held items plus generated one-hand/two-hand contract checks.
- Keeps grimoires, magical tattoos, assistive items, and apex items outside the Held Items generator for future dedicated blocks.
- Test suite: 233 passing tests.

## 0.0.27

- Hardens Accessory Rune hosts with an explicit `host` contract (`documentTypes`, `wornSlots`, `magicPolicy`). Core Treasure Vault runes default to `mundane-only`; non-invested magic hosts are accepted only by profiles that explicitly opt into `magicPolicy: "allowed"`.
- Applies the request source policy to both halves of the composition. A published Accessory Rune variant is now resolved by its indexed `sourceSlug`, so the rune itself must exist in an allowed compendium instead of being silently supplied by the built-in rules library.
- Records rune provenance (`runeSource` UUID/pack/slug) and includes both host and rune packs in `metadata.contentSources`.
- Adds structured activation contracts for greater Menacing, greater Preserving, and greater Trackless, including action count, activation traits, frequency, spell metadata where applicable, and localized rendered rules text.
- Expands the public Accessory Rune registry contract to support future shield/item/vehicle target families without hard-coding the first four Treasure Vault runes into the generator.
- Normalizes composed Accessory Rune prices to gp/sp/cp instead of converting large values to platinum.
- Expands live Magic diagnostics with a Preserving/container scenario, rune-source provenance checks, host-magic policy checks, and a structured activation-contract check.
- Adds regression coverage for hosts that become invested, magical, already runed, usage-incompatible, or unavailable after indexing, plus source-filter enforcement for the rune itself.
- Test suite: 219 passing tests.

## 0.0.26

- Adds `magic.accessory-rune` as a separate composition path rather than mixing Accessory Runes into generated worn-item profiles.
- Adds `AccessoryRuneRegistry` exposed as `game.pf2eItemForge.accessoryRunes`.
- Adds the Treasure Vault Remaster Menacing, Pontoon, Preserving, and Trackless families with their published level/price progressions and usage constraints.
- Accessory Rune composition enforces one-rune/investment rules, compatible host usage, `max(base level, rune level)`, additive rune price, preserved base abilities, seeded selection, rules-text automation, preview metadata, localization, and live diagnostics.
- Test suite: 210 passing tests.

## 0.0.25

- Hardens generated worn-item structural templates: the generic worn generator now accepts only slot-matched `equipment` documents and will not silently inherit backpack/container/kit schemas.
- Adds mode-aware worn-slot capability reporting through `game.pf2eItemForge.getWornSlotCapabilities()` and `getCapabilities().wornSlots`, including predefined/generated availability, profile/template counts, and generated levels.
- Uses the same worn-slot capabilities in the Embedded Editor so subcategories that cannot be fulfilled in the selected predefined/generated mode are disabled instead of leading to a dead-end generation request.
- Tightens `WornMagicProfileRegistry` validation for canonical rarity values, non-empty unique variant IDs, and the new boolean `invested` contract.
- Makes profile investment explicit: generated worn items default to invested, but reviewed profiles can opt out; magical tradition traits count as magic markers without redundantly forcing the `magical` trait.
- Clears all foreign template flag scopes from generated worn items in addition to Rule Elements, subitems, apex data, slug, publication data, and description.
- Extends the core generated worn library from eleven to fourteen profile families with Pathmark Charm (level 1), Signal Gloves (level 2), and Quickhand Bracers (level 3), yielding continuous automatic strict-mode core coverage from item level 1 through 20.
- Adds optional balance-analogue metadata to profile provenance so reviewed profile families can retain concrete published reference anchors.
- Expands live Magic diagnostics across representative unrestricted, eyepiece, headwear, and footwear generated worn contracts and validates exact usage-slot agreement, safe document type, investment state, magic markers, cleaned source data, and rules-text automation.
- Keeps unknown `worn` usages classified as `other` for predefined selection while continuing to forbid `other` as a generated profile slot.
- Test suite: 196 passing tests.

## 0.0.24

- Expands the core generated worn-item library from six to eleven reviewed profile families.
- Adds Surehand Gloves (levels 6/12/19), Artificer Bracers (7/13/20), Mistweave Garment (8/14), Resolute Brooch (9/15), and Horizon Helm (10/16).
- Interleaves core worn-item variants so automatic strict-mode generation has at least one candidate at every item level from 4 through 20.
- Keeps explicitly selected profile families strict to their own variant progression; choosing a Wayfarer Footwear profile at level 6 still correctly yields no strict candidate.
- Uses worn usages with verified published structural examples for the new generated families, including gloves, bracers, garments, unrestricted worn jewelry, and headwear.
- Adds a regression test that exercises automatic generated worn items at every level from 4 through 20.
- Moves the live generated-worn diagnostic to exact level 6 so Foundry now probes one of the previously uncovered levels against the real PF2e runtime and implementation-template index.
- Updates German and English localization for all new profile families and the 10-minute frequency label.
- Test suite: 190 passing tests.

## 0.0.23

- Adds `magic.worn` plus usage-aware subcategories for unrestricted worn items, backpacks, belts, cloaks, eyepieces, garments, gloves, bracers/armbands, headwear, circlets, masks, footwear, collars, and other worn usages.
- Adds `WornMagicItemGenerator` with separate predefined and generated paths. Published PF2e worn items are copied whole and retain native Rule Elements, activations, usage, price, traits, and automation.
- Adds `WornMagicProfileRegistry` exposed publicly as `game.pf2eItemForge.wornMagicProfiles`.
- Adds six reviewed core homebrew profile families for footwear, eyepieces, belts, cloaks, masks, and circlets, each with a coherent level/price/effect progression.
- Generated worn items use a slot-matched indexed PF2e item only as a structural implementation template; published Rule Elements and descriptions are removed before the Item Forge profile is applied.
- Generated worn abilities deliberately use `rules-text` automation plus structured `flags.pf2e-item-forge.wornItem` metadata rather than guessed PF2e Rule Elements.
- Compendium indexing now recognizes PF2e worn usage in both human-readable and slug-like forms and records a normalized worn-usage category. Spellhearts and non-worn held/affixed items remain excluded from this family.
- Adds embedded-editor controls, preview fields, German/English localization, canonical request hydration, capability metadata, and source/template provenance for worn items.
- Extends live Magic diagnostics with predefined and generated worn-item scenarios, including usage and invested/magical trait checks.
- Automated suite now contains 188 passing tests.

## 0.0.22

- Adds a shared generation-result contract so API consumers receive consistent `contentSources`, `templateSource`, and `automation.level` metadata across generators.
- Separates provenance flags: persisted items always record `createdByForge: true`, while copied published items preserve `generated: false` and true Item-Forge compositions remain `generated: true`.
- Generic predefined-item selection now also marks copied source items as non-generated.
- Expands live Magic diagnostics to cover generated specific weapons, armor, and shields in addition to predefined paths, and validates actual level, price, traits, `system.specific`, and shield durability shapes.
- Adds a composed-equipment runtime price audit and warning state to the live diagnostics.
- The Embedded Editor now prepares a temporary, non-persisted PF2e Item for derived preview values such as rune-adjusted price.
- Compendium indexing failures are retained as structured `packErrors`, exposed through the API, and surfaced as a diagnostic contract failure.
- Specific-shield rarity now uses max-rarity semantics so a profile can never lower the rarity of its base shield.
- Adds localized errors for all specific-shield generation failure codes and updates the supported-magic-category copy to include shields.
- Tightens custom-profile automation contracts: generated special wands and generated specific weapon/armor/shield profiles cannot claim native PF2e automation without a verified builder.
- Tightens specific-shield reinforcing-rune validation. Values must match the canonical 0–6 progression and minimum rune level; non-zero reinforcing runes are currently rejected when a profile supplies explicit final durability, preventing unverified double-scaling.
- Removes stale PF2e-v13-style `system.specific.value` wording from current architecture documentation and documents the PF2e-v14 non-null baseline-object model.
- Automated suite now contains 172 passing tests.

## 0.0.21

- Adds dedicated `magic.shield` support with `SpecificMagicShieldGenerator`.
- Adds predefined specific-shield copying that preserves complete native PF2e data and generated shield profiles with explicit Hardness, HP, Broken Threshold, price, theme, and special ability.
- Adds public `game.pf2eItemForge.specificShieldProfiles` registry and three initial homebrew families: restorative shield, elemental bastion shield, and guardian bulwark shield.
- Extends compendium indexing and preview metadata with shield durability and reinforcing-rune data.
- Extends the live Magic diagnostics to predefined specific shields.
- Automated suite contains 159 passing tests.

## 0.0.20

- Introduces `CandidateLevelResolver`, `SpellCandidateService`, and `MagicItemTemplateResolver` to centralize level policy, spell eligibility/heightening, and implementation-template resolution.
- Separates selected content sources from structural PF2e implementation templates in magic-item metadata.
- Adds explicit `native` versus `rules-text` automation metadata.
- Adds live Foundry/PF2e Magic diagnostics using temporary, non-persisted Item construction.
- Makes spell casting-time parsing more defensive and updates generated Spellheart rules text for the PF2e cantrip statistic override.
- Reads world default settings dynamically per request and updates documentation for the hardened magic architecture.
- Automated suite contains 152 passing tests.

## 0.0.19

- Fixed detection of predefined PF2e v14 specific magic weapons and armor. PF2e v14 stores `system.specific` as a non-null baseline data object rather than `{ value: true }`.
- Preserved backwards compatibility with the older boolean / `{ value: boolean }` marker shapes.
- Generated specific weapons, armor, and generated staves now write PF2e-v14-style baseline `material` and `runes` data into `system.specific`.
- Added regression coverage for the live PF2e v14 specific-item data shape.

## 0.0.18

- Adds dedicated `magic.weapon` and `magic.armor` categories for specific magic weapons and armor.
- Adds `SpecificMagicEquipmentGenerator` with separate predefined and generated paths.
- Predefined specific items are copied whole from configured compendia, preserving native PF2e Rule Elements, activations, runes, descriptions, price, rarity, and other system data.
- Generated specific items start from a mundane compatible base weapon or armor and apply one validated `SpecificItemProfile` containing item level, price, fundamental runes, optional profile-owned property runes, theme, and one coherent special ability.
- Generated items are marked with `system.specific.value = true`; fundamental runes remain normal PF2e runes, while property runes can only come from the selected specific-item profile.
- Adds public `game.pf2eItemForge.specificItemProfiles` registry and capability metadata for external profile packs.
- Adds four initial generated profile families: retributive weapon, elemental resonance weapon, elemental ward armor, and guardian-reaction armor.
- Elemental resonance weapons demonstrate profile-owned property runes by binding the matching flaming/frost/shock/corrosive rune without exposing the generic property-rune editor.
- Custom special abilities are deliberately stored as rules text plus structured Item Forge metadata instead of guessed PF2e Rule Elements; published items remain the native-automation path.
- Compendium indexing now distinguishes specific magic weapons/armor from normal bases, and composed-equipment generation explicitly ignores `system.specific.value: true`.
- Embedded editor adds predefined/generated selection, profile/theme controls, specific-item preview details, and physical-only source selection where no spell pool is needed.
- Adds registry validation, classification, request/API contract, deterministic generation, predefined-preservation, rune-locking, and editor regression tests.
- Automated suite now contains 136 passing tests.

## 0.0.17

- Adds profile-driven special wand generation beside standard PF2e spell wands.
- Adds public `WandProfileRegistry` with reaching, legerdemain, and mercy profiles based on generic special-wand patterns.
- Special wand profiles validate their own level/price progression and spell compatibility, including damage, casting-action, and forbidden-trait constraints.
- Adds `magic.wandMode` and `magic.wandProfile` to the canonical request contract and embedded editor.
- Stores custom wand additions as explicit rules text plus structured Item Forge metadata while retaining a real embedded spell.
- Automated suite contains 124 passing tests.
## 0.0.16

- Adds custom Spellheart generation beside the existing full-copy path for published PF2e Spellhearts.
- Adds public `SpellheartProfileRegistry` and four coherent core profile families: elemental conduit, sonic resonator, void fang, and vitality/healing feather.
- Each profile keeps armor benefit, weapon benefit, item-level progression, price, spell statistics, themes, and daily spell ranks together as one validated balance unit instead of mixing arbitrary effect fragments.
- Generated Spellhearts select a themed cantrip plus profile-required daily spells from the configured spell compendia.
- Supports meaningful spell heightening using actual indexed heightening data and explicitly prevents down-ranking higher-rank spells.
- Adds `magic.spellheartMode` (`existing` / `generated`) and `magic.spellheartProfile` to the canonical request contract, public capabilities API, and Embedded Item Forge Editor.
- Generated Spellhearts use an indexed PF2e Spellheart only as a structural equipment template and remove its original slug, description, and Rule Elements before composition, preventing unrelated published automation from leaking into custom items.
- Generated armor/weapon benefits are rendered as rules text and stored with complete structured Spellheart metadata in `flags.pf2e-item-forge.spellheart`; predefined Spellhearts continue to preserve native PF2e automation unchanged.
- Adds German/English UI and preview data for profile, generation mode, variant, spell DC/attack, attachment effects, and selected spells.
- Adds registry validation and integration/regression coverage for custom profile generation, scaling, heightening, no-down-ranking, deterministic seeds, canonical request hydration, and public capability metadata.
- Automated suite now contains 118 passing tests.

## 0.0.15

- Adds the dedicated `magic.spellheart` category and `SpellheartGenerator`.
- Classifies PF2e equipment carrying the `spellheart` trait as spellhearts while retaining its ordinary equipment classification.
- Spellheart generation selects a complete predefined item from the configured compendia and preserves its descriptions, armor/weapon benefits, activations, rules, price, rarity, and other native PF2e data.
- Supports exact/interval item-level constraints, all standard level policies, rarity filters, source-pack filters, and deterministic seeds for spellheart selection.
- Spellheart generation does not request spell-only compendia because published spellhearts already contain their own activations.
- Embedded editor adds Spellheart as a magic category and explains why the current implementation preserves complete predefined spellhearts rather than synthesizing incomplete custom effects.
- Preview identifies Spellheart correctly as the magic item kind and continues to show its full enriched description and price.
- Public capability metadata now includes `spellheart` in `magicItemKinds`.
- Adds spellheart classification, generator, API, editor, localization, deterministic selection, and level-policy regression coverage.
- Automated suite now contains 109 passing tests.

## 0.0.14

- Preview now displays the PF2e price for every generated or selected item type, including predefined items, composed equipment, scrolls, wands, staves, and treasure.
- Supports platinum, gold, silver, and copper price structures and localized coin abbreviations.
- Adds price-formatting regression coverage.

## 0.0.13

- Replaces the universal generated-staff level ladder with rulebook-style staff families.
- Adds core family profiles `3 → 8 → 12`, `4 → 8 → 12`, and `6 → 10 → 14`; each stronger variant inherits all earlier spells and adds only its own configured spell ranks.
- Adds `magic.staffMode`: generated thematic family or predefined staff selection.
- Predefined staff selection clones an actual staff from the selected compendia without replacing its spell list, special abilities, runes, price, or native PF2e data.
- Adds `magic.staffProfile` and a public `StaffProfileRegistry`, so additional family progressions can be registered without changing `StaffGenerator`.
- Generated staff families use deterministic per-tier RNG streams, keeping lower-tier spell choices stable when the same seed is used to generate stronger variants.
- Heightened repetitions remain legal only when the spell has real interval/fixed heightening data for that rank.
- Fixes `getMeaningfulSpellRanks()` so a spell above the requested maximum rank is never silently down-ranked into a lower staff/scroll/wand slot.
- Generated staves are marked as specific magic weapons and store a structured variant-family manifest in Item Forge flags.
- Embedded editor adds staff-generation mode and family-profile controls; preview shows generation path, profile, and selected variant.
- Adds staff-family registry, inheritance, predefined-staff preservation, heightening, deterministic-family, and no-down-ranking regression coverage.
- Automated suite now contains 99 passing tests.

## 0.0.12

- Adds a new `magic` generation mode for generated spell-bound permanent magic items.
- Adds `magic.wand` generation using PF2e's rank-specific generic wand templates and a real embedded spell.
- Wand spells exclude cantrips, focus spells, and rituals, and may be heightened only to ranks supported by the spell's actual heightening data.
- Adds `magic.staff` generation using a real PF2e staff weapon base plus a thematic multi-rank spell manifest.
- Generated staves can include cantrips and may repeat a spell at higher ranks only when that spell supports the selected heightened rank.
- Adds data-driven magic themes for fire, cold, electricity, healing, illusion, mental, vitality, void, arcane, divine, occult, primal, and summoning.
- Adds `magic.theme` and `magic.allowHeightened` to the canonical request schema and embedded editor.
- Extends the source picker so spell compendiums are available for magic-item generation without making spells directly generatable items.
- Adds magic-item category hierarchy (`magic`, `magic.wand`, `magic.staff`) and public capability metadata for supported magic themes/item kinds.
- Extends previews with contained spell, staff spell list, spell ranks, heightening information, theme, and highest staff spell rank.
- Stores generated staff spell manifests in `flags.pf2e-item-forge.staff` and renders enriched spell links into the description for immediate inspection/use.
- Keeps custom staff spell storage deliberately Item-Forge-owned until the PF2e live-system contract for native custom-staff preparation/casting automation is verified.
- Adds integration/regression coverage for wand embedding, legal heightening, magic themes, staff profiles, staff spell-list generation, deterministic seeds, unsupported levels, base-template failures, category classification, request hydration, and localization.
- Automated suite now contains 92 passing tests.

## 0.0.11

- Fixed treasure-type labels for books: the selector now shows concrete types such as Chronik, Atlas, Bestiarium, Kochbuch, and Manuskript instead of repeated "Buch" entries.
- Fixed beverage treasure-type labels: Wein, Bier, Met, Spirituose, and Obstwein are now shown explicitly instead of repeated "alkoholisches Getränk" entries.
- Embedded editor re-renders now preserve parameter/preview scroll positions, expanded details sections, and focus where possible. Selecting a treasure type no longer jumps the parameter panel back to the top.
- Added regression coverage for distinct core book/beverage labels and scroll-preserving dependent-field re-renders.

## 0.0.10

- Deepens the TreasureGenerator content library and valuation behavior while keeping one treasure per engine request.
- Expands the built-in library to 82 treasure types, 45 materials, 17 reusable components, 18 motifs, 16 conditions, 6 craftsmanship levels, and 12 styles.
- Adds new art objects, textiles, jewelry, tableware, ceremonial objects, luxury goods, book subjects, cider, and additional beverage variants.
- Adds additional precious/decorative materials including electrum, rosewood, vellum, mother-of-pearl, amber, turquoise, moonstone, topaz, aquamarine, and diamond.
- Adds material-aware conditions including patina, fading, smoke/water staining, cracking, worm damage, and restoration.
- Adds more reusable treasure components such as inlay, filigree, enamel, lacquer, embroidery, book clasps, inscriptions, signatures, and maker marks.
- Adds type-specific condition/craftsmanship/motif weighting and style-level condition weighting for more coherent treasure families.
- Makes candidate construction mildly target-aware so value solving preferentially explores treasure types/materials/workmanship and component density appropriate to the requested value while retaining bounded random generation.
- Expands book generation with edition and completeness, and beverage generation with origin, quality, vessel, age, and broader variety.
- Adds type-specific Bulk for large art objects and other treasure instead of treating every generated treasure as light Bulk.
- Adds reproducible Item Forge flags and a full valuation breakdown to generated treasure Item sources.
- Preview now surfaces generated treasure detail attributes such as edition, completeness, vessel, age, quality, and origin.
- Improves German treasure-name/description grammar and singular gemstone-setting text.
- Extends registration validation for treasure type weight maps and Bulk.
- Automated suite now contains 78 passing tests, including new depth, condition compatibility, metadata, weighting, and Bulk regressions.

## 0.0.9

- Hardens the public request contract: `normalize()`, `validate()`, `generate()`, and the embedded editor now share one canonical hydration/default path.
- Fixes `ItemForgeEditor.setRequest()` so partial requests from embedding modules receive all required defaults instead of depending on the standalone Item Forge container.
- Adds priority-based `GeneratorRegistry` resolution and dynamically registered generation modes, allowing specialist/extension generators to override broad core generators without registration-order tricks.
- Adds priority metadata as the additive `generatorMetadata` field in `getCapabilities()` while preserving the existing `generators` ID list.
- Adds optional exact treasure-type selection beneath broad treasure categories (for example a specific ring, tiara, book type, or art object).
- Adds registration-time validation for treasure types, materials, components, conditions, craftsmanship, motifs, and styles; invalid ranges and missing references now fail early.
- Adds optional category validation for treasure types when the Item Forge CategoryRegistry is available.
- Makes treasure styles influence generation weights for materials, motifs, craftsmanship, type tags, and component frequency rather than acting only as a price label.
- Makes component workmanship coherent with the parent object through `inherit`, `near-parent`, `independent`, and `none` craftsmanship modes.
- Uses gemstone material `componentValue` ranges for gemstone settings/inlays instead of leaving that data unused.
- Fixes the known German tapestry-name grammar regression.
- Adds API, engine-contract, GeneratorRegistry, embedded-editor, application-container, registry-validation, exact-treasure-type, style-weighting, component-coherence, and gemstone-valuation regression tests.
- Automated suite now contains 70 passing tests.

## 0.0.8

- Adds the first full `TreasureGenerator` implementation for non-functional sale treasure.
- Generates one treasure item per engine request with target value/range, material, craftsmanship, condition, motif, style, and bounded ValueSolver attempts.
- Adds 45 built-in treasure types including jewelry, paintings, sculpture, tableware, ceremonial/luxury goods, books, gemstones, and alcoholic beverages in bottles/jugs/amphorae/small casks.
- Adds registry-driven materials, components, motifs, conditions, craftsmanship levels, and styles.
- Material, craftsmanship, condition, attributes, and optional components affect sale value.
- Adds generated descriptions, PF2e `treasure` Item sources, detailed preview metadata, and statistical variety tests.

## 0.0.7

- Adds a dedicated `ScrollGenerator` for `consumable.scroll` requests.
- Scrolls now contain an actual spell instead of returning an empty generic scroll template.
- Excludes cantrips, focus spells, and rituals from normal scroll generation.
- Selects the scroll rank through the PF2e scroll templates so the generated scroll's item level and spell rank remain aligned.
- Supports meaningful spell heightening: interval-heightened spells may use their valid interval ranks, fixed-heightened spells may use their defined ranks, and spells without heightening data remain at their base rank.
- Embeds the selected spell into `system.spell` with the chosen heightened rank, matching the current PF2e spell-consumable data model.
- Uses the contained spell's rarity and adds the spell reference to the generated scroll description.
- Generic scroll templates are no longer eligible for broad predefined-item generation unless a spell has first been attached by the dedicated generator.
- Spell-only Item compendiums are offered in the source picker when the Scroll category is selected, while remaining hidden for ordinary item generation.
- The preview panel now displays the item's enriched description text for all generated items.
- Scroll previews additionally show contained spell, spell rank, and whether it was heightened.
- Adds German and English localization for scroll generation, spell source counts, and description preview.
- Adds regression/integration tests for scroll embedding, legal heightening ranks, excluded spell types, determinism, and generic-scroll suppression.
- Automated suite now contains 40 passing tests.

## 0.0.6

- Fixes generic Item Forge generation incorrectly treating every Foundry `Item` document as a supported physical item.
- Feats, spells, actions, effects, conditions, class/ancestry/background documents, NPC melee actions, and other non-item rule documents are now excluded from the generation index.
- Adds an explicit allowlist for supported physical PF2e item document types.
- Maps PF2e backpacks, books, and kits into the general equipment category so they remain available as ordinary predefined items.
- Compendium source selection now hides Item compendiums that contain no supported physical items, reducing noise from spell- and feat-only packs.
- Adds regression tests proving that feats and spells cannot be selected even through the broad `item` category.

## 0.0.5

- Adds property-rune generation for composed weapons and armor.
- Adds automatic, random, fixed-selection, and disabled property-rune modes.
- Enforces property-rune slot limits from the potency rune; shields remain property-rune-free.
- Adds compatibility filtering for melee/ranged weapons, weapon groups, damage types, traits, and armor categories.
- Includes property-rune levels in effective item-level resolution so strict level requests remain hard constraints.
- Adds an extensible public property-rune registry at `game.pf2eItemForge.propertyRunes`.
- Extends the compendium index with weapon/armor metadata needed for rune compatibility.
- Extends the embedded editor and preview with property-rune controls, fixed rune selection, capacity, levels, and rarity.
- Adds German and English localization for the new property-rune UI and validation errors.
- Adds regression coverage for incompatible fixed runes, level bridging, deterministic random rune selection, armor restrictions, and external rune registration.
- Automated suite now contains 33 passing tests.

## 0.0.4

- Adds a second generation mode for composing weapons, armor, and shields from mundane compendium base items.
- Adds canonical Remaster fundamental-rune profiles for weapons and armor plus reinforcing-rune profiles for shields.
- Adds `ItemLevelResolver` and strict level validation based on the highest relevant component level.
- Adds property-rune capacity calculation in preparation for the next property-rune block.
- Extends the embedded editor with generation-mode and fundamental-rune controls.
- Extends preview data with the selected base item, rune summary, effective level, and property-rune slots.
- Extends the compendium index with rune, specific-item, base-item, slug, and material metadata.
- Adds localized generator errors and new German/English UI labels.
- Expands automated coverage for rune profiles, level resolution, deterministic equipment generation, armor, weapons, and shields.

## 0.0.3

- Korrigiert die Foundry-v14-Lokalisierungsdateien auf die erwartete verschachtelte JSON-Struktur.
- Entfernt kollidierende Kategorie-Lokalisierungspfade und verwendet stabile, eindeutige Kategorie-Label-Keys.
- Lokalisiert den ApplicationV2-Fenstertitel explizit.
- Lokalisiert den Tooltip zum Aktualisieren des Kompendienindex explizit.
- Ergänzt Regressionstests für die vollständige deutsche und englische Lokalisierung.

## 0.0.2

- Fixed the Item Forge button not appearing in the Foundry v14 Item Directory.
- Item-directory detection now uses the v14 `documentName` API and supports PF2e subclasses instead of relying on the exact constructor name.
- The public API is now exposed during `init`, so an Item Directory rendered before `ready` can already receive a working button.
- Added a generic ApplicationV2 render fallback and an explicit post-ready injection for an already-rendered Item Directory.
- Fixed module-setting labels, hints, and choices showing localization IDs by resolving them when settings are registered.

## 0.0.1

- Initial module scaffold for Foundry VTT v14 / PF2e.
- Added public Item Forge API and reusable engine.
- Added hierarchical category registry and compendium index.
- Added compendium source selection and level constraints.
- Added deterministic seeded generation of existing compendium items.
- Added embedded ApplicationV2 Item Forge Editor and standalone container.
- Added preview, reroll, Item Directory integration, and world-item creation.
- Added extensible treasure registries and generic bounded ValueSolver.
- Added German/English localization and automated test suite.
