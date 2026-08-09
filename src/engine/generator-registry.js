export class GeneratorRegistry {
  #generators = new Map();

  register(generator) {
    if (!generator?.id || typeof generator.generate !== "function") {
      throw new TypeError("Generator requires id and generate(request, context)");
    }
    if (this.#generators.has(generator.id)) throw new Error(`Duplicate generator: ${generator.id}`);
    this.#generators.set(generator.id, generator);
    return generator;
  }

  get(id) {
    return this.#generators.get(id) ?? null;
  }

  resolve(request) {
    const candidates = [...this.#generators.values()].filter((generator) => generator.supports?.(request) ?? false);
    return candidates[0] ?? null;
  }

  getAll() {
    return [...this.#generators.values()];
  }
}
