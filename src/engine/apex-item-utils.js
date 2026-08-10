export const APEX_ATTRIBUTES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

export const APEX_ATTRIBUTE_LABEL_KEYS = Object.freeze({
  str: "PF2E_ITEM_FORGE.ApexAttributes.Strength",
  dex: "PF2E_ITEM_FORGE.ApexAttributes.Dexterity",
  con: "PF2E_ITEM_FORGE.ApexAttributes.Constitution",
  int: "PF2E_ITEM_FORGE.ApexAttributes.Intelligence",
  wis: "PF2E_ITEM_FORGE.ApexAttributes.Wisdom",
  cha: "PF2E_ITEM_FORGE.ApexAttributes.Charisma"
});

export function isApexTraits(traits) {
  return Array.isArray(traits) && traits.includes("apex");
}

export function isApexItem(raw) {
  return isApexTraits(raw?.system?.traits?.value);
}

export function getApexCapabilities({ entries = [], templateEntries = entries, profiles = [] } = {}) {
  const systemId = globalThis.game?.system?.id ?? "pf2e";
  const apexEntries = entries.filter((entry) => entry.categories?.includes?.("magic.apex"));
  const systemEquipmentTemplates = templateEntries.filter((entry) =>
    entry.categories?.includes?.("magic.apex") &&
    entry.type === "equipment" &&
    (entry.packageType === "system" || entry.packageName === systemId || entry.packageName === "pf2e")
  );
  const existingAttributes = [...new Set(apexEntries.map((entry) => entry.apexAttribute).filter((value) => APEX_ATTRIBUTES.includes(value)))];
  const generatedAttributes = [...new Set((Array.isArray(profiles) ? profiles : []).map((profile) => profile.attribute).filter((value) => APEX_ATTRIBUTES.includes(value)))];
  return {
    existing: apexEntries.length > 0,
    generated: systemEquipmentTemplates.length > 0 && generatedAttributes.length > 0,
    existingCount: apexEntries.length,
    systemTemplateCount: systemEquipmentTemplates.length,
    existingAttributes,
    generatedAttributes
  };
}
