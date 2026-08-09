import { normalizeRequest, validateRequest } from "./request-normalizer.js";

export class ItemForgeEngine {
  constructor({ categories, generators, compendiumIndex, defaultOptions = {} }) {
    this.categories = categories;
    this.generators = generators;
    this.compendiumIndex = compendiumIndex;
    this.defaultOptions = defaultOptions;
  }

  async initialize() {
    await this.compendiumIndex.refresh();
  }

  normalize(request) {
    return normalizeRequest(request, this.defaultOptions);
  }

  validate(request) {
    return validateRequest(request, {
      categories: this.categories,
      generationModes: this.generators.getModes(),
      defaultOptions: this.defaultOptions
    });
  }

  async generate(rawRequest) {
    const validation = this.validate(rawRequest);
    if (!validation.valid) {
      const error = new Error("Invalid Item Forge request");
      error.code = "INVALID_REQUEST";
      error.details = validation.errors;
      throw error;
    }
    const request = validation.request;

    const generator = this.generators.resolve(request);
    if (!generator) {
      const error = new Error(`No generator supports mode ${request.mode}`);
      error.code = "NO_GENERATOR";
      throw error;
    }
    return generator.generate(request, { engine: this });
  }

  async preview(request) {
    return this.generate(request);
  }
}
