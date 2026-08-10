import { hasMagicMarkerTraits, parseWornUsage } from "./worn-item-utils.js";
import { hasHeldMagicMarkerTraits, parseHeldUsage } from "./held-item-utils.js";
import { GENERATED_GRIMOIRE_TEMPLATE_TYPES, hasGrimoireMagicMarkerTraits, isGrimoireTraits } from "./grimoire-utils.js";

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
      { id: "grimoire-existing", request: { mode: "magic", category: "magic.grimoire", level: { min: 4, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { grimoireMode: "existing", grimoireProfile: "automatic" }, seed: "diagnostic-grimoire-existing" } },
      { id: "grimoire-generated-low", request: { mode: "magic", category: "magic.grimoire", level: { min: 4, max: 4, target: 4 }, levelPolicy: "strict", source: { mode: "system" }, magic: { grimoireMode: "generated", grimoireProfile: "automatic" }, seed: "diagnostic-grimoire-low" } },
      { id: "grimoire-generated-high", request: { mode: "magic", category: "magic.grimoire", level: { min: 20, max: 20, target: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { grimoireMode: "generated", grimoireProfile: "automatic" }, seed: "diagnostic-grimoire-high" } },
      { id: "held-existing", request: { mode: "magic", category: "magic.held", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { heldMode: "existing", heldProfile: "automatic" }, seed: "diagnostic-held-existing" } },
      { id: "held-generated-one-low", expectedHeldHands: 1, request: { mode: "magic", category: "magic.held.one-hand", level: { min: 1, max: 1, target: 1 }, levelPolicy: "strict", source: { mode: "system" }, magic: { heldMode: "generated", heldProfile: "automatic" }, seed: "diagnostic-held-one-low" } },
      { id: "held-generated-one-high", expectedHeldHands: 1, request: { mode: "magic", category: "magic.held.one-hand", level: { min: 20, max: 20, target: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { heldMode: "generated", heldProfile: "automatic" }, seed: "diagnostic-held-one-high" } },
      { id: "held-generated-two-low", expectedHeldHands: 2, request: { mode: "magic", category: "magic.held.two-hands", level: { min: 1, max: 1, target: 1 }, levelPolicy: "strict", source: { mode: "system" }, magic: { heldMode: "generated", heldProfile: "automatic" }, seed: "diagnostic-held-two-low" } },
      { id: "held-generated-two-high", expectedHeldHands: 2, request: { mode: "magic", category: "magic.held.two-hands", level: { min: 20, max: 20, target: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { heldMode: "generated", heldProfile: "automatic" }, seed: "diagnostic-held-two-high" } },
      { id: "worn-existing", request: { mode: "magic", category: "magic.worn", level: { min: 1, max: 20 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "existing", wornProfile: "automatic" }, seed: "diagnostic-worn-existing" } },
      { id: "worn-generated-unrestricted", expectedWornSlot: "unrestricted", request: { mode: "magic", category: "magic.worn.unrestricted", level: { min: 1, max: 1, target: 1 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "diagnostic-worn-unrestricted" } },
      { id: "worn-generated-eyepiece", expectedWornSlot: "eyepiece", request: { mode: "magic", category: "magic.worn.eyepiece", level: { min: 5, max: 5, target: 5 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "diagnostic-worn-eyepiece" } },
      { id: "worn-generated-headwear", expectedWornSlot: "headwear", request: { mode: "magic", category: "magic.worn.headwear", level: { min: 10, max: 10, target: 10 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "diagnostic-worn-headwear" } },
      { id: "worn-generated-footwear", expectedWornSlot: "footwear", request: { mode: "magic", category: "magic.worn.footwear", level: { min: 4, max: 4, target: 4 }, levelPolicy: "strict", source: { mode: "system" }, magic: { wornMode: "generated", wornProfile: "automatic" }, seed: "diagnostic-worn-footwear" } },
      { id: "accessory-rune-trackless", request: { mode: "magic", category: "magic.accessory-rune", level: { min: 6, max: 6, target: 6 }, levelPolicy: "strict", source: { mode: "system" }, magic: { accessoryRune: "trackless" }, seed: "diagnostic-accessory-trackless" } },
      { id: "accessory-rune-preserving", request: { mode: "magic", category: "magic.accessory-rune", level: { min: 3, max: 3, target: 3 }, levelPolicy: "strict", source: { mode: "system" }, magic: { accessoryRune: "preserving" }, seed: "diagnostic-accessory-preserving" } },
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

  async #runScenario({ id, request, priceAudit = false, expectedWornSlot = null, expectedHeldHands = null }) {
    try {
      const result = await this.api.preview(request);
      const source = result?.itemSource;
      if (!source) return { id, status: "failed", message: "Generator returned no item source" };
      const document = this.documentFactory(source);
      if (!document) return { id, status: "failed", message: "PF2e document constructor returned no document" };
      const issues = [];
      if (!source.type) issues.push("missing item type");
      if (!validLevel(source)) issues.push("missing or invalid level field");
      const exactRequestedLevel = Number(request?.level?.min) === Number(request?.level?.max) ? Number(request?.level?.min) : null;
      if (Number.isFinite(exactRequestedLevel) && validLevel(source) && Number(rawLevel(source)) !== exactRequestedLevel) {
        issues.push(`generated level ${rawLevel(source)} does not match exact requested level ${exactRequestedLevel}`);
      }
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
      if (id === "held-existing" || id.startsWith("held-generated-")) {
        const usage = source.system?.usage?.value;
        const parsedUsage = parseHeldUsage(usage);
        if (!parsedUsage.held) issues.push("held item lacks a recognized held usage");
        if (expectedHeldHands && parsedUsage.hands !== expectedHeldHands) issues.push(`held usage parsed as ${parsedUsage.hands ?? "none"} hand(s), expected ${expectedHeldHands}`);
      }
      if (id === "worn-existing" || id.startsWith("worn-generated-")) {
        const usage = source.system?.usage?.value;
        const parsedUsage = parseWornUsage(usage);
        if (!parsedUsage.worn) issues.push("worn item lacks a recognized worn usage");
        if (expectedWornSlot && parsedUsage.slot !== expectedWornSlot) issues.push(`worn usage parsed as ${parsedUsage.slot ?? "none"}, expected ${expectedWornSlot}`);
      }
      if (id.startsWith("accessory-rune-")) {
        const traits = source.system?.traits?.value ?? [];
        if (!traits.includes("invested")) issues.push("Accessory Rune host lacks invested trait");
        if (!hasMagicMarkerTraits(traits)) issues.push("Accessory Rune host lacks a magical marker trait");
        if (!source.flags?.["pf2e-item-forge"]?.accessoryRune) issues.push("Accessory Rune host lacks Item Forge manifest");
        if (result.metadata?.automation?.level !== "rules-text") issues.push("Accessory Rune host is not marked rules-text automation");
        const baseLevel = Number(result.metadata?.accessoryRune?.baseItem?.level ?? 0);
        const runeLevel = Number(result.metadata?.accessoryRune?.runeLevel ?? 0);
        if (Number(source.system?.level?.value) !== Math.max(baseLevel, runeLevel)) issues.push("Accessory Rune host level is not max(base, rune)");
        const runeSource = result.metadata?.accessoryRune?.runeSource;
        if (!runeSource?.uuid || !runeSource?.pack || !runeSource?.slug) issues.push("Accessory Rune result lacks source-backed rune provenance");
        const contentSources = result.metadata?.contentSources ?? [];
        if (!contentSources.includes(result.metadata?.accessoryRune?.baseItem?.pack)) issues.push("Accessory Rune host pack is missing from contentSources");
        if (!contentSources.includes(runeSource?.pack)) issues.push("Accessory Rune source pack is missing from contentSources");
        if (result.metadata?.accessoryRune?.host?.magicPolicy !== "mundane-only") issues.push("Core Accessory Rune diagnostic did not use the expected mundane-only host contract");
        if (id === "accessory-rune-preserving" && source.type !== "backpack" && !/container|basket|bag/i.test(String(source.system?.usage?.value ?? ""))) {
          issues.push("Preserving diagnostic did not resolve a container host");
        }
      }
      if (id === "grimoire-existing" || id.startsWith("grimoire-generated-")) {
        const traits = source.system?.traits?.value ?? [];
        if (!isGrimoireTraits(traits)) issues.push("grimoire lacks the grimoire trait");
      }
      if (id.startsWith("grimoire-generated-")) {
        const traits = source.system?.traits?.value ?? [];
        if (!hasGrimoireMagicMarkerTraits(traits)) issues.push("generated grimoire lacks a magical or tradition trait");
        if (!GENERATED_GRIMOIRE_TEMPLATE_TYPES.includes(source.type)) issues.push(`generated grimoire uses unsafe document type ${source.type}`);
        if (!Array.isArray(source.system?.rules) || source.system.rules.length !== 0) issues.push("generated grimoire inherited template Rule Elements");
        if (Object.hasOwn(source.system ?? {}, "apex")) issues.push("generated grimoire inherited template apex data");
        if (Object.hasOwn(source.system ?? {}, "publication")) issues.push("generated grimoire inherited template publication data");
        const foreignFlags = Object.keys(source.flags ?? {}).filter((scope) => scope !== "pf2e-item-forge");
        if (foreignFlags.length) issues.push(`generated grimoire inherited template flags: ${foreignFlags.join(", ")}`);
        if (result.metadata?.automation?.level !== "rules-text") issues.push("generated grimoire is not marked rules-text automation");
        const templateSource = result.metadata?.templateSource;
        const systemId = globalThis.game?.system?.id ?? "pf2e";
        const systemTemplate = templateSource && (templateSource.packageType === "system" || templateSource.packageName === systemId || templateSource.packageName === "pf2e");
        if (!systemTemplate) issues.push("generated grimoire did not use a PF2e system implementation template");
        const rules = result.metadata?.grimoire?.rules;
        if (!rules?.dailyPreparationStudy || !rules?.spellSlotsOnly || !rules?.oneGrimoirePerCasterPerDay || !rules?.oneCasterPerGrimoirePerDay) issues.push("generated grimoire lacks the structured daily-preparation rules contract");
        const activation = result.metadata?.grimoire?.activation;
        const validActivationType = ["action", "reaction", "free-action"].includes(activation?.type);
        const validActionCount = activation?.type === "action"
          ? Number.isInteger(activation.actions) && activation.actions >= 1 && activation.actions <= 3
          : Number(activation?.actions) === 0;
        if (!activation || !validActivationType || !validActionCount) issues.push("generated grimoire lacks a valid structured activation");
        if (activation && (!Array.isArray(activation.traits) || !activation.spellFilter?.preparedFromGrimoire || !activation.spellFilter?.slotsOnly)) issues.push("generated grimoire activation lacks a structured spell filter contract");
      }
      if (id.startsWith("held-generated-")) {
        const traits = source.system?.traits?.value ?? [];
        const expectedInvested = result.metadata?.heldItem?.invested === true;
        if (expectedInvested && !traits.includes("invested")) issues.push("generated held item lacks required invested trait");
        if (!expectedInvested && traits.includes("invested")) issues.push("non-invested held profile inherited invested trait");
        if (!hasHeldMagicMarkerTraits(traits)) issues.push("generated held item lacks a magical or tradition trait");
        if (source.type !== "equipment") issues.push(`generated held item uses unsafe document type ${source.type}`);
        if (expectedHeldHands && result.metadata?.heldItem?.hands !== expectedHeldHands) issues.push("generated held metadata hands do not match requested usage family");
        if (!Array.isArray(source.system?.rules) || source.system.rules.length !== 0) issues.push("generated held item inherited template Rule Elements");
        if (Array.isArray(source.system?.subitems) && source.system.subitems.length) issues.push("generated held item inherited template subitems");
        if (Object.hasOwn(source.system ?? {}, "apex")) issues.push("generated held item inherited template apex data");
        const foreignFlags = Object.keys(source.flags ?? {}).filter((scope) => scope !== "pf2e-item-forge");
        if (foreignFlags.length) issues.push(`generated held item inherited template flags: ${foreignFlags.join(", ")}`);
        if (result.metadata?.automation?.level !== "rules-text") issues.push("generated held item is not marked rules-text automation");
        const templateSource = result.metadata?.templateSource;
        const systemId = globalThis.game?.system?.id ?? "pf2e";
        const systemTemplate = templateSource && (templateSource.packageType === "system" || templateSource.packageName === systemId || templateSource.packageName === "pf2e");
        if (!systemTemplate) issues.push("generated held item did not use a PF2e system implementation template");
        const expectedBulk = String(result.metadata?.heldItem?.physical?.bulk ?? "");
        const actualBulk = String(source.system?.bulk?.value ?? source.system?.bulk ?? "");
        if (!expectedBulk || actualBulk !== expectedBulk) issues.push(`generated held item bulk ${actualBulk || "missing"} does not match profile bulk ${expectedBulk || "missing"}`);
        const material = source.system?.material;
        if (material && typeof material === "object" && Object.values(material).some((value) => value != null && value !== "")) issues.push("generated held item inherited template material data");
        const activation = result.metadata?.heldItem?.activation;
        const validActivationType = ["action", "reaction", "free-action"].includes(activation?.type);
        const validActionCount = activation?.type === "action"
          ? Number.isInteger(activation.actions) && activation.actions >= 1 && activation.actions <= 3
          : Number(activation?.actions) === 0;
        if (!activation || !validActivationType || !validActionCount) issues.push("generated held item lacks a valid structured activation");
        if (activation && !Array.isArray(activation.traits)) issues.push("generated held item activation traits are not structured");
        if (activation?.frequency && (!Number.isInteger(activation.frequency.max) || activation.frequency.max < 1 || !activation.frequency.period)) issues.push("generated held item activation frequency is invalid");
      }
      if (id.startsWith("worn-generated-")) {
        const traits = source.system?.traits?.value ?? [];
        const expectedInvested = result.metadata?.wornItem?.invested !== false;
        if (expectedInvested && !traits.includes("invested")) issues.push("generated worn item lacks required invested trait");
        if (!expectedInvested && traits.includes("invested")) issues.push("non-invested worn profile inherited invested trait");
        if (!hasMagicMarkerTraits(traits)) issues.push("generated worn item lacks a magical or tradition trait");
        if (source.type !== "equipment") issues.push(`generated worn item uses unsafe document type ${source.type}`);
        if (expectedWornSlot && result.metadata?.wornItem?.slot !== expectedWornSlot) issues.push("generated worn metadata slot does not match requested usage family");
        if (!Array.isArray(source.system?.rules) || source.system.rules.length !== 0) issues.push("generated worn item inherited template Rule Elements");
        if (Array.isArray(source.system?.subitems) && source.system.subitems.length) issues.push("generated worn item inherited template subitems");
        if (Object.hasOwn(source.system ?? {}, "apex")) issues.push("generated worn item inherited template apex data");
        const foreignFlags = Object.keys(source.flags ?? {}).filter((scope) => scope !== "pf2e-item-forge");
        if (foreignFlags.length) issues.push(`generated worn item inherited template flags: ${foreignFlags.join(", ")}`);
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
        "NO_PREDEFINED_WORN_ITEM_CANDIDATE", "NO_WORN_ITEM_PROFILE_CANDIDATE", "NO_WORN_ITEM_TEMPLATE",
        "NO_PREDEFINED_HELD_ITEM_CANDIDATE", "NO_HELD_ITEM_PROFILE_CANDIDATE", "NO_HELD_ITEM_TEMPLATE",
        "NO_PREDEFINED_GRIMOIRE_CANDIDATE", "NO_GRIMOIRE_PROFILE_CANDIDATE", "NO_GRIMOIRE_TEMPLATE", "NO_ACCESSORY_RUNE_CANDIDATE"
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

    const heldEntries = (this.api.compendiumIndex?.entries ?? []).filter((entry) => entry.categories?.includes?.("magic.held"));
    const heldHands = new Set(heldEntries.map((entry) => entry.heldHands).filter((value) => value === 1 || value === 2));
    checks.push({
      id: "pf2e-held-usage-schema",
      status: heldEntries.length ? "passed" : "skipped",
      message: heldEntries.length ? `Indexed held magic items: ${heldEntries.length}; hand usages: ${[...heldHands].sort().join(", ") || "none parsed"}` : "No indexed held magic items available"
    });

    const grimoireEntries = (this.api.compendiumIndex?.entries ?? []).filter((entry) => entry.categories?.includes?.("magic.grimoire"));
    const grimoireTypes = new Set(grimoireEntries.map((entry) => entry.type).filter(Boolean));
    checks.push({
      id: "pf2e-grimoire-schema",
      status: grimoireEntries.length ? "passed" : "skipped",
      message: grimoireEntries.length ? `Indexed grimoires: ${grimoireEntries.length}; document types: ${[...grimoireTypes].sort().join(", ") || "none"}` : "No indexed grimoires available"
    });

    const accessoryFamilies = this.api.accessoryRunes?.getAll?.() ?? [];
    const activationVariants = accessoryFamilies.flatMap((family) => family.variants ?? []).filter((variant) => variant.activation);
    checks.push({
      id: "accessory-rune-activation-contract",
      status: activationVariants.length && activationVariants.every((variant) => Number.isInteger(variant.activation.actions) && Array.isArray(variant.activation.traits) && variant.activation.effectText) ? "passed" : "failed",
      message: activationVariants.length
        ? `Structured Accessory Rune activations: ${activationVariants.length}`
        : "No structured Accessory Rune activations are registered"
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
