export class GeneratorRegistry {
  #registrations = new Map();
  #sequence = 0;

  register(generator, options = {}) {
    if (!generator?.id || typeof generator.generate !== "function") {
      throw new TypeError("Generator requires id and generate(request, context)");
    }
    if (this.#registrations.has(generator.id)) throw new Error(`Duplicate generator: ${generator.id}`);

    const modes = [...new Set(
      (options.modes ?? generator.modes ?? (generator.mode ? [generator.mode] : []))
        .filter((mode) => typeof mode === "string" && mode)
    )];
    const priority = Number.isFinite(options.priority) ? options.priority : Number(generator.priority ?? 0) || 0;

    this.#registrations.set(generator.id, {
      generator,
      priority,
      modes,
      sequence: this.#sequence++
    });
    return generator;
  }

  get(id) {
    return this.#registrations.get(id)?.generator ?? null;
  }

  getRegistration(id) {
    const registration = this.#registrations.get(id);
    if (!registration) return null;
    return {
      id,
      generator: registration.generator,
      priority: registration.priority,
      modes: [...registration.modes]
    };
  }

  resolve(request) {
    const candidates = [...this.#registrations.values()]
      .filter(({ generator, modes }) => {
        if (modes.length && !modes.includes(request.mode)) return false;
        return generator.supports?.(request) ?? false;
      })
      .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    return candidates[0]?.generator ?? null;
  }

  getAll() {
    return [...this.#registrations.values()]
      .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence)
      .map(({ generator }) => generator);
  }

  getModes() {
    return [...new Set([...this.#registrations.values()].flatMap(({ modes }) => modes))];
  }

  getMetadata() {
    return [...this.#registrations.entries()]
      .map(([id, registration]) => ({
        id,
        priority: registration.priority,
        modes: [...registration.modes]
      }))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }
}
