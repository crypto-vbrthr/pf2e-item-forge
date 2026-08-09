import { ContentRegistry, contentError } from "./content-registry.js";

function isFinitePositive(value, { allowZero = false } = {}) {
  return Number.isFinite(Number(value)) && (allowZero ? Number(value) >= 0 : Number(value) > 0);
}

function validateStringArray(value, field, registryName, id, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw contentError(registryName, id, `${field} must be ${allowEmpty ? "an" : "a non-empty"} array of strings`, { field });
  }
}

function validateRange(value, field, registryName, id) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((entry) => !Number.isFinite(Number(entry))) || Number(value[0]) > Number(value[1])) {
    throw contentError(registryName, id, `${field} must be a numeric [min, max] range`, { field });
  }
}

function validateWeightMap(value, field, registryName, id) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) throw contentError(registryName, id, `${field} must be an object`, { field });
  for (const [key, weight] of Object.entries(value)) {
    if (!key || !isFinitePositive(weight, { allowZero: true })) {
      throw contentError(registryName, id, `${field}.${key} must be a non-negative number`, { field: `${field}.${key}` });
    }
  }
}

export class TreasureRegistry {
  constructor({ categories = null } = {}) {
    this.categories = categories;
    this.materials = new ContentRegistry("treasure material", {
      validator: (definition) => {
        validateStringArray(definition.tags ?? [], "tags", "treasure material", definition.id);
        if (definition.valueFactor != null && !isFinitePositive(definition.valueFactor)) {
          throw contentError("treasure material", definition.id, "valueFactor must be greater than zero", { field: "valueFactor" });
        }
        if (definition.componentValue != null) validateRange(definition.componentValue, "componentValue", "treasure material", definition.id);
      }
    });

    this.craftsmanship = new ContentRegistry("treasure craftsmanship", {
      validator: (definition) => {
        if (!isFinitePositive(definition.valueFactor ?? 1)) throw contentError("treasure craftsmanship", definition.id, "valueFactor must be greater than zero", { field: "valueFactor" });
        if (definition.weight != null && !isFinitePositive(definition.weight, { allowZero: true })) throw contentError("treasure craftsmanship", definition.id, "weight must be non-negative", { field: "weight" });
      }
    });

    this.conditions = new ContentRegistry("treasure condition", {
      validator: (definition) => {
        if (!isFinitePositive(definition.valueFactor ?? 1, { allowZero: true })) throw contentError("treasure condition", definition.id, "valueFactor must be non-negative", { field: "valueFactor" });
        for (const field of ["requireMaterialTags", "requireAnyMaterialTags", "excludeMaterialTags"]) {
          if (definition[field] != null) validateStringArray(definition[field], field, "treasure condition", definition.id);
        }
      }
    });

    this.motifs = new ContentRegistry("treasure motif", {
      validator: (definition) => {
        if (definition.tags != null) validateStringArray(definition.tags, "tags", "treasure motif", definition.id);
      }
    });

    this.styles = new ContentRegistry("treasure style", {
      validator: (definition) => {
        if (!isFinitePositive(definition.valueFactor ?? 1)) throw contentError("treasure style", definition.id, "valueFactor must be greater than zero", { field: "valueFactor" });
        if (definition.weight != null && !isFinitePositive(definition.weight, { allowZero: true })) throw contentError("treasure style", definition.id, "weight must be non-negative", { field: "weight" });
        const weights = definition.weights ?? {};
        for (const field of ["materialTags", "motifs", "craftsmanship", "typeTags", "components", "conditions"]) {
          validateWeightMap(weights[field], `weights.${field}`, "treasure style", definition.id);
        }
      }
    });

    this.components = new ContentRegistry("treasure component", {
      validator: (definition) => {
        validateRange(definition.baseValue ?? [0, 0], "baseValue", "treasure component", definition.id);
        if (definition.materialTags != null) validateStringArray(definition.materialTags, "materialTags", "treasure component", definition.id);
        if (definition.quantity != null) validateRange(definition.quantity, "quantity", "treasure component", definition.id);
        if (definition.fixedMaterial && !this.materials.has(definition.fixedMaterial)) {
          throw contentError("treasure component", definition.id, `unknown fixedMaterial ${definition.fixedMaterial}`, { field: "fixedMaterial", value: definition.fixedMaterial });
        }
        if (definition.craftsmanshipMode != null && !["inherit", "near-parent", "independent", "none"].includes(definition.craftsmanshipMode)) {
          throw contentError("treasure component", definition.id, "craftsmanshipMode must be inherit, near-parent, independent, or none", { field: "craftsmanshipMode" });
        }
      }
    });

    this.types = new ContentRegistry("treasure type", {
      validator: (definition) => {
        validateStringArray(definition.categories, "categories", "treasure type", definition.id, { allowEmpty: false });
        if (this.categories) {
          for (const category of definition.categories) {
            if (!this.categories.has(category)) {
              throw contentError("treasure type", definition.id, `unknown category ${category}`, { field: "categories", value: category });
            }
          }
        }
        validateRange(definition.baseValue ?? [1, 10], "baseValue", "treasure type", definition.id);
        validateStringArray(definition.tags ?? [], "tags", "treasure type", definition.id);
        validateStringArray(definition.materialTags ?? [], "materialTags", "treasure type", definition.id);
        if (definition.bulk != null && !isFinitePositive(definition.bulk, { allowZero: true })) {
          throw contentError("treasure type", definition.id, "bulk must be a non-negative number", { field: "bulk" });
        }
        for (const field of ["conditionWeights", "craftsmanshipWeights", "motifWeights"]) {
          validateWeightMap(definition[field], field, "treasure type", definition.id);
        }
        if (!Array.isArray(definition.components ?? [])) throw contentError("treasure type", definition.id, "components must be an array", { field: "components" });
        for (const reference of definition.components ?? []) {
          if (!reference?.id || !this.components.has(reference.id)) {
            throw contentError("treasure type", definition.id, `unknown component ${reference?.id ?? "<missing>"}`, { field: "components", value: reference?.id ?? null });
          }
          if (reference.chance != null && (!Number.isFinite(Number(reference.chance)) || Number(reference.chance) < 0 || Number(reference.chance) > 1)) {
            throw contentError("treasure type", definition.id, "component chance must be between 0 and 1", { field: "components.chance", value: reference.chance });
          }
        }
        for (const [attribute, spec] of Object.entries(definition.attributes ?? {})) {
          if (!Array.isArray(spec?.options) || !spec.options.length) {
            throw contentError("treasure type", definition.id, `attribute ${attribute} requires non-empty options`, { field: `attributes.${attribute}.options` });
          }
        }
      }
    });
  }

  getDiagnostics() {
    return {
      types: this.types.getAll().length,
      materials: this.materials.getAll().length,
      components: this.components.getAll().length,
      motifs: this.motifs.getAll().length,
      conditions: this.conditions.getAll().length,
      craftsmanship: this.craftsmanship.getAll().length,
      styles: this.styles.getAll().length
    };
  }
}
