import { getWornSlotCapabilities } from "../engine/worn-item-utils.js";
import { getHeldHandCapabilities } from "../engine/held-item-utils.js";
import { getGrimoireCapabilities } from "../engine/grimoire-utils.js";
import { API_VERSION } from "../constants.js";

export class ItemForgeApi {
  constructor({ engine, categories, generators, compendiumIndex, treasure, propertyRunes, magicThemes = [], wandProfiles = null, staffProfiles = null, spellheartProfiles = null, specificItemProfiles = null, specificShieldProfiles = null, wornMagicProfiles = null, accessoryRunes = null, heldMagicProfiles = null, grimoireProfiles = null, diagnostics = null, openApplication }) {
    this.apiVersion = API_VERSION;
    this.engine = engine;
    this.categories = categories;
    this.generators = generators;
    this.compendiumIndex = compendiumIndex;
    this.treasure = treasure;
    this.propertyRunes = propertyRunes;
    this.magicThemes = magicThemes;
    this.wandProfiles = wandProfiles;
    this.staffProfiles = staffProfiles;
    this.spellheartProfiles = spellheartProfiles;
    this.specificItemProfiles = specificItemProfiles;
    this.specificShieldProfiles = specificShieldProfiles;
    this.wornMagicProfiles = wornMagicProfiles;
    this.accessoryRunes = accessoryRunes;
    this.heldMagicProfiles = heldMagicProfiles;
    this.grimoireProfiles = grimoireProfiles;
    this.diagnostics = diagnostics;
    this.openApplication = openApplication;
  }

  normalize(request) {
    return this.engine.normalize(request);
  }

  generate(request) {
    return this.engine.generate(request);
  }

  preview(request) {
    return this.engine.preview(request);
  }

  validate(request) {
    return this.engine.validate(request);
  }

  refreshIndex() {
    return this.compendiumIndex.refresh();
  }

  runMagicDiagnostics() {
    if (!this.diagnostics) throw new Error("Magic diagnostics are unavailable");
    return this.diagnostics.run();
  }

  getAvailableItemPacks(options = {}) {
    return this.compendiumIndex.getAvailablePacks(options);
  }

  getIndexDiagnostics() {
    return {
      ready: Boolean(this.compendiumIndex.ready),
      physicalItems: this.compendiumIndex.entries?.length ?? 0,
      spells: this.compendiumIndex.spellEntries?.length ?? 0,
      packErrors: this.compendiumIndex.getPackErrors?.() ?? []
    };
  }


  getWornSlotCapabilities() {
    return getWornSlotCapabilities({
      entries: this.compendiumIndex?.entries ?? [],
      profiles: this.wornMagicProfiles?.getAll?.() ?? []
    });
  }

  getHeldHandCapabilities() {
    return getHeldHandCapabilities({
      entries: this.compendiumIndex?.entries ?? [],
      profiles: this.heldMagicProfiles?.getAll?.() ?? []
    });
  }

  getGrimoireCapabilities() {
    return getGrimoireCapabilities({
      entries: this.compendiumIndex?.entries ?? [],
      profiles: this.grimoireProfiles?.getAll?.() ?? []
    });
  }

  getCapabilities() {
    return {
      apiVersion: this.apiVersion,
      generators: this.generators.getAll().map((generator) => generator.id),
      generatorMetadata: this.generators.getMetadata(),
      categories: this.categories.getAll().map((category) => category.id),
      sourceModes: ["all", "system", "selected"],
      generationModes: this.generators.getModes(),
      fundamentalRuneModes: ["automatic", "none"],
      propertyRuneModes: ["automatic", "random", "fixed", "none"],
      magicThemes: this.magicThemes.map((theme) => theme.id),
      magicItemKinds: ["wand", "staff", "spellheart", "grimoire", "specific-weapon", "specific-armor", "specific-shield", "worn", "held", "accessory-rune"],
      automationLevels: ["native", "rules-text"],
      magicDiagnostics: Boolean(this.diagnostics),
      indexDiagnostics: true,
      wandModes: ["standard", "special"],
      wandProfiles: this.wandProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, ranks: profile.variants.map((variant) => variant.rank), levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      staffModes: ["generated", "existing"],
      spellheartModes: ["generated", "existing"],
      specificItemModes: ["generated", "existing"],
      wornItemModes: ["generated", "existing"],
      heldItemModes: ["generated", "existing"],
      grimoireModes: ["generated", "existing"],
      grimoireCapabilities: this.getGrimoireCapabilities(),
      heldHands: [1, 2],
      heldHandCapabilities: this.getHeldHandCapabilities(),
      wornSlots: this.getWornSlotCapabilities(),
      staffProfiles: this.staffProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      spellheartProfiles: this.spellheartProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      specificItemProfiles: this.specificItemProfiles?.getAll?.().map((profile) => ({ id: profile.id, itemType: profile.itemType, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      specificShieldProfiles: this.specificShieldProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      wornMagicProfiles: this.wornMagicProfiles?.getAll?.().map((profile) => ({ id: profile.id, slot: profile.slot, label: profile.label, invested: profile.invested, levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      heldMagicProfiles: this.heldMagicProfiles?.getAll?.().map((profile) => ({
        id: profile.id,
        hands: profile.hands,
        label: profile.label,
        invested: profile.invested,
        physical: profile.physical,
        levels: profile.variants.map((variant) => variant.level),
        activations: profile.variants.map((variant) => variant.activation),
        ...(profile.balance ? { balance: profile.balance } : {})
      })) ?? [],
      grimoireProfiles: this.grimoireProfiles?.getAll?.().map((profile) => ({
        id: profile.id,
        label: profile.label,
        physical: profile.physical,
        levels: profile.variants.map((variant) => variant.level),
        activations: profile.variants.map((variant) => variant.activation),
        ...(profile.balance ? { balance: profile.balance } : {})
      })) ?? [],
      accessoryRunes: this.accessoryRunes?.getAll?.().map((family) => ({ id: family.id, label: family.label, targetKind: family.targetKind, host: family.host, levels: family.variants.map((variant) => variant.level), variants: family.variants.map((variant) => ({ id: variant.id, level: variant.level, priceGp: variant.priceGp, sourceSlug: variant.sourceSlug, activation: variant.activation })), source: family.source })) ?? [],
      propertyRunes: this.propertyRunes.getAll().map((rune) => ({ id: rune.id, slug: rune.slug, itemType: rune.itemType, level: rune.level, rarity: rune.rarity })),
      levelPolicies: ["strict", "nearest", "notAbove", "notBelow"],
      embeddedEditor: true,
      treasureRegistries: {
        types: this.treasure.types.getAll().length,
        materials: this.treasure.materials.getAll().length,
        components: this.treasure.components.getAll().length,
        motifs: this.treasure.motifs.getAll().length,
        conditions: this.treasure.conditions.getAll().length,
        craftsmanship: this.treasure.craftsmanship.getAll().length,
        styles: this.treasure.styles.getAll().length
      }
    };
  }

  open(options = {}) {
    return this.openApplication(options);
  }
}
