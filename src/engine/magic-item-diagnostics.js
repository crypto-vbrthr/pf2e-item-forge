import { parseWornUsage } from "./worn-item-utils.js";

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
  return structuredClone(value);
}

function rawLevel(source) {
  return source?.system?.level?.value;
}

function validLevel(source) {
  const value = rawLevel(source);
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

function validPrice(source) {
  const value = source?.system?.price?.value;
  if (typeof value === "string") return Boolean(value.trim());
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const coins = ["pp", "gp", "sp", "cp"];
  const present = coins.filter((coin) => Object.hasOwn(value, coin));
  return present.length > 0 && present.every((coin) => Number.isFinite(Number(value[coin])) && Number(value[coin]) >= 0);
}

function validTraits(source) {
  return Boolean(source?.system?.traits && Array.isArray(source.system.traits.value));
}

function numberFrom(value) {
  const raw = value && typeof value === "object" ? value.value ?? value.max : value;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function shieldDurability(source) {
  const system = source?.system ?? {};
  const hardness = numberFrom(system.hardness);
  const hp = numberFrom(system.hp?.max ?? system.hp);
  const bt = numberFrom(system.brokenThreshold ?? system.hp?.brokenThreshold ?? (hp != null ? Math.floor(hp / 2) : null));
  return { hardness, hp, bt };
}

function stablePrice(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, Object.keys(value).sort());
  } catch (_error) {
    return String(value);
  }
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
      { id: "specific-weapon-existing", request: { mode: "magic", category: "magic.weapon", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-weapon-existing" } },
      { id: "specific-weapon-generated", request: { mode: "magic", category: "magic.weapon", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "generated", specificProfile: "automatic", theme: "automatic" }, seed: "diagnostic-specific-weapon-generated" } },
      { id: "specific-armor-existing", request: { mode: "magic", category: "magic.armor", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-armor-existing" } },
      { id: "specific-armor-generated", request: { mode: "magic", category: "magic.armor", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "generated", specificProfile: "automatic", theme: "automatic" }, seed: "diagnostic-specific-armor-generated" } },
      { id: "specific-shield-existing", request: { mode: "magic", category: "magic.shield", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "existing" }, seed: "diagnostic-specific-shield-existing" } },
      { id: "specific-shield-generated", request: { mode: "magic", category: "magic.shield", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { specificMode: "generated", specificProfile: "automatic", theme: "automatic" }, seed: "diagnostic-specific-shield-generated" } },
      { id: "worn-existing", request: { mode: "magic", category: "magic.worn", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "existing", wornProfile: "automatic" }, seed: "diagnostic-worn-existing" } },
      { id: "worn-generated", request: { mode: "magic", category: "magic.worn", level: { min: 6, max: 6, target: 6 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "diagnostic-worn-generated" } },
      { id: "equipment-composed-price", priceAudit: true, request: { mode: "equipment", category: "weapon", level: { min: 4, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, equipment: { fundamentalRunes: "automatic", propertyRunes: { mode: "none", selected: [] } }, seed: "diagnostic-equipment-price" } }
    ];

    for (const scenario of scenarios) checks.push(await this.#runScenario(scenario));
    checks.push(...this.#inspectCurrentSchema());
    const failed = checks.filter((check) => check.status === "failed").length;
    const passed = checks.filter((check) => check.status === "passed").length;
    const skipped = checks.filter((check) => check.status === "skipped").length;
    const warnings = checks.filter((check) => check.status === "warning").length;
    return {
      ok: failed === 0,
      passed,
      failed,
      skipped,
      warnings,
      checks,
      packErrors: this.api.compendiumIndex?.getPackErrors?.() ?? [],
      systemVersion: globalThis.game?.system?.version ?? null,
      foundryVersion: globalThis.game?.version ?? globalThis.game?.release?.version ?? null,
      timestamp: new Date().toISOString()
    };
  }

  async #runScenario({ id, request, priceAudit = false }) {
    try {
      const result = await this.api.preview(request);
      const source = result?.itemSource;
      if (!source) return { id, status: "failed", message: "Generator returned no item source" };
      const document = this.documentFactory(source);
      if (!document) return { id, status: "failed", message: "PF2e document constructor returned no document" };
      const issues = [];
      if (!source.type) issues.push("missing item type");
      if (!validLevel(source)) issues.push("missing or invalid level field");
      if (!validPrice(source)) issues.push("missing or invalid price structure");
      if (!validTraits(source)) issues.push("missing or invalid traits structure");
      if (id === "scroll" || id === "wand") {
        if (!source.system?.spell) issues.push("missing embedded spell");
      }
      if (["specific-weapon-generated", "specific-armor-generated"].includes(id)) {
        if (!source.system?.specific || typeof source.system.specific !== "object" || Array.isArray(source.system.specific)) {
          issues.push("generated specific equipment lacks object-shaped system.specific");
        }
      }
      if (id === "specific-shield-generated") {
        const durability = shieldDurability(source);
        if (durability.hardness == null || durability.hp == null || durability.bt == null) issues.push("generated shield durability is incomplete");
      }
      if (["worn-existing", "worn-generated"].includes(id)) {
        const usage = source.system?.usage?.value;
        if (!parseWornUsage(usage).worn) issues.push("worn item lacks a recognized worn usage");
      }
      if (id === "worn-generated") {
        const traits = source.system?.traits?.value ?? [];
        if (!traits.includes("invested")) issues.push("generated worn item lacks invested trait");
        if (!traits.includes("magical")) issues.push("generated worn item lacks magical trait");
        if (result.metadata?.automation?.level !== "rules-text") issues.push("generated worn item is not marked rules-text automation");
      }
      if (issues.length) return { id, status: "failed", message: issues.join(", "), generator: result.metadata?.generator ?? null };

      if (priceAudit) {
        const raw = source.system?.price?.value;
        const prepared = document?.system?.price?.value;
        if (prepared !== undefined && stablePrice(prepared) !== stablePrice(raw)) {
          return { id, status: "passed", message: "PF2e runtime derived a different prepared price from the raw composed source", generator: result.metadata?.generator ?? null };
        }
        return { id, status: "warning", message: "Composed rune item kept the raw source price in the temporary document; verify the displayed Foundry price before relying on preview value", generator: result.metadata?.generator ?? null };
      }

      return { id, status: "passed", message: source.name ?? id, generator: result.metadata?.generator ?? null };
    } catch (error) {
      const skippable = [
        "NO_ITEM_IN_LEVEL_RANGE", "NO_BASE_EQUIPMENT", "NO_SCROLL_SPELL_CANDIDATE", "NO_WAND_SPELL_CANDIDATE",
        "NO_PREDEFINED_STAFF_CANDIDATE", "NO_STAFF_SPELL_CANDIDATE", "NO_STAFF_BASE_ITEM",
        "NO_PREDEFINED_SPELLHEART_CANDIDATE", "NO_SPELLHEART_SPELL_CANDIDATE", "NO_SPELLHEART_TEMPLATE",
        "NO_PREDEFINED_SPECIFIC_ITEM_CANDIDATE", "NO_SPECIFIC_BASE_ITEM", "NO_SPECIFIC_PROFILE_CANDIDATE",
        "NO_PREDEFINED_SPECIFIC_SHIELD_CANDIDATE", "NO_SPECIFIC_SHIELD_BASE_ITEM", "NO_SPECIFIC_SHIELD_PROFILE_CANDIDATE",
        "NO_PREDEFINED_WORN_ITEM_CANDIDATE", "NO_WORN_ITEM_PROFILE_CANDIDATE", "NO_WORN_ITEM_TEMPLATE"
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
        status: specific.specific && typeof specific.specific === "object" && !Array.isArray(specific.specific) ? "passed" : "failed",
        message: specific.specific && typeof specific.specific === "object" && !Array.isArray(specific.specific)
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

    const packErrors = this.api.compendiumIndex?.getPackErrors?.() ?? [];
    checks.push({
      id: "compendium-index-errors",
      status: packErrors.length ? "failed" : "passed",
      message: packErrors.length
        ? `${packErrors.length} compendium pack(s) failed to index: ${packErrors.map((entry) => entry.pack).join(", ")}`
        : "All discovered Item compendiums indexed without errors"
    });
    return checks;
  }
}
