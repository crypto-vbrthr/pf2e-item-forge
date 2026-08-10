export class CategoryRegistry {
  #categories = new Map();

  register(definition) {
    if (!definition?.id || typeof definition.id !== "string") {
      throw new TypeError("Category definition requires a string id");
    }
    if (this.#categories.has(definition.id)) {
      throw new Error(`Duplicate category: ${definition.id}`);
    }

    const parents = Array.isArray(definition.parents)
      ? [...new Set(definition.parents)]
      : definition.parent
        ? [definition.parent]
        : [];

    if (parents.includes(definition.id)) {
      throw new Error(`Category ${definition.id} cannot parent itself`);
    }

    this.#categories.set(definition.id, {
      id: definition.id,
      label: definition.label ?? definition.id,
      parents,
      order: Number.isFinite(definition.order) ? definition.order : 1000,
      metadata: definition.metadata ?? {}
    });

    if (this.#hasCycle(definition.id)) {
      this.#categories.delete(definition.id);
      throw new Error(`Circular category relationship involving ${definition.id}`);
    }
    return this.get(definition.id);
  }

  get(id) {
    return this.#categories.get(id) ?? null;
  }

  has(id) {
    return this.#categories.has(id);
  }

  getAll() {
    return [...this.#categories.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  getParents(id) {
    return [...(this.get(id)?.parents ?? [])];
  }

  getChildren(id) {
    return this.getAll().filter((category) => category.parents.includes(id));
  }

  getAncestors(id) {
    const result = new Set();
    const visit = (current) => {
      for (const parent of this.getParents(current)) {
        if (result.has(parent)) continue;
        result.add(parent);
        visit(parent);
      }
    };
    visit(id);
    return [...result];
  }

  isDescendant(childId, ancestorId) {
    if (childId === ancestorId) return true;
    return this.getAncestors(childId).includes(ancestorId);
  }

  matches(itemCategories, requestedCategory) {
    const categories = Array.isArray(itemCategories) ? itemCategories : [];
    return categories.some((category) => this.isDescendant(category, requestedCategory));
  }

  #hasCycle(startId) {
    const visiting = new Set();
    const visited = new Set();
    const walk = (id) => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const parent of this.getParents(id)) {
        if (this.#categories.has(parent) && walk(parent)) return true;
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    return walk(startId);
  }
}

export const CORE_CATEGORY_LABEL_KEYS = {
  item: "PF2E_ITEM_FORGE.Categories.Item",
  weapon: "PF2E_ITEM_FORGE.Categories.Weapon",
  "weapon.melee": "PF2E_ITEM_FORGE.Categories.WeaponMelee",
  "weapon.ranged": "PF2E_ITEM_FORGE.Categories.WeaponRanged",
  "weapon.ranged.firearm": "PF2E_ITEM_FORGE.Categories.WeaponRangedFirearm",
  armor: "PF2E_ITEM_FORGE.Categories.Armor",
  "armor.light": "PF2E_ITEM_FORGE.Categories.ArmorLight",
  "armor.medium": "PF2E_ITEM_FORGE.Categories.ArmorMedium",
  "armor.heavy": "PF2E_ITEM_FORGE.Categories.ArmorHeavy",
  shield: "PF2E_ITEM_FORGE.Categories.Shield",
  consumable: "PF2E_ITEM_FORGE.Categories.Consumable",
  "consumable.potion": "PF2E_ITEM_FORGE.Categories.ConsumablePotion",
  "consumable.scroll": "PF2E_ITEM_FORGE.Categories.ConsumableScroll",
  "consumable.ammunition": "PF2E_ITEM_FORGE.Categories.ConsumableAmmunition",
  equipment: "PF2E_ITEM_FORGE.Categories.Equipment",
  magic: "PF2E_ITEM_FORGE.Categories.Magic",
  "magic.weapon": "PF2E_ITEM_FORGE.Categories.MagicWeapon",
  "magic.armor": "PF2E_ITEM_FORGE.Categories.MagicArmor",
  "magic.shield": "PF2E_ITEM_FORGE.Categories.MagicShield",
  "magic.wand": "PF2E_ITEM_FORGE.Categories.MagicWand",
  "magic.staff": "PF2E_ITEM_FORGE.Categories.MagicStaff",
  "magic.spellheart": "PF2E_ITEM_FORGE.Categories.MagicSpellheart",
  "magic.worn": "PF2E_ITEM_FORGE.Categories.MagicWorn",
  "magic.accessory-rune": "PF2E_ITEM_FORGE.Categories.MagicAccessoryRune",
  "magic.worn.unrestricted": "PF2E_ITEM_FORGE.Categories.MagicWornUnrestricted",
  "magic.worn.backpack": "PF2E_ITEM_FORGE.Categories.MagicWornBackpack",
  "magic.worn.belt": "PF2E_ITEM_FORGE.Categories.MagicWornBelt",
  "magic.worn.cloak": "PF2E_ITEM_FORGE.Categories.MagicWornCloak",
  "magic.worn.eyepiece": "PF2E_ITEM_FORGE.Categories.MagicWornEyepiece",
  "magic.worn.garment": "PF2E_ITEM_FORGE.Categories.MagicWornGarment",
  "magic.worn.gloves": "PF2E_ITEM_FORGE.Categories.MagicWornGloves",
  "magic.worn.bracers": "PF2E_ITEM_FORGE.Categories.MagicWornBracers",
  "magic.worn.headwear": "PF2E_ITEM_FORGE.Categories.MagicWornHeadwear",
  "magic.worn.circlet": "PF2E_ITEM_FORGE.Categories.MagicWornCirclet",
  "magic.worn.mask": "PF2E_ITEM_FORGE.Categories.MagicWornMask",
  "magic.worn.footwear": "PF2E_ITEM_FORGE.Categories.MagicWornFootwear",
  "magic.worn.collar": "PF2E_ITEM_FORGE.Categories.MagicWornCollar",
  "magic.worn.other": "PF2E_ITEM_FORGE.Categories.MagicWornOther",
  treasure: "PF2E_ITEM_FORGE.Categories.Treasure",
  "treasure.gemstone": "PF2E_ITEM_FORGE.Categories.TreasureGemstone",
  "treasure.art": "PF2E_ITEM_FORGE.Categories.TreasureArt",
  "treasure.art.painting": "PF2E_ITEM_FORGE.Categories.TreasureArtPainting",
  "treasure.art.sculpture": "PF2E_ITEM_FORGE.Categories.TreasureArtSculpture",
  "treasure.art.textile": "PF2E_ITEM_FORGE.Categories.TreasureArtTextile",
  "treasure.jewelry": "PF2E_ITEM_FORGE.Categories.TreasureJewelry",
  "treasure.tableware": "PF2E_ITEM_FORGE.Categories.TreasureTableware",
  "treasure.ceremonial": "PF2E_ITEM_FORGE.Categories.TreasureCeremonial",
  "treasure.luxury": "PF2E_ITEM_FORGE.Categories.TreasureLuxury",
  "treasure.book": "PF2E_ITEM_FORGE.Categories.TreasureBook",
  "treasure.beverage": "PF2E_ITEM_FORGE.Categories.TreasureBeverage",
  "treasure.beverage.wine": "PF2E_ITEM_FORGE.Categories.TreasureBeverageWine",
  "treasure.beverage.beer": "PF2E_ITEM_FORGE.Categories.TreasureBeverageBeer",
  "treasure.beverage.mead": "PF2E_ITEM_FORGE.Categories.TreasureBeverageMead",
  "treasure.beverage.spirit": "PF2E_ITEM_FORGE.Categories.TreasureBeverageSpirit"
};

