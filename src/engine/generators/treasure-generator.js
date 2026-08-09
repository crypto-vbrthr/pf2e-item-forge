import { SeededRng } from "../seeded-rng.js";
import { ValueSolver } from "../value-solver.js";

function localized(value, locale = "en") {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const key = String(locale).toLowerCase().startsWith("de") ? "de" : "en";
  return value[key] ?? value.en ?? value.de ?? Object.values(value)[0] ?? "";
}

function interpolate(template, values) {
  return String(template ?? "").replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => values[key] ?? "");
}

function weightedPick(rng, values) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + Math.max(0, Number(value.weight ?? 1)), 0);
  if (total <= 0) return rng.pick(values);
  let roll = rng.random() * total;
  for (const value of values) {
    roll -= Math.max(0, Number(value.weight ?? 1));
    if (roll <= 0) return value;
  }
  return values.at(-1);
}

function randomBetween(rng, range, { decimals = 1 } = {}) {
  const [rawMin, rawMax] = Array.isArray(range) ? range : [range ?? 0, range ?? 0];
  const min = Number(rawMin) || 0;
  const max = Math.max(min, Number(rawMax) || min);
  const factor = 10 ** decimals;
  const value = min + rng.random() * (max - min);
  return Math.round(value * factor) / factor;
}

function hasAnyTag(entry, tags) {
  if (!tags?.length) return true;
  const own = new Set(entry?.tags ?? []);
  return tags.some((tag) => own.has(tag));
}

function conditionCompatible(condition, tags) {
  const set = new Set(tags);
  if (condition.requireMaterialTags?.some((tag) => !set.has(tag))) return false;
  if (condition.requireAnyMaterialTags?.length && !condition.requireAnyMaterialTags.some((tag) => set.has(tag))) return false;
  if (condition.excludeMaterialTags?.some((tag) => set.has(tag))) return false;
  return true;
}

function gpToCoins(gp) {
  let cpTotal = Math.max(0, Math.round(Number(gp || 0) * 100));
  const pp = Math.floor(cpTotal / 1000);
  cpTotal -= pp * 1000;
  const gpWhole = Math.floor(cpTotal / 100);
  cpTotal -= gpWhole * 100;
  const sp = Math.floor(cpTotal / 10);
  const cp = cpTotal - sp * 10;
  return Object.fromEntries(Object.entries({ pp, gp: gpWhole, sp, cp }).filter(([, amount]) => amount > 0));
}

