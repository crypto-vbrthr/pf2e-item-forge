export class ContentRegistry {
  #entries = new Map();

  constructor(name) {
    this.name = name;
  }

  register(definition) {
    if (!definition?.id || typeof definition.id !== "string") {
      throw new TypeError(`${this.name} registration requires a string id`);
    }
    if (this.#entries.has(definition.id)) {
      throw new Error(`Duplicate ${this.name} id: ${definition.id}`);
    }
    const frozen = Object.freeze({ ...definition });
    this.#entries.set(definition.id, frozen);
    return frozen;
  }

  get(id) {
    return this.#entries.get(id) ?? null;
  }

  has(id) {
    return this.#entries.has(id);
  }

  getAll() {
    return [...this.#entries.values()];
  }

  clear() {
    this.#entries.clear();
  }
}