export function registerCoreCategories(registry) {
  const categories = [
    ["item", null, 0],
    ["weapon", "item", 10],
    ["weapon.melee", "weapon", 11],
    ["weapon.ranged", "weapon", 12],
    ["weapon.ranged.firearm", "weapon.ranged", 13],
    ["armor", "item", 20],
    ["armor.light", "armor", 21],
    ["armor.medium", "armor", 22],
    ["armor.heavy", "armor", 23],
    ["shield", "item", 30],
    ["consumable", "item", 40],
    ["consumable.potion", "consumable", 41],
    ["consumable.scroll", "consumable", 42],
    ["consumable.ammunition", "consumable", 43],
    ["equipment", "item", 50],
    ["magic", "item", 55],
    ["magic.weapon", "magic", 55.5],
    ["magic.armor", "magic", 55.6],
    ["magic.shield", "magic", 55.7],
    ["magic.wand", "magic", 56],
    ["magic.staff", "magic", 57],
    ["magic.spellheart", "magic", 58],
    ["magic.accessory-rune", "magic", 58.5],
    ["magic.worn", "magic", 59],
    ["magic.worn.unrestricted", "magic.worn", 59.01],
    ["magic.worn.backpack", "magic.worn", 59.02],
    ["magic.worn.belt", "magic.worn", 59.03],
    ["magic.worn.cloak", "magic.worn", 59.04],
    ["magic.worn.eyepiece", "magic.worn", 59.05],
    ["magic.worn.garment", "magic.worn", 59.06],
    ["magic.worn.gloves", "magic.worn", 59.07],
    ["magic.worn.bracers", "magic.worn", 59.08],
    ["magic.worn.headwear", "magic.worn", 59.09],
    ["magic.worn.circlet", "magic.worn", 59.10],
    ["magic.worn.mask", "magic.worn", 59.11],
    ["magic.worn.footwear", "magic.worn", 59.12],
    ["magic.worn.collar", "magic.worn", 59.13],
    ["magic.worn.other", "magic.worn", 59.14],
    ["treasure", "item", 60],
    ["treasure.gemstone", "treasure", 61],
    ["treasure.art", "treasure", 62],
    ["treasure.art.painting", "treasure.art", 62.1],
    ["treasure.art.sculpture", "treasure.art", 62.2],
    ["treasure.art.textile", "treasure.art", 62.3],
    ["treasure.jewelry", "treasure", 63],
    ["treasure.tableware", "treasure", 64],
    ["treasure.ceremonial", "treasure", 65],
    ["treasure.luxury", "treasure", 66],
    ["treasure.book", "treasure", 67],
    ["treasure.beverage", "treasure", 68],
    ["treasure.beverage.wine", "treasure.beverage", 68.1],
    ["treasure.beverage.beer", "treasure.beverage", 68.2],
    ["treasure.beverage.mead", "treasure.beverage", 68.3],
    ["treasure.beverage.spirit", "treasure.beverage", 68.4]
  ];

  for (const [id, parent, order] of categories) {
    registry.register({ id, parent, order, label: CORE_CATEGORY_LABEL_KEYS[id] });
  }
  return registry;
}