function toHtmlParagraphs(text) {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

function selectedOrAny(registry, id) {
  return id && id !== "any" ? registry.get(id) : null;
}

export class TreasureGenerator {
  constructor({
    categories,
    treasure,
    valueSolver = new ValueSolver(),
    localeProvider = () => globalThis.game?.i18n?.lang ?? "en"
  } = {}) {
    this.id = "treasure-generated";
    this.categories = categories;
    this.treasure = treasure;
    this.valueSolver = valueSolver;
    this.localeProvider = localeProvider;
  }

  supports(request) {
    return request.mode === "treasure";
  }

  async generate(request) {
    this.#validateSelections(request);
    const locale = this.localeProvider();
    const matchingTypes = this.#matchingTypes(request);
    if (!matchingTypes.length) {
      const error = new Error("No treasure type matches the request");
      error.code = "NO_TREASURE_TYPE";
      error.details = { category: request.category, treasure: request.treasure };
      throw error;
    }

    const target = this.#solverTarget(request.value);
    const solveResult = this.valueSolver.solve({
      target: target.target,
      tolerance: target.tolerance,
      maxAttempts: request.solver.maxAttempts,
      generateCandidate: (attempt) => this.#generateCandidate(request, matchingTypes, new SeededRng(`${request.seed}:treasure:${attempt}`), locale),
      calculateValue: (candidate) => candidate?.value ?? Number.NaN
    });

    if (!solveResult.candidate) {
      const error = new Error("No valid treasure candidate could be generated");
      error.code = "NO_TREASURE_CANDIDATE";
      error.details = { category: request.category, value: request.value, attempts: solveResult.attempts };
      throw error;
    }

    const candidate = solveResult.candidate;
    const warnings = solveResult.warning ? [solveResult.warning] : [];
    const itemSource = this.#toItemSource(candidate, locale);

    return {
      request,
      itemSource,
      warnings,
      plan: this.#plan(candidate),
      metadata: {
        seed: request.seed,
        generator: this.id,
        sourcePack: "PF2E Item Forge",
        sourceUuid: null,
        level: 0,
        rarity: "common",
        category: request.category,
        candidateCount: matchingTypes.length,
        value: candidate.value,
        solverAttempts: solveResult.attempts,
        solverExact: solveResult.exact,
        treasure: this.#plan(candidate)
      }
    };
  }


  #validateSelections(request) {
    const selections = [
      ["material", this.treasure.materials],
      ["condition", this.treasure.conditions],
      ["craftsmanship", this.treasure.craftsmanship],
      ["motif", this.treasure.motifs],
      ["style", this.treasure.styles]
    ];
    for (const [field, registry] of selections) {
      const id = request.treasure?.[field] ?? "any";
      if (id !== "any" && !registry.has(id)) {
        const error = new Error(`Unknown treasure ${field}: ${id}`);
        error.code = "UNKNOWN_TREASURE_CONTENT";
        error.details = { field: `treasure.${field}`, value: id };
        throw error;
      }
    }
  }

  #matchingTypes(request) {
    const material = selectedOrAny(this.treasure.materials, request.treasure.material);
    const motif = selectedOrAny(this.treasure.motifs, request.treasure.motif);

    return this.treasure.types.getAll().filter((type) => {
      if (!this.categories.matches(type.categories ?? [], request.category)) return false;
      if (material) {
        if (!(type.materialTags ?? []).length) return false;
        if (!hasAnyTag(material, type.materialTags)) return false;
      }
      if (motif && !type.supportsMotif) return false;
      if (request.treasure.craftsmanship !== "any" && type.usesCraftsmanship === false) return false;
      return true;
    });
  }

  #generateCandidate(request, types, rng, locale) {
    const type = weightedPick(rng, types);
    if (!type) return null;

    const material = this.#pickMaterial(request, type, rng);
    if ((type.materialTags ?? []).length && !material) return null;

    const condition = this.#pickCondition(request, type, material, rng);
    if (!condition) return null;
    const craftsmanship = type.usesCraftsmanship === false
      ? { id: null, label: { de: "", en: "" }, sentence: { de: "", en: "" }, valueFactor: 1 }
      : this.#pickRegistryEntry(this.treasure.craftsmanship, request.treasure.craftsmanship, rng);
    if (!craftsmanship) return null;
    const style = this.#pickRegistryEntry(this.treasure.styles, request.treasure.style, rng);
    if (!style) return null;
    const motif = type.supportsMotif ? this.#pickRegistryEntry(this.treasure.motifs, request.treasure.motif, rng) : null;
    if (type.supportsMotif && request.treasure.motif !== "any" && !motif) return null;

    const attributes = {};
    let attributeFactor = 1;
    let attributeAddition = 0;
    for (const [key, spec] of Object.entries(type.attributes ?? {})) {
      const option = weightedPick(rng, spec.options ?? []);
      if (!option) continue;
      attributes[key] = option;
      attributeFactor *= Number(option.valueFactor ?? 1);
      attributeAddition += Number(option.valueAddition ?? 0);
    }

    const components = [];
    for (const reference of type.components ?? []) {
      if (rng.random() > Number(reference.chance ?? 1)) continue;
      const component = this.treasure.components.get(reference.id);
      if (!component) continue;
      const built = this.#buildComponent(component, rng, locale);
      if (built) components.push(built);
    }

    const baseValue = randomBetween(rng, type.baseValue ?? [1, 10]);
    const componentValue = components.reduce((sum, component) => sum + component.value, 0);
    const value = Math.max(0.1, Math.round((
      baseValue
      * Number(material?.valueFactor ?? 1)
      * Number(craftsmanship.valueFactor ?? 1)
      * Number(condition.valueFactor ?? 1)
      * Number(style.valueFactor ?? 1)
      * attributeFactor
      + attributeAddition
      + componentValue
    ) * 10) / 10);

    return {
      type,
      material,
      condition,
      craftsmanship,
      style,
      motif,
      attributes,
      components,
      baseValue,
      componentValue,
      value,
      locale
    };
  }

  #pickMaterial(request, type, rng) {
    if (!(type.materialTags ?? []).length) return null;
    const selected = selectedOrAny(this.treasure.materials, request.treasure.material);
    if (selected) return hasAnyTag(selected, type.materialTags) ? selected : null;
    return weightedPick(rng, this.treasure.materials.getAll().filter((material) => hasAnyTag(material, type.materialTags)));
  }

  #pickCondition(request, type, material, rng) {
    const tags = [...new Set([...(type.tags ?? []), ...(material?.tags ?? [])])];
    const selected = selectedOrAny(this.treasure.conditions, request.treasure.condition);
    if (selected) return conditionCompatible(selected, tags) ? selected : null;
    return weightedPick(rng, this.treasure.conditions.getAll().filter((condition) => conditionCompatible(condition, tags)));
  }

  #pickRegistryEntry(registry, selectedId, rng) {
    const selected = selectedOrAny(registry, selectedId);
    return selected ?? weightedPick(rng, registry.getAll());
  }

  #buildComponent(component, rng, locale) {
    let material = null;
    if (component.fixedMaterial) material = this.treasure.materials.get(component.fixedMaterial);
    else if (component.materialTags?.length) {
      material = weightedPick(rng, this.treasure.materials.getAll().filter((entry) => hasAnyTag(entry, component.materialTags)));
    }

    const craftsmanship = weightedPick(rng, this.treasure.craftsmanship.getAll());
    const quantity = component.quantity ? rng.integer(component.quantity[0], component.quantity[1]) : 1;
    let value = randomBetween(rng, component.baseValue ?? [0, 0]);
    value *= Number(material?.valueFactor ?? 1);
    value *= Number(craftsmanship?.valueFactor ?? 1);
    value *= quantity;
    value = Math.round(value * 10) / 10;

    const sentence = interpolate(localized(component.sentence, locale), {
      material: localized(material?.label, locale),
      craftsmanship: localized(craftsmanship?.label, locale),
      quantity
    }).replace(/\s+/g, " ").trim();

    return { id: component.id, label: localized(component.label, locale), material, craftsmanship, quantity, value, sentence };
  }

  #solverTarget(value) {
    if (value.mode === "range") {
      const min = Math.max(0.1, Number(value.min) || 0.1);
      const max = Math.max(min, Number(value.max) || min);
      const target = (min + max) / 2;
      const tolerance = target > 0 ? (max - min) / (2 * target) : 0;
      return { target, tolerance };
    }
    return {
      target: Math.max(0.1, Number(value.target) || 25),
      tolerance: Math.max(0, Math.min(1, Number(value.tolerance) || 0.15))
    };
  }

  #render(candidate, locale) {
    const typeLabel = localized(candidate.type.label, locale);
    const materialLabel = localized(candidate.material?.label, locale);
    const craftsmanshipLabel = localized(candidate.craftsmanship.label, locale);
    const conditionLabel = localized(candidate.condition.label, locale);
    const styleLabel = localized(candidate.style.label, locale);
    const motifLabel = localized(candidate.motif?.label, locale);
    const motifPhrase = localized(candidate.motif?.phrase, locale);
    const componentSentence = candidate.components.map((component) => component.sentence).join(" ");
    const attributes = Object.fromEntries(Object.entries(candidate.attributes).map(([key, option]) => [key, localized(option.label, locale)]));

    const values = {
      type: typeLabel,
      material: materialLabel,
      craftsmanship: craftsmanshipLabel,
      condition: conditionLabel,
      style: styleLabel,
      motif: motifLabel,
      motifPhrase,
      craftsmanshipSentence: localized(candidate.craftsmanship.sentence, locale),
      conditionSentence: localized(candidate.condition.sentence, locale),
      motifSentence: candidate.motif
        ? (locale.startsWith("de") ? `Die Verzierung zeigt ${motifPhrase}.` : `The decoration shows ${motifPhrase}.`)
        : "",
      componentSentence,
      ...attributes
    };

    const nameTemplates = candidate.type.nameTemplates?.[locale.startsWith("de") ? "de" : "en"]
      ?? candidate.type.nameTemplates?.en
      ?? ["{type}"];
    const descriptionTemplates = candidate.type.descriptionTemplates?.[locale.startsWith("de") ? "de" : "en"]
      ?? candidate.type.descriptionTemplates?.en
      ?? ["{craftsmanshipSentence} {conditionSentence}"];
    const nameRng = new SeededRng(`${candidate.type.id}:${candidate.value}:${JSON.stringify(attributes)}`);
    const name = interpolate(nameRng.pick(nameTemplates), values).replace(/\s+/g, " ").replace(/\s+([,:;.])/g, "$1").trim();
    const description = interpolate(nameRng.pick(descriptionTemplates), values).replace(/\s+/g, " ").replace(/\s+([,:;.])/g, "$1").trim();
    return { name, description };
  }

  #toItemSource(candidate, locale) {
    const rendered = this.#render(candidate, locale);
    return {
      name: rendered.name,
      type: "treasure",
      img: candidate.type.img ?? "systems/pf2e/icons/default-icons/treasure.svg",
      system: {
        description: { value: toHtmlParagraphs(rendered.description) },
        baseItem: null,
        bulk: { value: 0.1 },
        category: candidate.type.systemCategory ?? "art-object",
        containerId: null,
        equipped: { carryType: "worn" },
        hardness: 0,
        hp: { max: 0, value: 0 },
        identification: { status: "identified", unidentified: null },
        level: { value: 0 },
        material: { type: null, grade: null },
        price: { value: gpToCoins(candidate.value), per: 1 },
        quantity: 1,
        size: "med",
        temporary: false,
        traits: { value: [], rarity: "common", otherTags: [] }
      }
    };
  }

  #plan(candidate) {
    return {
      type: { id: candidate.type.id, label: localized(candidate.type.label, candidate.locale), categories: candidate.type.categories },
      material: candidate.material ? { id: candidate.material.id, label: localized(candidate.material.label, candidate.locale), valueFactor: candidate.material.valueFactor } : null,
      craftsmanship: candidate.craftsmanship.id ? { id: candidate.craftsmanship.id, label: localized(candidate.craftsmanship.label, candidate.locale), valueFactor: candidate.craftsmanship.valueFactor } : null,
      condition: { id: candidate.condition.id, label: localized(candidate.condition.label, candidate.locale), valueFactor: candidate.condition.valueFactor },
      style: { id: candidate.style.id, label: localized(candidate.style.label, candidate.locale), valueFactor: candidate.style.valueFactor },
      motif: candidate.motif ? { id: candidate.motif.id, label: localized(candidate.motif.label, candidate.locale) } : null,
      attributes: Object.fromEntries(Object.entries(candidate.attributes).map(([key, option]) => [key, { id: option.id, label: localized(option.label, candidate.locale) }])),
      components: candidate.components.map((component) => ({ id: component.id, label: component.label, material: component.material ? localized(component.material.label, candidate.locale) : null, quantity: component.quantity, value: component.value })),
      valuation: {
        baseValue: candidate.baseValue,
        componentValue: candidate.componentValue,
        finalValue: candidate.value
      }
    };
  }
}

export { gpToCoins, localized };
