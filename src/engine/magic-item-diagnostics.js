function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function sourceLevel(source) {
  return Number(source?.system?.level?.value ?? 0);
}

function hasPrice(source) {
  const value = source?.system?.price?.value;
  return typeof value === "string" ? Boolean(value.trim()) : value != null;
}

/**
 * Live Foundry/PF2e smoke tests. These diagnostics intentionally validate the
 * current system document constructor rather than our test mocks. No world
 * documents are persisted.
 */
export class MagicItemDiagnostics {
  constructor({
    api,
    documentFactory = (source) => {
      const ItemClass = globalThis.CONFIG?.Item?.documentClass ?? globalThis.Item;
      if (!ItemClass) throw new Error("Foundry Item document class is unavailable");
      return new ItemClass(clone(source), { parent: null });
    }
  } = {}) {
    this.api = api;
    this.documentFactory = documentFactory;
  }

  async run() {
    const checks = [];
    const scenarios = [
      { id: "scroll", request: { mode: "existing", category: "consumable.scroll", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, seed: "diagnostic-scroll" } },
      { id: "wand", request: { mode: "magic", category: "magic.wand", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wandMode: "standard", theme: "automatic", allowHeightened: true }, seed: "diagnostic-wand" } },
      { id: "staff-existing", request: { mode: "magic", category: "magic.staff", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { staffMode: "existing", theme: "automatic" }, seed: "diagnostic-staff-existing" } },
      { id: "staff-generated", request: { mode: "magic", category: "magic.staff", level: { min: 3, max: 14 }, levelPolicy: "strict", source: { mode: "system" }, magic: { staffMode: "generated", staffProfile: "automatic", theme: "automatic", allowHeightened: true }, seed: "diagnostic-staff-generated" } },
      { id: "spellheart-existing", request: { mode: "magic", category: "magic.spellheart", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { spellheartMode: "existing" }, seed: "diagnostic-spellheart-existing" } },
      { id: "spellheart-generated", request: { mode: "magic", category: "magic.spellheart", level: { min: 3, max: 16 }, levelPolicy: "strict", source: { mode: "system" }, magic: { spellheartMode: "generated", spellheartProfile: "automatic", theme: "automatic", allowHeightened: true }, seed: "diagnostic-spellheart-generated" } },
      { id: "specific-weapon-existing", request: { mode: "magic", category: "magic.weapon", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-weapon" } },
      { id: "specific-armor-existing", request: { mode: "magic", category: "magic.armor", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-armor" } },
      { id: "specific-shield-existing", request: { mode: "magic", category: "magic.shield", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-shield" } }
    ];

    for (const scenario of scenarios) checks.push(await this.#runScenario(scenario));
    checks.push(...this.#inspectCurrentSchema());
    const failed = checks.filter((check) => check.status === "failed").length;
    const passed = checks.filter((check) => check.status === "passed").length;
    const skipped = checks.filter((check) => check.status === "skipped").length;
    return {
      ok: failed === 0,
      passed,
      failed,
      skipped,
      checks,
      systemVersion: globalThis.game?.system?.version ?? null,
      foundryVersion: globalThis.game?.version ?? globalThis.game?.release?.version ?? null,
      timestamp: new Date().toISOString()
    };
  }

  async #runScenario({ id, request }) {
    try {
      const result = await this.api.preview(request);
      const source = result?.itemSource;
      if (!source) return { id, status: "failed", message: "Generator returned no item source" };
      const document = this.documentFactory(source);
      if (!document) return { id, status: "failed", message: "PF2e document constructor returned no document" };
      const issues = [];
      if (!source.type) issues.push("missing item type");
      if (!Number.isFinite(sourceLevel(source))) issues.push("invalid level");
      if (!hasPrice(source)) issues.push("missing price");
      if (!source.system?.traits) issues.push("missing traits");
      if (id === "scroll" || id === "wand") {
        if (!source.system?.spell) issues.push("missing embedded spell");
      }
      return issues.length
        ? { id, status: "failed", message: issues.join(", "), generator: result.metadata?.generator ?? null }
        : { id, status: "passed", message: source.name ?? id, generator: result.metadata?.generator ?? null };
    } catch (error) {
      const skippable = [
        "NO_ITEM_IN_LEVEL_RANGE", "NO_SCROLL_SPELL_CANDIDATE", "NO_WAND_SPELL_CANDIDATE",
        "NO_PREDEFINED_STAFF_CANDIDATE", "NO_STAFF_SPELL_CANDIDATE",
        "NO_PREDEFINED_SPELLHEART_CANDIDATE", "NO_SPELLHEART_SPELL_CANDIDATE",
        "NO_PREDEFINED_SPECIFIC_ITEM_CANDIDATE", "NO_PREDEFINED_SPECIFIC_SHIELD_CANDIDATE"
      ].includes(error?.code);
      return { id, status: skippable ? "skipped" : "failed", code: error?.code ?? null, message: error?.message ?? String(error) };
    }
  }

  #inspectCurrentSchema() {
    const checks = [];
    const specific = this.api.compendiumIndex?.entries?.find?.((entry) => entry.categories?.includes?.("magic.weapon") || entry.categories?.includes?.("magic.armor"));
    if (specific) {
      checks.push({
        id: "pf2e-specific-schema",
        status: specific.specific && typeof specific.specific === "object" ? "passed" : "failed",
        message: specific.specific && typeof specific.specific === "object"
          ? "system.specific is an object on indexed PF2e specific equipment"
          : "Indexed specific equipment does not expose the expected object-shaped system.specific"
      });
    } else {
      checks.push({ id: "pf2e-specific-schema", status: "skipped", message: "No indexed specific weapon/armor available" });
    }

    const actionShapes = new Set((this.api.compendiumIndex?.spellEntries ?? []).map((spell) => spell.castActions).filter((value) => value != null));
    checks.push({
      id: "pf2e-spell-cast-actions",
      status: actionShapes.size ? "passed" : "skipped",
      message: actionShapes.size ? `Parsed spell action counts: ${[...actionShapes].sort((a, b) => a - b).join(", ")}` : "No numeric spell action counts were parsed"
    });
    return checks;
  }
}
