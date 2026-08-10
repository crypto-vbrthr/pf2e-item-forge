const VALID_AUTOMATION_LEVELS = new Set(["native", "rules-text"]);

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function inferredContentSources(metadata) {
  if (Array.isArray(metadata?.contentSources)) return uniqueStrings(metadata.contentSources);
  if (typeof metadata?.sourcePack !== "string" || !metadata.sourcePack.trim()) return [];
  return uniqueStrings(metadata.sourcePack.split(","));
}

function normalizeAutomation(metadata) {
  const current = metadata?.automation;
  const level = typeof current === "string" ? current : current?.level;
  if (!VALID_AUTOMATION_LEVELS.has(level)) return current ?? null;
  return { ...(current && typeof current === "object" ? current : {}), level };
}

/**
 * Apply the stable result contract shared by Item Forge generators. This keeps
 * downstream consumers such as Loot Forge from needing generator-specific
 * source/automation conventions.
 */
export function applyGenerationContract(result) {
  if (!result || typeof result !== "object") return result;
  result.metadata ??= {};
  const metadata = result.metadata;

  metadata.contentSources = inferredContentSources(metadata);
  metadata.templateSource ??= null;
  metadata.automation = normalizeAutomation(metadata);

  if (metadata.specificItem && typeof metadata.specificItem === "object") {
    const expected = metadata.specificItem.mode === "existing" ? "native" : "rules-text";
    metadata.specificItem.automation = expected;
    metadata.automation = { level: expected };
  }

  if (metadata.wand?.mode === "special") {
    metadata.wand.automation = "rules-text";
    metadata.automation = { level: "rules-text" };
  }

  if (metadata.wornItem && typeof metadata.wornItem === "object") {
    const expected = metadata.wornItem.mode === "existing" ? "native" : "rules-text";
    metadata.wornItem.automation = expected;
    metadata.automation = { level: expected };
  }

  if (metadata.accessoryRune && typeof metadata.accessoryRune === "object") {
    metadata.accessoryRune.automation = "rules-text";
    metadata.automation = { level: "rules-text" };
  }

  if (metadata.apexItem && typeof metadata.apexItem === "object") {
    const expected = metadata.apexItem.mode === "existing" ? "native" : "rules-text";
    metadata.apexItem.automation = expected;
    metadata.automation = metadata.apexItem.mode === "existing" ? { level: "native" } : { level: "rules-text", nativeParts: ["apex-attribute"] };
  }

  if (metadata.grimoire && typeof metadata.grimoire === "object") {
    const expected = metadata.grimoire.mode === "existing" ? "native" : "rules-text";
    metadata.grimoire.automation = expected;
    metadata.automation = { level: expected };
  }

  return result;
}

export function validateGeneratedProfileAutomation(value, { kind = "profile", id = "unknown" } = {}) {
  const automation = value ?? "rules-text";
  if (automation !== "rules-text") {
    throw new Error(`${kind} ${id} cannot declare native automation without a verified PF2e automation builder`);
  }
  return "rules-text";
}
