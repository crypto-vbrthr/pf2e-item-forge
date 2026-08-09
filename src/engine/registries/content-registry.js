function contentError(name, id, message, details = {}) {
  const error = new TypeError(`${name}${id ? ` ${id}` : ""}: ${message}`);
  error.code = "INVALID_CONTENT_DEFINITION";
  error.details = { registry: name, id, ...details };
  return error;
}

export class ContentRegistry {
  #entries = new Map();

  constructor(name, { validator = null } = {}) {
    this.name = name;
    this.validator = validator;
  }

  register(definition) {
    if (!definition?.id || typeof definition.id !== "string") {
      throw contentError(this.name, null, "registration requires a string id");
    }
    if (this.#entries.has(definition.id)) {
      const error = new Error(`Duplicate ${this.name} id: ${definition.id}`);
      error.code = "DUPLICATE_CONTENT_ID";
      error.details = { registry: this.name, id: definition.id };
      throw error;
    }

    if (this.validator) {
      try {
        this.validator(definition, this);
      } catch (error) {
        if (error?.code) throw error;
        throw contentError(this.name, definition.id, error?.message ?? "invalid definition");
      }
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

export { contentError };
