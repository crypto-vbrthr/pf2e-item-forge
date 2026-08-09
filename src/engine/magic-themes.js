export const MAGIC_THEME_DEFINITIONS = [
  { id: "automatic", label: "PF2E_ITEM_FORGE.MagicThemes.Automatic", automatic: true },
  { id: "fire", label: "PF2E_ITEM_FORGE.MagicThemes.Fire", traits: ["fire"] },
  { id: "cold", label: "PF2E_ITEM_FORGE.MagicThemes.Cold", traits: ["cold"] },
  { id: "electricity", label: "PF2E_ITEM_FORGE.MagicThemes.Electricity", traits: ["electricity"] },
  { id: "healing", label: "PF2E_ITEM_FORGE.MagicThemes.Healing", traitsAny: ["healing", "vitality"] },
  { id: "illusion", label: "PF2E_ITEM_FORGE.MagicThemes.Illusion", traits: ["illusion"] },
  { id: "mental", label: "PF2E_ITEM_FORGE.MagicThemes.Mental", traits: ["mental"] },
  { id: "vitality", label: "PF2E_ITEM_FORGE.MagicThemes.Vitality", traits: ["vitality"] },
  { id: "void", label: "PF2E_ITEM_FORGE.MagicThemes.Void", traits: ["void"] },
  { id: "arcane", label: "PF2E_ITEM_FORGE.MagicThemes.Arcane", traditions: ["arcane"] },
  { id: "divine", label: "PF2E_ITEM_FORGE.MagicThemes.Divine", traditions: ["divine"] },
  { id: "occult", label: "PF2E_ITEM_FORGE.MagicThemes.Occult", traditions: ["occult"] },
  { id: "primal", label: "PF2E_ITEM_FORGE.MagicThemes.Primal", traditions: ["primal"] },
  { id: "summoning", label: "PF2E_ITEM_FORGE.MagicThemes.Summoning", slugPrefixes: ["summon-", "summoning-"] }
];

export function getMagicTheme(id) {
  return MAGIC_THEME_DEFINITIONS.find((theme) => theme.id === id) ?? null;
}

export function spellMatchesMagicTheme(spell, themeOrId) {
  const theme = typeof themeOrId === "string" ? getMagicTheme(themeOrId) : themeOrId;
  if (!theme || theme.automatic) return true;
  const traits = new Set(spell?.traits ?? []);
  const traditions = new Set(spell?.traditions ?? []);
  const slug = String(spell?.slug ?? "");

  if (theme.traits?.length && !theme.traits.every((trait) => traits.has(trait))) return false;
  if (theme.traitsAny?.length && !theme.traitsAny.some((trait) => traits.has(trait))) return false;
  if (theme.traditions?.length && !theme.traditions.some((tradition) => traditions.has(tradition))) return false;
  if (theme.slugPrefixes?.length && !theme.slugPrefixes.some((prefix) => slug.startsWith(prefix))) return false;
  return true;
}

export function getSelectableMagicThemes() {
  return MAGIC_THEME_DEFINITIONS.map((theme) => ({ id: theme.id, label: theme.label }));
}
