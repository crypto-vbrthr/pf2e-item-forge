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
            "system.description.value"
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
            armorCategory: getProperty(raw, "system.category") ?? null,
            damageType: getProperty(raw, "system.damage.damageType") ?? null,
            description: getProperty(raw, "system.description.value") ?? "",
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
        console.warn("PF2E Item Forge | Failed to index pack", pack.collection, error);
      }
    }

    this.entries = entries.sort((a, b) => a.uuid.localeCompare(b.uuid));
    this.spellEntries = spellEntries.sort((a, b) => a.uuid.localeCompare(b.uuid));
    this.ready = true;
    return this.entries;
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
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  #spellHasDamage(value) {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
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
    } else if (type === "armor") {
      categories.push("armor");
      const armorCategory = system.category;
      if (["light", "medium", "heavy"].includes(armorCategory)) categories.push(`armor.${armorCategory}`);
    } else if (type === "shield") {
      categories.push("shield");
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
    } else if (type === "treasure") {
      categories.push("treasure");
    }

    return [...new Set(categories)];
  }
}
