import { MODULE_ID } from "../constants.js";
import { createSeed } from "../engine/seeded-rng.js";
import { hydrateEditorRequest } from "../engine/request-normalizer.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : structuredClone(value);
}

function localizeMaybe(key) {
  const localized = game.i18n.localize(key);
  return localized === key ? key : localized;
}

/** Prepare an in-memory PF2e document so derived values such as rune-adjusted price can be previewed. */
export function prepareRuntimePreviewItem(itemSource) {
  if (!itemSource) return null;
  try {
    const ItemClass = globalThis.CONFIG?.Item?.documentClass;
    if (!ItemClass) return null;
    return new ItemClass(clone(itemSource), { parent: null });
  } catch (error) {
    console.warn("PF2E Item Forge | Could not prepare runtime preview item", error);
    return null;
  }
}

/** Format a PF2e physical-item price for the preview without creating a persisted document. */
export function formatItemPrice(itemSource, fallbackGp = null) {
  const raw = itemSource?.system?.price?.value;

  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return `${raw} ${localizeMaybe("PF2E_ITEM_FORGE.Currency.GP")}`;
  }

  if (raw && typeof raw === "object") {
    const labels = {
      pp: localizeMaybe("PF2E_ITEM_FORGE.Currency.PP"),
      gp: localizeMaybe("PF2E_ITEM_FORGE.Currency.GP"),
      sp: localizeMaybe("PF2E_ITEM_FORGE.Currency.SP"),
      cp: localizeMaybe("PF2E_ITEM_FORGE.Currency.CP")
    };
    const parts = ["pp", "gp", "sp", "cp"]
      .map((coin) => [coin, Number(raw[coin] ?? 0)])
      .filter(([, amount]) => Number.isFinite(amount) && amount !== 0)
      .map(([coin, amount]) => `${amount} ${labels[coin]}`);
    if (parts.length) return parts.join(" ");

    // A present, but empty/zero, coin structure is a legitimate free item.
    if (["pp", "gp", "sp", "cp"].some((coin) => Object.hasOwn(raw, coin)) || Object.keys(raw).length === 0) {
      return `0 ${labels.gp}`;
    }
  }

  const fallback = Number(fallbackGp);
  return Number.isFinite(fallback) ? `${fallback} ${localizeMaybe("PF2E_ITEM_FORGE.Currency.GP")}` : null;
}

async function enrichHtml(html) {
  if (!html) return "";
  const implementation = globalThis.foundry?.applications?.ux?.TextEditor?.implementation
    ?? globalThis.TextEditor?.implementation
    ?? globalThis.TextEditor;
  if (typeof implementation?.enrichHTML !== "function") return html;
  try {
    return await implementation.enrichHTML(html, { async: true });
  } catch (error) {
    console.warn("PF2E Item Forge | Could not enrich preview description", error);
    return html;
  }
}

