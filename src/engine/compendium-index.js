import { parseWornUsage, wornCategoryForSlot, isMagicWornTraits } from "./worn-item-utils.js";
import { parseHeldUsage, heldCategoryForHands, hasHeldMagicMarkerTraits } from "./held-item-utils.js";
import { isGrimoireTraits } from "./grimoire-utils.js";
import { isAssistiveItem } from "./assistive-item-utils.js";

export const SUPPORTED_ITEM_TYPES = new Set([
  "weapon",
  "armor",
  "shield",
  "consumable",
  "equipment",
  "treasure",
  "backpack",
  "book",
  "kit"
]);

function getProperty(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

export function isSpecificSystemValue(value) {
  if (value === true) return true;
  if (value == null || value === false) return false;
  if (typeof value !== "object" || Array.isArray(value)) return false;

  // Legacy Item Forge/PF2e shapes stored this as { value: boolean }.
  if (Object.hasOwn(value, "value")) return value.value === true;

  // PF2e v14 models specific weapons/armor as a non-null object containing
  // the item's baseline material and rune data. Presence of that object is
  // itself the specific-item marker (WeaponPF2e#isSpecific is !!system.specific).
  return true;
}

export function setSpecificSystemValue(system) {
  if (!system || typeof system !== "object") return;
  const existing = system.specific;

  // Keep legacy shapes usable for old worlds/modules.
  if (existing && typeof existing === "object" && !Array.isArray(existing) && Object.hasOwn(existing, "value")) {
    existing.value = true;
    return;
  }

  const clone = (value) => {
    if (globalThis.foundry?.utils?.deepClone) return globalThis.foundry.utils.deepClone(value);
    return structuredClone(value);
  };

  // PF2e v14 SpecificWeaponData/SpecificArmorData are baseline snapshots.
  // Store the runes/material that belong intrinsically to this specific item.
  system.specific = {
    material: clone(system.material ?? {}),
    runes: clone(system.runes ?? {})
  };
}

function packageInfo(pack) {
  return {
    packageType: pack.metadata?.packageType ?? null,
    packageName: pack.metadata?.packageName ?? null
  };
}

export class CompendiumIndex {
  constructor({ categoryRegistry, gameProvider = () => globalThis.game } = {}) {
    this.categories = categoryRegistry;
    this.gameProvider = gameProvider;
    this.entries = [];
    this.spellEntries = [];
    this.packMetadata = new Map();
    this.packErrors = [];
    this.ready = false;
  }

  getItemPacks() {
    const game = this.gameProvider();
    if (!game?.packs) return [];
    return [...game.packs].filter((pack) => pack.documentName === "Item");
  }

  async refresh() {
    const packs = this.getItemPacks();
    const entries = [];
    const spellEntries = [];
    this.packMetadata.clear();
    this.packErrors = [];

    for (const pack of packs) {
      try {
        const packId = pack.collection;
        const physicalInPack = [];
        const spellsInPack = [];
        const index = await pack.getIndex({
          fields: [
            "name",
            "type",
            "img",
            "system.level.value",
            "system.rarity.value",
            "system.traits.value",
            "system.traits.rarity",
            "system.traits.traditions",
            "system.category",
            "system.group",
            "system.range",
            "system.usage.value",
            "system.runes",
            "system.specific",
            "system.baseItem",
            "system.slug",
            "system.material",
            "system.damage.damageType",
            "system.ritual",
            "system.heightening",
            "system.time.value",
            "system.damage",
            "system.description.value",
            "system.hardness",
            "system.hp",
            "system.brokenThreshold",
            "system.acBonus"
          ]
        });

        for (const raw of index) {
          if (raw.type === "spell") {
            spellsInPack.push(this.#spellEntry(raw, pack));
            continue;
          }

          const categories = this.#classify(raw);
          if (categories.length === 0) continue;
          physicalInPack.push({
            id: raw._id,
            uuid: `Compendium.${packId}.Item.${raw._id}`,
            pack: packId,
            ...packageInfo(pack),
            name: raw.name,
            img: raw.img,
            type: raw.type,
            level: Number(getProperty(raw, "system.level.value") ?? 0),
            rarity: getProperty(raw, "system.traits.rarity") ?? getProperty(raw, "system.rarity.value") ?? "common",
            traits: [...(getProperty(raw, "system.traits.value") ?? [])],
            consumableCategory: raw.type === "consumable" ? getProperty(raw, "system.category") ?? null : null,
            runes: structuredClone(getProperty(raw, "system.runes") ?? {}),
            specific: structuredClone(getProperty(raw, "system.specific") ?? null),
            baseItem: getProperty(raw, "system.baseItem") ?? null,
            slug: getProperty(raw, "system.slug") ?? null,
            material: structuredClone(getProperty(raw, "system.material") ?? null),
            range: getProperty(raw, "system.range") ?? null,
            group: getProperty(raw, "system.group") ?? null,
            usage: getProperty(raw, "system.usage.value") ?? null,
            wornSlot: this.#wornSlot(raw),
            heldHands: this.#heldHands(raw),
            armorCategory: getProperty(raw, "system.category") ?? null,
            damageType: getProperty(raw, "system.damage.damageType") ?? null,
            description: getProperty(raw, "system.description.value") ?? "",
            hardness: this.#numberValue(getProperty(raw, "system.hardness"), 0),
            hp: this.#shieldHp(getProperty(raw, "system.hp")),
            brokenThreshold: this.#brokenThreshold(raw),
            acBonus: this.#numberValue(getProperty(raw, "system.acBonus"), null),
            categories
          });
        }

        const physicalCount = physicalInPack.length;
        const spellCount = spellsInPack.length;
        if (physicalCount || spellCount) {
          this.packMetadata.set(packId, {
            id: packId,
            label: pack.metadata?.label ?? pack.title ?? packId,
            packageName: pack.metadata?.packageName ?? null,
            packageType: pack.metadata?.packageType ?? null,
            physicalCount,
            spellCount,
            hasPhysicalItems: physicalCount > 0,
            hasSpells: spellCount > 0
          });
        }

        entries.push(...physicalInPack);
        spellEntries.push(...spellsInPack);
      } catch (error) {
        const packId = pack.collection ?? "unknown";
        this.packErrors.push({
          pack: packId,
          label: pack.metadata?.label ?? pack.title ?? packId,
          code: error?.code ?? null,
          message: error?.message ?? String(error)
        });
        console.warn("PF2E Item Forge | Failed to index pack", packId, error);
      }
    }

    this.entries = entries.sort((a, b) => a.uuid.localeCompare(b.uuid));
    this.spellEntries = spellEntries.sort((a, b) => a.uuid.localeCompare(b.uuid));
    this.ready = true;
    return this.entries;
  }

  getPackErrors() {
    return this.packErrors.map((entry) => ({ ...entry }));
  }

  getAvailablePacks({ includeSpellPacks = false } = {}) {
    return [...this.packMetadata.values()]
      .filter((pack) => pack.hasPhysicalItems || (includeSpellPacks && pack.hasSpells))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  query(request) {
    return this.entries.filter((entry) => this.#sourceAllowed(entry, request) && this.#physicalAllowed(entry, request));
  }

  querySpells(request) {
    return this.spellEntries.filter((entry) => {
      if (!this.#sourceAllowed(entry, request)) return false;
      if (request.rarity.length && !request.rarity.includes(entry.rarity)) return false;
      return true;
    });
  }

  async getDocument(entry) {
    const pack = this.gameProvider()?.packs?.get(entry.pack);
    if (!pack) return null;
    return pack.getDocument(entry.id);
  }

  async getSpellDocument(entry) {
    return this.getDocument(entry);
  }

  #sourceAllowed(entry, request) {
    const include = new Set(request.source.includePacks);
    const exclude = new Set(request.source.excludePacks);
    const isSystemPack = entry.packageType === "system" || entry.packageName === this.gameProvider()?.system?.id;
    if (exclude.has(entry.pack)) return false;
    if (request.source.mode === "selected" && !include.has(entry.pack)) return false;
    if (request.source.mode === "system" && !isSystemPack) return false;
    return true;
  }

  #physicalAllowed(entry, request) {
    if (!this.categories.matches(entry.categories, request.category)) return false;
    if (request.rarity.length && !request.rarity.includes(entry.rarity)) return false;
    return true;
  }

  #numberValue(value, fallback = 0) {
    const raw = value && typeof value === "object" ? value.value ?? value.max : value;
    const number = Number(raw);
    return Number.isFinite(number) ? number : fallback;
  }

  #shieldHp(value) {
    if (value && typeof value === "object") {
      const max = Number(value.max ?? value.value);
      return Number.isFinite(max) ? max : 0;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  #brokenThreshold(raw) {
    const direct = this.#numberValue(getProperty(raw, "system.brokenThreshold"), null);
    if (direct != null) return direct;
    const nested = this.#numberValue(getProperty(raw, "system.hp.brokenThreshold"), null);
    if (nested != null) return nested;
    const hp = this.#shieldHp(getProperty(raw, "system.hp"));
    return hp > 0 ? Math.floor(hp / 2) : 0;
  }

  #spellEntry(raw, pack) {
    const traits = [...(getProperty(raw, "system.traits.value") ?? [])];
    const ritual = getProperty(raw, "system.ritual") ?? null;
    const traditions = [...(getProperty(raw, "system.traits.traditions") ?? [])];
    return {
      id: raw._id,
      uuid: `Compendium.${pack.collection}.Item.${raw._id}`,
      pack: pack.collection,
      ...packageInfo(pack),
      name: raw.name,
      img: raw.img,
      type: "spell",
      baseRank: Number(getProperty(raw, "system.level.value") ?? 1),
      rarity: getProperty(raw, "system.traits.rarity") ?? "common",
      traits,
      traditions,
      ritual: Boolean(ritual),
      cantrip: traits.includes("cantrip"),
      focus: traits.includes("focus") || (traits.includes("cantrip") && traditions.length === 0),
      heightening: structuredClone(getProperty(raw, "system.heightening") ?? null),
      castActions: this.#parseSpellCastActions(getProperty(raw, "system.time.value")),
      hasDamage: this.#spellHasDamage(getProperty(raw, "system.damage")),
      description: getProperty(raw, "system.description.value") ?? "",
      slug: getProperty(raw, "system.slug") ?? null
    };
  }

  #parseSpellCastActions(value) {
    if (Number.isInteger(value) && value > 0) return value;
    if (value && typeof value === "object") {
      const nested = value.value ?? value.actions ?? value.actionCount ?? null;
      if (nested !== value) return this.#parseSpellCastActions(nested);
    }
    const text = String(value ?? "").trim().toLowerCase();
    if (!text || /reaction|free action|freie aktion|reaktion/.test(text)) return null;
    const match = text.match(/^(\d+)(?:\s*(?:action|actions|aktion|aktionen))?$/i);
    return match ? Number(match[1]) : null;
  }

  #spellHasDamage(value) {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
  }

  #wornSlot(raw) {
    const parsed = parseWornUsage(getProperty(raw, "system.usage.value"));
    return parsed.worn ? parsed.slot : null;
  }

  #heldHands(raw) {
    const parsed = parseHeldUsage(getProperty(raw, "system.usage.value"));
    return parsed.held ? parsed.hands : null;
  }

  #classify(raw) {
    const type = raw.type;
    if (!SUPPORTED_ITEM_TYPES.has(type)) return [];

    const system = raw.system ?? {};
    const categories = ["item"];

    if (type === "weapon") {
      categories.push("weapon");
      const range = system.range;
      const isRanged = range != null && range !== "" && range !== false;
      categories.push(isRanged ? "weapon.ranged" : "weapon.melee");
      if (system.group === "firearm" || system.traits?.value?.includes?.("firearm")) {
        categories.push("weapon.ranged", "weapon.ranged.firearm");
      }
      const weaponTraits = system.traits?.value ?? [];
      if (weaponTraits.includes("staff") && weaponTraits.includes("magical")) {
        categories.push("magic", "magic.staff");
      }
      if (isSpecificSystemValue(system.specific) && !categories.includes("magic.staff")) {
        categories.push("magic", "magic.weapon");
      }
    } else if (type === "armor") {
      categories.push("armor");
      const armorCategory = system.category;
      if (["light", "medium", "heavy"].includes(armorCategory)) categories.push(`armor.${armorCategory}`);
      if (isSpecificSystemValue(system.specific)) categories.push("magic", "magic.armor");
    } else if (type === "shield") {
      categories.push("shield");
      const shieldTraits = system.traits?.value ?? [];
      if (shieldTraits.includes("magical")) categories.push("magic", "magic.shield");
    } else if (type === "consumable") {
      categories.push("consumable");
      const category = system.category;
      const traits = system.traits?.value ?? [];
      if (category === "potion") categories.push("consumable.potion");
      if (category === "scroll") categories.push("consumable.scroll");
      if (["ammo", "ammunition"].includes(category)) categories.push("consumable.ammunition");
      if (category === "wand" || traits.includes("wand")) categories.push("magic", "magic.wand");
    } else if (["equipment", "backpack", "book", "kit"].includes(type)) {
      categories.push("equipment");
      const equipmentTraits = system.traits?.value ?? [];
      if (equipmentTraits.includes("spellheart")) {
        categories.push("magic", "magic.spellheart");
      }
      if (isGrimoireTraits(equipmentTraits)) {
        categories.push("magic", "magic.grimoire");
      }
      const worn = parseWornUsage(system.usage?.value);
      if (worn.worn && isMagicWornTraits(equipmentTraits) && !equipmentTraits.includes("spellheart") && !isGrimoireTraits(equipmentTraits)) {
        categories.push("magic", "magic.worn", wornCategoryForSlot(worn.slot));
      }
      const held = parseHeldUsage(system.usage?.value);
      if (type === "equipment" && held.held && hasHeldMagicMarkerTraits(equipmentTraits) && !equipmentTraits.includes("spellheart") && !isGrimoireTraits(equipmentTraits)) {
        categories.push("magic", "magic.held", heldCategoryForHands(held.hands));
      }
    } else if (type === "treasure") {
      categories.push("treasure");
    }

    if (isAssistiveItem(raw)) categories.push("assistive");

    return [...new Set(categories)];
  }
}
