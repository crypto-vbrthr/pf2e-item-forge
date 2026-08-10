import { parseWornUsage } from "./worn-item-utils.js";

const RARITY_ORDER = ["common", "uncommon", "rare", "unique"];

export function maxRarity(a = "common", b = "common") {
  const ai = RARITY_ORDER.indexOf(a);
  const bi = RARITY_ORDER.indexOf(b);
  return RARITY_ORDER[Math.max(ai < 0 ? 0 : ai, bi < 0 ? 0 : bi)] ?? "common";
}

export function isAccessoryRuneBaseCompatible(entry, family) {
  if (!entry || !family) return false;
  if (entry.traits?.includes?.("invested")) return false;

  if (family.targetKind === "container") {
    if (entry.type === "backpack") return true;
    const usage = String(entry.usage ?? "").toLowerCase();
    // Never treat a rune document whose own Usage says "etched onto ..." as
    // the host container. This matters because published Accessory Runes are
    // physical equipment documents in PF2e compendia too.
    if (/\betched\b/.test(usage)) return false;
    return entry.type === "equipment" && /\b(container|basket|bag)\b/.test(usage);
  }

  if (entry.type !== "equipment") return false;
  const worn = parseWornUsage(entry.usage);
  if (!worn.worn) return false;
  if (family.targetKind === "footwear") return worn.slot === "footwear";
  if (family.targetKind === "clothing") return family.allowedSlots.includes(worn.slot);
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

export function copperToCoins(copper) {
  let rest = Math.max(0, Math.round(Number(copper) || 0));
  const pp = Math.floor(rest / 1000); rest %= 1000;
  const gp = Math.floor(rest / 100); rest %= 100;
  const sp = Math.floor(rest / 10); rest %= 10;
  const cp = rest;
  const result = {};
  if (pp) result.pp = pp;
  if (gp) result.gp = gp;
  if (sp) result.sp = sp;
  if (cp) result.cp = cp;
  if (!Object.keys(result).length) result.gp = 0;
  return result;
}

export function addGpToPrice(value, gp) {
  return copperToCoins(coinsToCopper(value) + Math.round(Number(gp) * 100));
}