export class ItemForgeEditor extends HandlebarsApplication {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-editor-{id}`,
    classes: [MODULE_ID, "item-forge-editor"],
    window: { frame: false },
    position: { width: "auto", height: "auto" }
  };

  static PARTS = {
    editor: { template: `modules/${MODULE_ID}/templates/item-forge-editor.hbs` }
  };

  constructor({ api, request = {}, onChange = null, onPreview = null, ...options } = {}) {
    const uniqueId = globalThis.foundry?.utils?.randomID?.(8) ?? Math.random().toString(36).slice(2, 10);
    super({ id: `${MODULE_ID}-editor-${uniqueId}`, ...options });
    this.api = api;
    this.request = this.#hydrateRequest(request);
    this.#ensureModeCategory();
    this.previewResult = null;
    this.error = null;
    this.busy = false;
    this.onChange = onChange;
    this.onPreview = onPreview;
  }

  getRequest() {
    const request = clone(this.request);
    delete request.levelMode;
    return request;
  }

  setRequest(request) {
    this.request = this.#hydrateRequest(request);
    this.#ensureModeCategory();
    this.previewResult = null;
    this.error = null;
    return this.render();
  }

  getPreview() {
    return this.previewResult;
  }

  clearPreview() {
    this.previewResult = null;
    this.error = null;
    return this.render();
  }

  async generatePreview() {
    this.#syncFromDom();
    this.busy = true;
    this.error = null;
    await this.render();
    try {
      this.previewResult = await this.api.preview(this.getRequest());
      this.onPreview?.(this.previewResult, this);
      return this.previewResult;
    } catch (error) {
      console.error("PF2E Item Forge | Preview failed", error);
      const code = error.code ?? "GENERATION_FAILED";
      const errorKey = {
        NO_BASE_EQUIPMENT: "PF2E_ITEM_FORGE.Errors.NoBaseEquipment",
        UNSUPPORTED_EQUIPMENT_CATEGORY: "PF2E_ITEM_FORGE.Errors.UnsupportedEquipmentCategory",
        NO_ITEM_IN_LEVEL_RANGE: "PF2E_ITEM_FORGE.Errors.NoItemInLevelRange",
        ITEM_DOCUMENT_NOT_FOUND: "PF2E_ITEM_FORGE.Errors.ItemDocumentNotFound",
        INVALID_PROPERTY_RUNE_SELECTION: "PF2E_ITEM_FORGE.Errors.InvalidPropertyRuneSelection",
        NO_SCROLL_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoScrollSpellCandidate",
        SPELL_DOCUMENT_NOT_FOUND: "PF2E_ITEM_FORGE.Errors.SpellDocumentNotFound",
        UNSUPPORTED_MAGIC_CATEGORY: "PF2E_ITEM_FORGE.Errors.UnsupportedMagicCategory",
        NO_WAND_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoWandSpellCandidate",
        NO_SPECIAL_WAND_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoSpecialWandSpellCandidate",
        UNKNOWN_WAND_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownWandProfile",
        NO_STAFF_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoStaffSpellCandidate",
        NO_STAFF_BASE_ITEM: "PF2E_ITEM_FORGE.Errors.NoStaffBaseItem",
        NO_PREDEFINED_STAFF_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedStaffCandidate",
        NO_PREDEFINED_SPELLHEART_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedSpellheartCandidate",
        NO_SPELLHEART_TEMPLATE: "PF2E_ITEM_FORGE.Errors.NoSpellheartTemplate",
        NO_SPELLHEART_SPELL_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoSpellheartSpellCandidate",
        UNKNOWN_SPELLHEART_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownSpellheartProfile",
        NO_PREDEFINED_SPECIFIC_ITEM_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedSpecificItemCandidate",
        NO_SPECIFIC_BASE_ITEM: "PF2E_ITEM_FORGE.Errors.NoSpecificBaseItem",
        NO_SPECIFIC_PROFILE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoSpecificProfileCandidate",
        UNKNOWN_SPECIFIC_ITEM_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownSpecificItemProfile",
        NO_PREDEFINED_SPECIFIC_SHIELD_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedSpecificShieldCandidate",
        NO_SPECIFIC_SHIELD_BASE_ITEM: "PF2E_ITEM_FORGE.Errors.NoSpecificShieldBaseItem",
        NO_SPECIFIC_SHIELD_PROFILE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoSpecificShieldProfileCandidate",
        UNKNOWN_SPECIFIC_SHIELD_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownSpecificShieldProfile",
        NO_PREDEFINED_WORN_ITEM_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedWornItemCandidate",
        NO_WORN_ITEM_PROFILE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoWornItemProfileCandidate",
        NO_WORN_ITEM_TEMPLATE: "PF2E_ITEM_FORGE.Errors.NoWornItemTemplate",
        INVALID_WORN_ITEM_TEMPLATE_TYPE: "PF2E_ITEM_FORGE.Errors.InvalidWornItemTemplateType",
        WORN_ITEM_TEMPLATE_USAGE_MISMATCH: "PF2E_ITEM_FORGE.Errors.WornItemTemplateUsageMismatch",
        UNKNOWN_WORN_ITEM_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownWornItemProfile",
        NO_PREDEFINED_HELD_ITEM_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoPredefinedHeldItemCandidate",
        NO_HELD_ITEM_PROFILE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoHeldItemProfileCandidate",
        NO_HELD_ITEM_TEMPLATE: "PF2E_ITEM_FORGE.Errors.NoHeldItemTemplate",
        INVALID_HELD_ITEM_TEMPLATE_TYPE: "PF2E_ITEM_FORGE.Errors.InvalidHeldItemTemplateType",
        HELD_ITEM_TEMPLATE_USAGE_MISMATCH: "PF2E_ITEM_FORGE.Errors.HeldItemTemplateUsageMismatch",
        UNKNOWN_HELD_ITEM_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownHeldItemProfile",
        NO_ACCESSORY_RUNE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoAccessoryRuneCandidate",
        UNKNOWN_ACCESSORY_RUNE: "PF2E_ITEM_FORGE.Errors.UnknownAccessoryRune",
        ACCESSORY_RUNE_BASE_INVESTED: "PF2E_ITEM_FORGE.Errors.AccessoryRuneBaseInvested",
        ACCESSORY_RUNE_BASE_MAGIC_NOT_ALLOWED: "PF2E_ITEM_FORGE.Errors.AccessoryRuneBaseMagicNotAllowed",
        ACCESSORY_RUNE_ALREADY_PRESENT: "PF2E_ITEM_FORGE.Errors.AccessoryRuneAlreadyPresent",
        ACCESSORY_RUNE_USAGE_MISMATCH: "PF2E_ITEM_FORGE.Errors.AccessoryRuneUsageMismatch",
        UNKNOWN_STAFF_PROFILE: "PF2E_ITEM_FORGE.Errors.UnknownStaffProfile",
        UNSUPPORTED_TREASURE_CATEGORY: "PF2E_ITEM_FORGE.Errors.UnsupportedTreasureCategory",
        NO_TREASURE_TYPE: "PF2E_ITEM_FORGE.Errors.NoTreasureType",
        NO_TREASURE_CANDIDATE: "PF2E_ITEM_FORGE.Errors.NoTreasureCandidate",
        UNKNOWN_TREASURE_CONTENT: "PF2E_ITEM_FORGE.Errors.UnknownTreasureContent"
      }[code];
      this.error = { code, message: errorKey ? localizeMaybe(errorKey) : error.message };
      this.previewResult = null;
      throw error;
    } finally {
      this.busy = false;
      await this.render();
    }
  }

  async reroll() {
    this.#syncFromDom();
    this.request.seed = createSeed();
    return this.generatePreview();
  }

  validate() {
    this.#syncFromDom();
    return this.api.validate(this.getRequest());
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selectedPacks = new Set(this.request.source.includePacks ?? []);
    const rarity = new Set(this.request.rarity ?? []);
    this.#ensureModeCategory();

    const wornSlotCapabilities = this.api.getWornSlotCapabilities?.() ?? this.api.getCapabilities?.().wornSlots ?? [];
    const wornCapabilityBySlot = new Map(wornSlotCapabilities.map((entry) => [entry.id, entry]));
    const wornModeForCategories = this.request.magic?.wornMode ?? "existing";
    const selectedWornSlotForCategories = String(this.request.category ?? "").startsWith("magic.worn.")
      ? String(this.request.category).slice("magic.worn.".length)
      : null;
    if (this.request.mode === "magic" && selectedWornSlotForCategories) {
      const capability = wornCapabilityBySlot.get(selectedWornSlotForCategories);
      if (capability && !capability[wornModeForCategories]) this.request.category = "magic.worn";
    }

    const categories = this.api.categories.getAll()
      .filter((category) => {
        if (this.request.mode === "equipment") return this.#isEquipmentCategory(category.id);
        if (this.request.mode === "treasure") return this.#isTreasureCategory(category.id);
        if (this.request.mode === "magic") return this.#isMagicCategory(category.id);
        return true;
      })
      .map((category) => {
        const depth = this.api.categories.getAncestors(category.id).length;
        const slot = category.id.startsWith?.("magic.worn.") ? category.id.slice("magic.worn.".length) : null;
        const capability = slot ? wornCapabilityBySlot.get(slot) : null;
        const disabled = Boolean(capability && this.request.mode === "magic" && !capability[wornModeForCategories]);
        let availabilitySuffix = "";
        if (disabled) {
          const key = wornModeForCategories === "generated" && capability.existing
            ? "PF2E_ITEM_FORGE.WornAvailability.PredefinedOnly"
            : wornModeForCategories === "existing" && capability.generated
              ? "PF2E_ITEM_FORGE.WornAvailability.GeneratedOnly"
              : "PF2E_ITEM_FORGE.WornAvailability.Unavailable";
          availabilitySuffix = ` ${localizeMaybe(key)}`;
        }
        return {
          id: category.id,
          label: `${"  ".repeat(depth)}${localizeMaybe(category.label)}${availabilitySuffix}`,
          selected: category.id === this.request.category,
          disabled
        };
      });

    const isScrollCategory = this.request.mode === "existing" && this.request.category === "consumable.scroll";
    const isMagicMode = this.request.mode === "magic";
    const isSpellheartCategory = isMagicMode && this.request.category === "magic.spellheart";
    const generatedSpellheart = isSpellheartCategory && this.request.magic?.spellheartMode === "generated";
    const isWandCategory = isMagicMode && this.request.category === "magic.wand";
    const isStaffCategory = isMagicMode && this.request.category === "magic.staff";
    const generatedStaff = isStaffCategory && this.request.magic?.staffMode !== "existing";
    const isSpecificWeaponCategory = isMagicMode && this.request.category === "magic.weapon";
    const isSpecificArmorCategory = isMagicMode && this.request.category === "magic.armor";
    const isSpecificShieldCategory = isMagicMode && this.request.category === "magic.shield";
    const isSpecificMagicCategory = isSpecificWeaponCategory || isSpecificArmorCategory || isSpecificShieldCategory;
    const generatedSpecific = isSpecificMagicCategory && this.request.magic?.specificMode === "generated";
    const isWornMagicCategory = isMagicMode && (this.request.category === "magic.worn" || String(this.request.category).startsWith("magic.worn."));
    const isAccessoryRuneCategory = isMagicMode && this.request.category === "magic.accessory-rune";
    const isHeldMagicCategory = isMagicMode && (this.request.category === "magic.held" || String(this.request.category).startsWith("magic.held."));
    const generatedHeld = isHeldMagicCategory && this.request.magic?.heldMode === "generated";
    const generatedWorn = isWornMagicCategory && this.request.magic?.wornMode === "generated";
    const usesSpellSources = isScrollCategory || isWandCategory || generatedStaff || generatedSpellheart;
    const packs = this.api.getAvailableItemPacks({ includeSpellPacks: usesSpellSources }).map((pack) => ({
      ...pack,
      checked: selectedPacks.has(pack.id),
      contentSummary: [
        pack.physicalCount ? `${pack.physicalCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Items")}` : null,
        pack.spellCount ? `${pack.spellCount} ${localizeMaybe("PF2E_ITEM_FORGE.Sources.Spells")}` : null
      ].filter(Boolean).join(" · ")
    }));

    const levelPolicies = ["strict", "nearest", "notAbove", "notBelow"].map((id) => ({
      id,
      selected: this.request.levelPolicy === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.LevelPolicy.${{ strict: "Strict", nearest: "Nearest", notAbove: "NotAbove", notBelow: "NotBelow" }[id]}`)
    }));
    const modeLabelKeys = { existing: "Existing", equipment: "Equipment", treasure: "Treasure", magic: "Magic" };
    const availableModes = this.api.getCapabilities?.().generationModes ?? ["existing", "equipment", "magic", "treasure"];
    const generationModes = availableModes.map((id) => ({
      id,
      selected: this.request.mode === id,
      label: modeLabelKeys[id] ? localizeMaybe(`PF2E_ITEM_FORGE.GenerationMode.${modeLabelKeys[id]}`) : id
    }));
    const fundamentalRuneModes = ["automatic", "none"].map((id) => ({
      id,
      selected: this.request.equipment?.fundamentalRunes === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.FundamentalRunes.${id === "automatic" ? "Automatic" : "None"}`)
    }));
    const propertyRuneModes = ["automatic", "random", "fixed", "none"].map((id) => ({
      id,
      selected: this.request.equipment?.propertyRunes?.mode === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.PropertyRuneMode.${{ automatic: "Automatic", random: "Random", fixed: "Fixed", none: "None" }[id]}`)
    }));
    const propertyRuneType = this.#equipmentType(this.request.category);
    const selectedPropertyRunes = new Set(this.request.equipment?.propertyRunes?.selected ?? []);
    const propertyRunes = propertyRuneType && propertyRuneType !== "shield"
      ? this.api.propertyRunes.getForItemType(propertyRuneType).map((rune) => ({
          slug: rune.slug,
          level: rune.level,
          rarity: rune.rarity,
          rarityLabel: localizeMaybe(`PF2E_ITEM_FORGE.Rarity.${{ common: "Common", uncommon: "Uncommon", rare: "Rare", unique: "Unique" }[rune.rarity] ?? "Common"}`),
          label: localizeMaybe(rune.label),
          checked: selectedPropertyRunes.has(rune.slug)
        }))
      : [];
    const sourceModes = ["all", "system", "selected"].map((id) => ({
      id,
      selected: this.request.source.mode === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.SourceMode.${{ all: "All", system: "System", selected: "Selected" }[id]}`)
    }));
    const specialWand = isWandCategory && this.request.magic?.wandMode === "special";
    const wandModes = ["standard", "special"].map((id) => ({
      id,
      selected: (this.request.magic?.wandMode ?? "standard") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.WandMode.${id === "special" ? "Special" : "Standard"}`)
    }));
    const wandProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.WandProfiles.Automatic"), selected: (this.request.magic?.wandProfile ?? "automatic") === "automatic" },
      ...((this.api.wandProfiles?.getAll?.() ?? []).map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.wandProfile === profile.id
      })))
    ];
    const staffModes = ["generated", "existing"].map((id) => ({
      id,
      selected: (this.request.magic?.staffMode ?? "generated") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.StaffMode.${id === "generated" ? "Generated" : "Existing"}`)
    }));
    const staffProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.StaffProfiles.Automatic"), selected: (this.request.magic?.staffProfile ?? "automatic") === "automatic" },
      ...((this.api.staffProfiles?.getAll?.() ?? []).map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.staffProfile === profile.id
      })))
    ];
    const spellheartModes = ["generated", "existing"].map((id) => ({
      id,
      selected: (this.request.magic?.spellheartMode ?? "existing") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.SpellheartMode.${id === "generated" ? "Generated" : "Existing"}`)
    }));
    const spellheartProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.SpellheartProfiles.Automatic"), selected: (this.request.magic?.spellheartProfile ?? "automatic") === "automatic" },
      ...((this.api.spellheartProfiles?.getAll?.() ?? []).map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.spellheartProfile === profile.id,
        themes: [...(profile.allowedThemes ?? [])]
      })))
    ];
    const activeSpellheartProfile = generatedSpellheart && this.request.magic?.spellheartProfile !== "automatic"
      ? this.api.spellheartProfiles?.get?.(this.request.magic.spellheartProfile)
      : null;
    const allowedSpellheartThemes = activeSpellheartProfile ? new Set(["automatic", ...(activeSpellheartProfile.allowedThemes ?? [])]) : null;
    const magicThemes = (this.api.magicThemes ?? [])
      .filter((theme) => !allowedSpellheartThemes || allowedSpellheartThemes.has(theme.id))
      .map((theme) => ({
        id: theme.id,
        label: localizeMaybe(theme.label),
        selected: this.request.magic?.theme === theme.id
      }));
    if (allowedSpellheartThemes && !allowedSpellheartThemes.has(this.request.magic?.theme)) this.request.magic.theme = "automatic";

    const specificModes = ["existing", "generated"].map((id) => ({
      id,
      selected: (this.request.magic?.specificMode ?? "existing") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.SpecificItemMode.${id === "existing" ? "Existing" : "Generated"}`)
    }));
    const specificItemType = isSpecificWeaponCategory ? "weapon" : isSpecificArmorCategory ? "armor" : isSpecificShieldCategory ? "shield" : null;
    const specificProfileRegistry = isSpecificShieldCategory ? this.api.specificShieldProfiles : this.api.specificItemProfiles;
    const availableSpecificProfiles = isSpecificShieldCategory
      ? (specificProfileRegistry?.getAll?.() ?? [])
      : specificItemType ? (specificProfileRegistry?.getForItemType?.(specificItemType) ?? []) : [];
    if (generatedSpecific && this.request.magic?.specificProfile !== "automatic" && !availableSpecificProfiles.some((profile) => profile.id === this.request.magic.specificProfile)) {
      this.request.magic.specificProfile = "automatic";
    }
    const specificProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.SpecificItemProfiles.Automatic"), selected: (this.request.magic?.specificProfile ?? "automatic") === "automatic" },
      ...availableSpecificProfiles.map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.specificProfile === profile.id,
        themes: [...(profile.allowedThemes ?? [])]
      }))
    ];
    const activeSpecificProfile = generatedSpecific && this.request.magic?.specificProfile !== "automatic"
      ? specificProfileRegistry?.get?.(this.request.magic.specificProfile)
      : null;
    const supportedSpecificThemes = activeSpecificProfile
      ? new Set(["automatic", ...(activeSpecificProfile.allowedThemes ?? [])])
      : new Set(["automatic", ...availableSpecificProfiles.flatMap((profile) => profile.allowedThemes ?? [])]);
    if (generatedSpecific && !supportedSpecificThemes.has(this.request.magic?.theme)) this.request.magic.theme = "automatic";
    const specificMagicThemes = (this.api.magicThemes ?? [])
      .filter((theme) => supportedSpecificThemes.has(theme.id))
      .map((theme) => ({
        id: theme.id,
        label: localizeMaybe(theme.label),
        selected: this.request.magic?.theme === theme.id
      }));
    const specificSupportsTheme = generatedSpecific && supportedSpecificThemes.size > 1;

    const wornModes = ["existing", "generated"].map((id) => ({
      id,
      selected: (this.request.magic?.wornMode ?? "existing") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.WornItemMode.${id === "existing" ? "Existing" : "Generated"}`)
    }));
    const requestedWornSlot = this.request.category.startsWith?.("magic.worn.")
      ? this.request.category.slice("magic.worn.".length)
      : null;
    const availableWornProfiles = requestedWornSlot
      ? (this.api.wornMagicProfiles?.getForSlot?.(requestedWornSlot) ?? [])
      : (this.api.wornMagicProfiles?.getAll?.() ?? []);
    if (generatedWorn && this.request.magic?.wornProfile !== "automatic" && !availableWornProfiles.some((profile) => profile.id === this.request.magic.wornProfile)) {
      this.request.magic.wornProfile = "automatic";
    }
    const wornProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.WornProfiles.Automatic"), selected: (this.request.magic?.wornProfile ?? "automatic") === "automatic" },
      ...availableWornProfiles.map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.wornProfile === profile.id
      }))
    ];
    const heldModes = ["existing", "generated"].map((id) => ({
      id,
      selected: (this.request.magic?.heldMode ?? "existing") === id,
      label: localizeMaybe(`PF2E_ITEM_FORGE.HeldItemMode.${id === "existing" ? "Existing" : "Generated"}`)
    }));
    const requestedHeldHands = this.request.category === "magic.held.one-hand" ? 1 : this.request.category === "magic.held.two-hands" ? 2 : null;
    const availableHeldProfiles = requestedHeldHands
      ? (this.api.heldMagicProfiles?.getForHands?.(requestedHeldHands) ?? [])
      : (this.api.heldMagicProfiles?.getAll?.() ?? []);
    if (generatedHeld && this.request.magic?.heldProfile !== "automatic" && !availableHeldProfiles.some((profile) => profile.id === this.request.magic.heldProfile)) {
      this.request.magic.heldProfile = "automatic";
    }
    const heldProfiles = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.HeldProfiles.Automatic"), selected: (this.request.magic?.heldProfile ?? "automatic") === "automatic" },
      ...availableHeldProfiles.map((profile) => ({
        id: profile.id,
        label: localizeMaybe(profile.label),
        selected: this.request.magic?.heldProfile === profile.id
      }))
    ];
    const accessoryRunes = [
      { id: "automatic", label: localizeMaybe("PF2E_ITEM_FORGE.AccessoryRunes.Automatic"), selected: (this.request.magic?.accessoryRune ?? "automatic") === "automatic" },
      ...((this.api.accessoryRunes?.getAll?.() ?? []).map((family) => ({
        id: family.id,
        label: localizeMaybe(family.label),
        usage: localizeMaybe(family.usageLabel ?? family.targetKind),
        levels: family.variants.map((variant) => variant.level).join(" / "),
        selected: this.request.magic?.accessoryRune === family.id
      })))
    ];

    const categoryTreasureTypes = this.request.mode === "treasure"
      ? this.api.treasure.types.getAll().filter((type) => this.api.categories.matches(type.categories ?? [], this.request.category))
      : [];
    if (this.request.mode === "treasure" && this.request.treasure.type !== "any" && !categoryTreasureTypes.some((type) => type.id === this.request.treasure.type)) {
      this.request.treasure.type = "any";
    }
    const matchingTreasureTypes = this.request.treasure.type !== "any"
      ? categoryTreasureTypes.filter((type) => type.id === this.request.treasure.type)
      : categoryTreasureTypes;
    const allowedMaterials = this.api.treasure.materials.getAll().filter((material) => {
      const tags = new Set(material.tags ?? []);
      return matchingTreasureTypes.some((type) => (type.materialTags ?? []).some((tag) => tags.has(tag)));
    });
    if (this.request.mode === "treasure" && this.request.treasure.material !== "any" && !allowedMaterials.some((entry) => entry.id === this.request.treasure.material)) {
      this.request.treasure.material = "any";
    }
    if (this.request.mode === "treasure" && matchingTreasureTypes.length && matchingTreasureTypes.every((type) => !type.supportsMotif)) {
      this.request.treasure.motif = "any";
    }
    if (this.request.mode === "treasure" && matchingTreasureTypes.length && matchingTreasureTypes.every((type) => type.usesCraftsmanship === false)) {
      this.request.treasure.craftsmanship = "any";
    }
    const treasureOption = (registry, selectedId, entries = registry.getAll()) => [
      { id: "any", label: localizeMaybe("PF2E_ITEM_FORGE.Treasure.Any"), selected: !selectedId || selectedId === "any" },
      ...entries.map((entry) => ({
        id: entry.id,
        label: typeof entry.label === "object" ? (entry.label[game.i18n.lang?.startsWith("de") ? "de" : "en"] ?? entry.label.en ?? entry.label.de ?? entry.id) : localizeMaybe(entry.label),
        selected: entry.id === selectedId
      }))
    ];
    const treasureTypes = treasureOption(this.api.treasure.types, this.request.treasure?.type, categoryTreasureTypes);
    const treasureMaterials = treasureOption(this.api.treasure.materials, this.request.treasure?.material, allowedMaterials);
    const treasureConditions = treasureOption(this.api.treasure.conditions, this.request.treasure?.condition);
    const treasureCraftsmanship = treasureOption(this.api.treasure.craftsmanship, this.request.treasure?.craftsmanship);
    const treasureMotifs = treasureOption(this.api.treasure.motifs, this.request.treasure?.motif);
    const treasureStyles = treasureOption(this.api.treasure.styles, this.request.treasure?.style);

    const runtimePreviewSource = this.previewResult ? prepareRuntimePreviewItem(this.previewResult.itemSource) : null;
    const preview = this.previewResult
      ? {
          name: this.previewResult.itemSource?.name,
          img: this.previewResult.itemSource?.img,
          type: this.previewResult.itemSource?.type,
          level: this.previewResult.metadata?.level,
          rarity: this.previewResult.metadata?.rarity,
          sourcePack: this.previewResult.metadata?.sourcePack,
          contentSources: this.previewResult.metadata?.contentSources ?? null,
          templateSource: this.previewResult.metadata?.templateSource ?? null,
          candidateCount: this.previewResult.metadata?.candidateCount,
          warnings: this.previewResult.warnings ?? [],
          description: await enrichHtml(this.previewResult.itemSource?.system?.description?.value ?? ""),
          spell: this.previewResult.metadata?.spell ?? null,
          spells: this.previewResult.metadata?.spells ?? [],
          spellheart: this.previewResult.metadata?.spellheart ?? null,
          wand: this.previewResult.metadata?.wand ?? null,
          automation: this.previewResult.metadata?.automation?.level
            ? {
                level: this.previewResult.metadata.automation.level,
                label: localizeMaybe(this.previewResult.metadata.automation.level === "native"
                  ? "PF2E_ITEM_FORGE.Automation.Native"
                  : "PF2E_ITEM_FORGE.Automation.RulesText")
              }
            : null,
          specificItem: this.previewResult.metadata?.specificItem
            ? {
                ...this.previewResult.metadata.specificItem,
                runeSummary: this.#formatRuneSummary(this.previewResult.metadata.specificItem.runes),
                propertyRunes: (this.previewResult.metadata.specificItem.propertyRunes ?? []).map((rune) => ({
                  ...rune,
                  displayLabel: localizeMaybe(rune.label ?? this.api.propertyRunes?.getBySlug?.(this.previewResult.metadata.specificItem.itemType, rune.slug)?.label ?? rune.slug)
                })),
                automationLabel: this.previewResult.metadata.specificItem.automation === "rules-text"
                  ? localizeMaybe("PF2E_ITEM_FORGE.SpecificItemText.RulesTextAutomation")
                  : this.previewResult.metadata.specificItem.automation
              }
            : null,
          accessoryRune: this.previewResult.metadata?.accessoryRune
            ? {
                ...this.previewResult.metadata.accessoryRune,
                automationLabel: localizeMaybe("PF2E_ITEM_FORGE.Automation.RulesText")
              }
            : null,
          wornItem: this.previewResult.metadata?.wornItem
            ? {
                ...this.previewResult.metadata.wornItem,
                slotLabelLocalized: localizeMaybe(this.previewResult.metadata.wornItem.slotLabel ?? `PF2E_ITEM_FORGE.WornSlots.${{
                  unrestricted: "Unrestricted", backpack: "Backpack", belt: "Belt", cloak: "Cloak", eyepiece: "Eyepiece", garment: "Garment", gloves: "Gloves", bracers: "Bracers", headwear: "Headwear", circlet: "Circlet", mask: "Mask", footwear: "Footwear", collar: "Collar", other: "Other"
                }[this.previewResult.metadata.wornItem.slot] ?? "Other"}`),
                profileLabelLocalized: this.previewResult.metadata.wornItem.profile
                  ? localizeMaybe(this.api.wornMagicProfiles?.get?.(this.previewResult.metadata.wornItem.profile)?.label ?? this.previewResult.metadata.wornItem.profile)
                  : null,
                variantLabelLocalized: this.previewResult.metadata.wornItem.variantLabel
                  ? localizeMaybe(this.previewResult.metadata.wornItem.variantLabel)
                  : null,
                automationLabel: this.previewResult.metadata.wornItem.automation === "rules-text"
                  ? localizeMaybe("PF2E_ITEM_FORGE.Automation.RulesText")
                  : localizeMaybe("PF2E_ITEM_FORGE.Automation.Native")
              }
            : null,
          heldItem: this.previewResult.metadata?.heldItem
            ? {
                ...this.previewResult.metadata.heldItem,
                handsLabelLocalized: localizeMaybe(this.previewResult.metadata.heldItem.handsLabel ?? (this.previewResult.metadata.heldItem.hands === 2 ? "PF2E_ITEM_FORGE.HeldHands.Two" : "PF2E_ITEM_FORGE.HeldHands.One")),
                profileLabelLocalized: this.previewResult.metadata.heldItem.profile
                  ? localizeMaybe(this.api.heldMagicProfiles?.get?.(this.previewResult.metadata.heldItem.profile)?.label ?? this.previewResult.metadata.heldItem.profile)
                  : null,
                variantLabelLocalized: this.previewResult.metadata.heldItem.variantLabel
                  ? localizeMaybe(this.previewResult.metadata.heldItem.variantLabel)
                  : null,
                automationLabel: this.previewResult.metadata.heldItem.automation === "rules-text"
                  ? localizeMaybe("PF2E_ITEM_FORGE.Automation.RulesText")
                  : localizeMaybe("PF2E_ITEM_FORGE.Automation.Native")
              }
            : null,
          magic: this.previewResult.metadata?.magic
            ? {
                ...this.previewResult.metadata.magic,
                kindLabel: ({
                  wand: localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicWand"),
                  staff: localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicStaff"),
                  spellheart: localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicSpellheart"),
                  "specific-weapon": localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicWeapon"),
                  "specific-armor": localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicArmor"),
                  "specific-shield": localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicShield"),
                  worn: localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicWorn"),
                  held: localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicHeld"),
                  "accessory-rune": localizeMaybe("PF2E_ITEM_FORGE.Categories.MagicAccessoryRune")
                })[this.previewResult.metadata.magic.kind] ?? this.previewResult.metadata.magic.kind,
                wandModeLabel: this.previewResult.metadata.magic.wandMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.WandMode.${this.previewResult.metadata.magic.wandMode === "special" ? "Special" : "Standard"}`)
                  : null,
                wandProfileLabel: this.previewResult.metadata.magic.kind === "wand" && this.previewResult.metadata.magic.profile
                  ? localizeMaybe(this.api.wandProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label ?? this.previewResult.metadata.magic.profile)
                  : null,
                themeLabel: this.previewResult.metadata.magic.theme
                  ? localizeMaybe((this.api.magicThemes ?? []).find((theme) => theme.id === this.previewResult.metadata.magic.theme)?.label ?? this.previewResult.metadata.magic.theme)
                  : null,
                profileLabel: this.previewResult.metadata.magic.kind === "staff" && this.previewResult.metadata.magic.profile
                  ? localizeMaybe(this.api.staffProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label ?? this.previewResult.metadata.magic.profile)
                  : null,
                variantLabelLocalized: this.previewResult.metadata.magic.variantLabel
                  ? localizeMaybe(this.previewResult.metadata.magic.variantLabel)
                  : null,
                staffModeLabel: this.previewResult.metadata.magic.staffMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.StaffMode.${this.previewResult.metadata.magic.staffMode === "existing" ? "Existing" : "Generated"}`)
                  : null,
                spellheartModeLabel: this.previewResult.metadata.magic.spellheartMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.SpellheartMode.${this.previewResult.metadata.magic.spellheartMode === "existing" ? "Existing" : "Generated"}`)
                  : null,
                spellheartProfileLabel: this.previewResult.metadata.magic.kind === "spellheart" && this.previewResult.metadata.magic.profile
                  ? localizeMaybe(this.api.spellheartProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label ?? this.previewResult.metadata.magic.profile)
                  : null,
                specificModeLabel: this.previewResult.metadata.magic.specificMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.SpecificItemMode.${this.previewResult.metadata.magic.specificMode === "existing" ? "Existing" : "Generated"}`)
                  : null,
                specificProfileLabel: this.previewResult.metadata.magic.kind?.startsWith?.("specific-") && this.previewResult.metadata.magic.profile
                  ? localizeMaybe((this.previewResult.metadata.magic.kind === "specific-shield"
                      ? this.api.specificShieldProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label
                      : this.api.specificItemProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label) ?? this.previewResult.metadata.magic.profile)
                  : null,
                wornModeLabel: this.previewResult.metadata.magic.wornMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.WornItemMode.${this.previewResult.metadata.magic.wornMode === "existing" ? "Existing" : "Generated"}`)
                  : null,
                wornProfileLabel: this.previewResult.metadata.magic.kind === "worn" && this.previewResult.metadata.magic.profile
                  ? localizeMaybe(this.api.wornMagicProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label ?? this.previewResult.metadata.magic.profile)
                  : null,
                heldModeLabel: this.previewResult.metadata.magic.heldMode
                  ? localizeMaybe(`PF2E_ITEM_FORGE.HeldItemMode.${this.previewResult.metadata.magic.heldMode === "existing" ? "Existing" : "Generated"}`)
                  : null,
                heldProfileLabel: this.previewResult.metadata.magic.kind === "held" && this.previewResult.metadata.magic.profile
                  ? localizeMaybe(this.api.heldMagicProfiles?.get?.(this.previewResult.metadata.magic.profile)?.label ?? this.previewResult.metadata.magic.profile)
                  : null,
                accessoryRuneLabel: this.previewResult.metadata.magic.kind === "accessory-rune"
                  ? (this.previewResult.metadata.magic.accessoryRuneLabel ?? this.previewResult.metadata.magic.accessoryRune)
                  : null
              }
            : null,
          baseItem: this.previewResult.plan?.baseItem ?? this.previewResult.metadata?.baseItem ?? null,
          runeProfile: this.previewResult.metadata?.runeProfile ?? null,
          runes: this.previewResult.metadata?.runes ?? null,
          propertyRuneCapacity: this.previewResult.metadata?.propertyRuneCapacity ?? null,
          propertyRunes: (this.previewResult.metadata?.propertyRunes ?? []).map((rune) => ({
            ...rune,
            displayLabel: localizeMaybe(rune.label)
          })),
          runeSummary: this.#formatRuneSummary(this.previewResult.metadata?.runes),
          treasure: this.previewResult.metadata?.treasure
            ? {
                ...this.previewResult.metadata.treasure,
                attributeEntries: Object.values(this.previewResult.metadata.treasure.attributes ?? {}),
                valuation: this.previewResult.metadata.treasure.valuation ?? null
              }
            : null,
          value: this.previewResult.metadata?.value ?? null,
          price: formatItemPrice(runtimePreviewSource ?? this.previewResult.itemSource, this.previewResult.metadata?.value),
          solverAttempts: this.previewResult.metadata?.solverAttempts ?? null,
          solverExact: this.previewResult.metadata?.solverExact ?? null
        }
      : null;

    return {
      ...context,
      request: this.request,
      categories,
      generationModes,
      fundamentalRuneModes,
      propertyRuneModes,
      propertyRunes,
      isEquipmentMode: this.request.mode === "equipment",
      isTreasureMode: this.request.mode === "treasure",
      isMagicMode,
      isWandCategory,
      specialWand,
      wandModes,
      wandProfiles,
      isStaffCategory,
      isSpellheartCategory,
      generatedSpellheart,
      isSpecificWeaponCategory,
      isSpecificArmorCategory,
      isSpecificShieldCategory,
      isSpecificMagicCategory,
      generatedSpecific,
      isWornMagicCategory,
      isHeldMagicCategory,
      generatedHeld,
      heldModes,
      heldProfiles,
      isAccessoryRuneCategory,
      accessoryRunes,
      generatedWorn,
      wornModes,
      wornProfiles,
      wornSlotCapabilities,
      specificModes,
      specificProfiles,
      specificMagicThemes,
      specificSupportsTheme,
      spellheartModes,
      spellheartProfiles,
      showMagicSpellSettings: isWandCategory,
      generatedStaff,
      staffModes,
      staffProfiles,
      magicThemes,
      treasureValueRange: this.request.value?.mode === "range",
      treasureTypes,
      treasureMaterials,
      treasureConditions,
      treasureCraftsmanship,
      treasureMotifs,
      treasureStyles,
      treasureSupportsMaterial: allowedMaterials.length > 0,
      treasureSupportsMotif: matchingTreasureTypes.some((type) => type.supportsMotif),
      treasureSupportsCraftsmanship: matchingTreasureTypes.some((type) => type.usesCraftsmanship !== false),
      supportsPropertyRunes: ["weapon", "armor"].includes(propertyRuneType),
      fixedPropertyRunes: this.request.equipment?.propertyRunes?.mode === "fixed",
      packs,
      levelPolicies,
      sourceModes,
      isRange: this.request.levelMode === "range",
      selectedSources: this.request.source.mode === "selected",
      isScrollCategory,
      usesSpellSources,
      rarity: {
        common: rarity.has("common"),
        uncommon: rarity.has("uncommon"),
        rare: rarity.has("rare"),
        unique: rarity.has("unique")
      },
      preview,
      error: this.error,
      busy: this.busy
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    element.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("change", async () => {
        this.#syncFromDom();
        if (input.name === "mode") this.#ensureModeCategory();
        this.previewResult = null;
        this.error = null;
        this.onChange?.(this.getRequest(), this);
        if (["mode", "category", "levelMode", "source.mode", "equipment.propertyRunes.mode", "value.mode", "treasure.type", "magic.wandMode", "magic.wandProfile", "magic.staffMode", "magic.staffProfile", "magic.spellheartMode", "magic.spellheartProfile", "magic.specificMode", "magic.specificProfile", "magic.wornMode", "magic.wornProfile", "magic.heldMode", "magic.heldProfile", "magic.accessoryRune"].includes(input.name)) {
          await this.#renderPreservingView();
        }
      });
    });
  }

  async #renderPreservingView() {
    if (!this.rendered) return this.render();

    const selectors = [
      ".item-forge-parameters",
      ".item-forge-preview",
      ".pack-list",
      ".property-rune-list",
      ".preview-description__content"
    ];
    const scrollState = selectors.map((selector) => ({
      selector,
      top: this.element.querySelector(selector)?.scrollTop ?? 0,
      left: this.element.querySelector(selector)?.scrollLeft ?? 0
    }));
    const detailState = [...this.element.querySelectorAll("details")].map((details, index) => ({ index, open: details.open }));
    const active = this.element.ownerDocument?.activeElement;
    const activeName = active?.name && this.element.contains?.(active) ? active.name : null;

    await this.render();

    for (const state of scrollState) {
      const node = this.element.querySelector(state.selector);
      if (!node) continue;
      node.scrollTop = state.top;
      node.scrollLeft = state.left;
    }
    const details = [...this.element.querySelectorAll("details")];
    for (const state of detailState) {
      if (details[state.index]) details[state.index].open = state.open;
    }
    if (activeName) this.element.querySelector(`[name="${activeName}"]`)?.focus?.({ preventScroll: true });
    return this;
  }

  #hydrateRequest(request = {}) {
    if (typeof this.api?.normalize === "function") {
      const normalized = this.api.normalize(request);
      const levelMode = request.levelMode === "range" || request.levelMode === "single"
        ? request.levelMode
        : normalized.level.min === normalized.level.max ? "single" : "range";
      if (levelMode === "single") {
        normalized.level.max = normalized.level.min;
        normalized.level.target = normalized.level.min;
      }
      return { ...normalized, levelMode };
    }
    return hydrateEditorRequest(request);
  }

  #isEquipmentCategory(category) {
    return ["weapon", "armor", "shield"].some((root) =>
      category === root || this.api.categories.isDescendant(category, root)
    );
  }

  #isTreasureCategory(category) {
    return category === "treasure" || this.api.categories.isDescendant(category, "treasure");
  }

  #isMagicCategory(category) {
    return ["magic.wand", "magic.staff", "magic.spellheart", "magic.weapon", "magic.armor", "magic.shield", "magic.accessory-rune", "magic.held", "magic.held.one-hand", "magic.held.two-hands"].includes(category)
      || category === "magic.worn"
      || this.api.categories.isDescendant(category, "magic.worn");
  }

  #equipmentType(category) {
    for (const root of ["weapon", "armor", "shield"]) {
      if (category === root || this.api.categories.isDescendant(category, root)) return root;
    }
    return null;
  }

  #ensureModeCategory() {
    if (this.request.mode === "equipment" && !this.#isEquipmentCategory(this.request.category)) {
      this.request.category = "weapon";
    }
    if (this.request.mode === "treasure" && !this.#isTreasureCategory(this.request.category)) {
      this.request.category = "treasure";
    }
    if (this.request.mode === "magic" && !this.#isMagicCategory(this.request.category)) {
      this.request.category = "magic.wand";
    }
  }

  #formatRuneSummary(runes) {
    if (!runes) return null;
    const parts = [];
    if ((Number(runes.potency) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Potency")} +${Number(runes.potency)}`);
    }
    if ((Number(runes.striking) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Striking")} ${Number(runes.striking)}`);
    }
    if ((Number(runes.resilient) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Resilient")} ${Number(runes.resilient)}`);
    }
    if ((Number(runes.reinforcing) || 0) > 0) {
      parts.push(`${localizeMaybe("PF2E_ITEM_FORGE.Preview.Reinforcing")} ${Number(runes.reinforcing)}`);
    }
    return parts.length ? parts.join(" · ") : localizeMaybe("PF2E_ITEM_FORGE.FundamentalRunes.None");
  }

  #syncFromDom() {
    if (!this.rendered) return;
    const root = this.element;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback) => Number.parseInt(value(name, fallback), 10);

    this.request.mode = value("mode", this.request.mode);
    this.request.category = value("category", this.request.category);
    this.request.levelMode = value("levelMode", this.request.levelMode);
    this.request.levelPolicy = value("levelPolicy", this.request.levelPolicy);
    this.request.level.min = number("level.min", this.request.level.min);
    this.request.level.max = this.request.levelMode === "single"
      ? this.request.level.min
      : number("level.max", this.request.level.max);
    this.request.level.target = this.request.levelMode === "single" ? this.request.level.min : null;
    this.request.source.mode = value("source.mode", this.request.source.mode);
    this.request.solver.maxAttempts = number("solver.maxAttempts", this.request.solver.maxAttempts);
    this.request.equipment ??= {};
    this.request.equipment.fundamentalRunes = value("equipment.fundamentalRunes", this.request.equipment.fundamentalRunes ?? "automatic");
    this.request.equipment.propertyRunes ??= { mode: "automatic", selected: [] };
    this.request.equipment.propertyRunes.mode = value("equipment.propertyRunes.mode", this.request.equipment.propertyRunes.mode ?? "automatic");
    this.request.equipment.propertyRunes.selected = [...root.querySelectorAll('[name="propertyRune"]:checked')].map((input) => input.value);
    this.request.value ??= {};
    this.request.value.mode = value("value.mode", this.request.value.mode ?? "target");
    this.request.value.target = Number.parseFloat(value("value.target", this.request.value.target ?? 25));
    this.request.value.min = Number.parseFloat(value("value.min", this.request.value.min ?? 10));
    this.request.value.max = Number.parseFloat(value("value.max", this.request.value.max ?? 50));
    this.request.value.tolerance = Number.parseFloat(value("value.tolerance", this.request.value.tolerance ?? 0.15));
    this.request.treasure ??= {};
    this.request.treasure.type = value("treasure.type", this.request.treasure.type ?? "any");
    this.request.treasure.material = value("treasure.material", this.request.treasure.material ?? "any");
    this.request.treasure.condition = value("treasure.condition", this.request.treasure.condition ?? "any");
    this.request.treasure.craftsmanship = value("treasure.craftsmanship", this.request.treasure.craftsmanship ?? "any");
    this.request.treasure.motif = value("treasure.motif", this.request.treasure.motif ?? "any");
    this.request.treasure.style = value("treasure.style", this.request.treasure.style ?? "any");
    this.request.magic ??= {};
    this.request.magic.wandMode = value("magic.wandMode", this.request.magic.wandMode ?? "standard");
    this.request.magic.wandProfile = value("magic.wandProfile", this.request.magic.wandProfile ?? "automatic");
    this.request.magic.staffMode = value("magic.staffMode", this.request.magic.staffMode ?? "generated");
    this.request.magic.staffProfile = value("magic.staffProfile", this.request.magic.staffProfile ?? "automatic");
    this.request.magic.spellheartMode = value("magic.spellheartMode", this.request.magic.spellheartMode ?? "existing");
    this.request.magic.spellheartProfile = value("magic.spellheartProfile", this.request.magic.spellheartProfile ?? "automatic");
    this.request.magic.specificMode = value("magic.specificMode", this.request.magic.specificMode ?? "existing");
    this.request.magic.specificProfile = value("magic.specificProfile", this.request.magic.specificProfile ?? "automatic");
    this.request.magic.wornMode = value("magic.wornMode", this.request.magic.wornMode ?? "existing");
    this.request.magic.wornProfile = value("magic.wornProfile", this.request.magic.wornProfile ?? "automatic");
    this.request.magic.heldMode = value("magic.heldMode", this.request.magic.heldMode ?? "existing");
    this.request.magic.heldProfile = value("magic.heldProfile", this.request.magic.heldProfile ?? "automatic");
    this.request.magic.accessoryRune = value("magic.accessoryRune", this.request.magic.accessoryRune ?? "automatic");
    this.request.magic.theme = value("magic.theme", this.request.magic.theme ?? "automatic");
    const heightenedInput = root.querySelector('[name="magic.allowHeightened"]');
    if (heightenedInput) this.request.magic.allowHeightened = Boolean(heightenedInput.checked);

    this.request.rarity = [...root.querySelectorAll('[name="rarity"]:checked')].map((input) => input.value);
    this.request.source.includePacks = [...root.querySelectorAll('[name="sourcePack"]:checked')].map((input) => input.value);
  }
}
