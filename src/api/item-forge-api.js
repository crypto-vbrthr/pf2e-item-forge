import { API_VERSION } from "../constants.js";

export class ItemForgeApi {
  constructor({ engine, categories, generators, compendiumIndex, treasure, propertyRunes, openApplication }) {
    this.apiVersion = API_VERSION;
    this.engine = engine;
    this.categories = categories;
    this.generators = generators;
    this.compendiumIndex = compendiumIndex;
    this.treasure = treasure;
    this.propertyRunes = propertyRunes;
    this.openApplication = openApplication;
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

  getAvailableItemPacks() {
    return this.compendiumIndex.getAvailablePacks();
  }

  getCapabilities() {
    return {
      apiVersion: this.apiVersion,
      generators: this.generators.getAll().map((generator) => generator.id),
      categories: this.categories.getAll().map((category) => category.id),
      sourceModes: ["all", "system", "selected"],
      generationModes: ["existing", "equipment"],
      fundamentalRuneModes: ["automatic", "none"],
      propertyRuneModes: ["automatic", "random", "fixed", "none"],
      propertyRunes: this.propertyRunes.getAll().map((rune) => ({ id: rune.id, slug: rune.slug, itemType: rune.itemType, level: rune.level, rarity: rune.rarity })),
      levelPolicies: ["strict", "nearest", "notAbove", "notBelow"],
      embeddedEditor: true,
      treasureRegistries: true
    };
  }

  open(options = {}) {
    return this.openApplication(options);
  }
}
