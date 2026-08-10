import { hasMagicMarkerTraits, parseWornUsage } from "./worn-item-utils.js";

const RARITY_ORDER = ["common", "uncommon", "rare", "unique"];

export function maxRarity(a = "common", b = "common") {
  const ai = RARITY_ORDER.indexOf(a);
  const bi = RARITY_ORDER.indexOf(b);
  return RARITY_ORDER[Math.max(ai < 0 ? 0 : ai, bi < 0 ? 0 : bi)] ?? "common";
}

export function isAccessoryRuneBaseCompatible(entry, family) {
  if (!entry || !family) return false;
  const traits = Array.isArray(entry.traits) ? entry.traits : [];
  if (traits.includes("invested")) return false;

  const host = family.host ?? {
    documentTypes: family.targetKind === "container" ? ["equipment", "backpack"] : ["equipment"],
    wornSlots: family.allowedSlots ?? [],
    magicPolicy: family.hostMagicPolicy ?? "mundane-only"
  };
  if (!host.documentTypes?.includes?.(entry.type)) return false;
  if ((host.magicPolicy ?? "mundane-only") === "mundane-only" && hasMagicMarkerTraits(traits)) return false;

  if (family.targetKind === "container") {
    if (entry.type === "backpack") return true;
    const usage = String(entry.usage ?? "").toLowerCase();
    // Published rune documents are equipment too. Never let "etched onto a
    // basket..." make the rune document a host for another copy of itself.
    if (/\betched\b/.test(usage)) return false;
    return entry.type === "equipment" && /\b(container|basket|bag)\b/.test(usage);
  }

  if (family.targetKind === "shield") return entry.type === "shield";
  if (family.targetKind === "item") return true;
  if (family.targetKind === "vehicle") return entry.type === "vehicle";

  const worn = parseWornUsage(entry.usage);
  if (!worn.worn) return false;
  if (family.targetKind === "footwear") return worn.slot === "footwear";
  if (family.targetKind === "clothing") return (host.wornSlots ?? family.allowedSlots ?? []).includes(worn.slot);
  return false;
}

export function coinsToCopper(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (!value || typeof value !== "object") return 0;
  return Math.round(
    Number(value.pp ?? 0) * 1000
    + Number(value.gp ?? 0) * 100
    + Number(value.sp ?? 0) * 10
    + Number(value.cp ?? 0)
  );
}

/** Keep composed prices in gp/sp/cp for consistency with PF2e item stat blocks. */
export function copperToCoins(copper) {
  let rest = Math.max(0, Math.round(Number(copper) || 0));
  const gp = Math.floor(rest / 100); rest %= 100;
  const sp = Math.floor(rest / 10); rest %= 10;
  const cp = rest;
  const result = { gp };
  if (sp) result.sp = sp;
  if (cp) result.cp = cp;
  return result;
}

export function addGpToPrice(value, gp) {
  return copperToCoins(coinsToCopper(value) + Math.round(Number(gp) * 100));
}
