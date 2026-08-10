import { normalizeRequest, validateRequest } from "./request-normalizer.js";
import { applyGenerationContract } from "./generation-contract.js";

export class ItemForgeEngine {
  constructor({ categories, generators, compendiumIndex, defaultOptions = {} }) {
    this.categories = categories;
    this.generators = generators;
    this.compendiumIndex = compendiumIndex;
    this.defaultOptions = defaultOptions;
  }

  getDefaultOptions() {
    return typeof this.defaultOptions === "function" ? (this.defaultOptions() ?? {}) : (this.defaultOptions ?? {});
  }

  setDefaultOptions(defaultOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  async initialize() {
    await this.compendiumIndex.refresh();
  }

  normalize(request) {
    return normalizeRequest(request, this.getDefaultOptions());
  }

  validate(request) {
    return validateRequest(request, {
      categories: this.categories,
      generationModes: this.generators.getModes(),
      generatorResolver: (normalized) => this.generators.resolve(normalized),
      defaultOptions: this.getDefaultOptions()
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
    const result = await generator.generate(request, { engine: this });
    return applyGenerationContract(result);
  }

  async preview(request) {
    return this.generate(request);
  }
}
