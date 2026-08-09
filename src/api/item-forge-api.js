import { API_VERSION } from "../constants.js";

export class ItemForgeApi {
  constructor({ engine, categories, generators, compendiumIndex, treasure, propertyRunes, magicThemes = [], wandProfiles = null, staffProfiles = null, spellheartProfiles = null, specificItemProfiles = null, specificShieldProfiles = null, diagnostics = null, openApplication }) {
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
      magicItemKinds: ["wand", "staff", "spellheart", "specific-weapon", "specific-armor", "specific-shield"],
      automationLevels: ["native", "rules-text"],
      magicDiagnostics: Boolean(this.diagnostics),
      indexDiagnostics: true,
      wandModes: ["standard", "special"],
      wandProfiles: this.wandProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, ranks: profile.variants.map((variant) => variant.rank), levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      staffModes: ["generated", "existing"],
      spellheartModes: ["generated", "existing"],
      specificItemModes: ["generated", "existing"],
      staffProfiles: this.staffProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      spellheartProfiles: this.spellheartProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      specificItemProfiles: this.specificItemProfiles?.getAll?.().map((profile) => ({ id: profile.id, itemType: profile.itemType, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
      specificShieldProfiles: this.specificShieldProfiles?.getAll?.().map((profile) => ({ id: profile.id, label: profile.label, themes: [...profile.allowedThemes], levels: profile.variants.map((variant) => variant.level), ...(profile.balance ? { balance: profile.balance } : {}) })) ?? [],
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
