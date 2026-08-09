function getProperty(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

export class CompendiumIndex {
  constructor({ categoryRegistry, gameProvider = () => globalThis.game } = {}) {
    this.categories = categoryRegistry;
    this.gameProvider = gameProvider;
    this.entries = [];
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
    this.packMetadata.clear();

    for (const pack of packs) {
      try {
        const packId = pack.collection;
        this.packMetadata.set(packId, {
          id: packId,
          label: pack.metadata?.label ?? pack.title ?? packId,
          packageName: pack.metadata?.packageName ?? null,
          packageType: pack.metadata?.packageType ?? null
        });

        const index = await pack.getIndex({
          fields: [
            "name",
            "type",
            "img",
            "system.level.value",
            "system.rarity.value",
            "system.traits.value",
            "system.category",
            "system.group",
            "system.range",
            "system.usage.value",
            "system.runes",
            "system.specific",
            "system.baseItem",
            "system.slug",
            "system.material",
            "system.damage.damageType"
          ]
        });

        for (const raw of index) {
          const categories = this.#classify(raw);
          entries.push({
            id: raw._id,
            uuid: `Compendium.${packId}.Item.${raw._id}`,
            pack: packId,
            packageType: pack.metadata?.packageType ?? null,
            packageName: pack.metadata?.packageName ?? null,
            name: raw.name,
            img: raw.img,
            type: raw.type,
            level: Number(getProperty(raw, "system.level.value") ?? 0),
            rarity: getProperty(raw, "system.rarity.value") ?? "common",
            traits: [...(getProperty(raw, "system.traits.value") ?? [])],
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
            categories
          });
        }
      } catch (error) {
        console.warn("PF2E Item Forge | Failed to index pack", pack.collection, error);
      }
    }

    this.entries = entries.sort((a, b) => a.uuid.localeCompare(b.uuid));
    this.ready = true;
    return this.entries;
  }

  getAvailablePacks() {
    return [...this.packMetadata.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  query(request) {
    const include = new Set(request.source.includePacks);
    const exclude = new Set(request.source.excludePacks);
    const isSystemPack = (entry) => entry.packageType === "system" || entry.packageName === this.gameProvider()?.system?.id;

    return this.entries.filter((entry) => {
      if (exclude.has(entry.pack)) return false;
      if (request.source.mode === "selected" && !include.has(entry.pack)) return false;
      if (request.source.mode === "system" && !isSystemPack(entry)) return false;
      if (!this.categories.matches(entry.categories, request.category)) return false;
      if (request.rarity.length && !request.rarity.includes(entry.rarity)) return false;
      return true;
    });
  }

  async getDocument(entry) {
    const pack = this.gameProvider()?.packs?.get(entry.pack);
    if (!pack) return null;
    return pack.getDocument(entry.id);
  }

  #classify(raw) {
    const type = raw.type;
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
    } else if (type === "armor") {
      categories.push("armor");
      const armorCategory = system.category;
      if (["light", "medium", "heavy"].includes(armorCategory)) categories.push(`armor.${armorCategory}`);
    } else if (type === "shield") {
      categories.push("shield");
    } else if (type === "consumable") {
      categories.push("consumable");
      const category = system.category;
      if (category === "potion") categories.push("consumable.potion");
      if (category === "scroll") categories.push("consumable.scroll");
      if (["ammo", "ammunition"].includes(category)) categories.push("consumable.ammunition");
    } else if (type === "equipment") {
      categories.push("equipment");
    } else if (type === "treasure") {
      categories.push("treasure");
    }

    return [...new Set(categories)];
  }
}
