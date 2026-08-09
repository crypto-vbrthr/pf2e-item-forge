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
  treasure: "PF2E_ITEM_FORGE.Categories.Treasure",
  "treasure.gemstone": "PF2E_ITEM_FORGE.Categories.TreasureGemstone",
  "treasure.art": "PF2E_ITEM_FORGE.Categories.TreasureArt",
  "treasure.jewelry": "PF2E_ITEM_FORGE.Categories.TreasureJewelry",
  "treasure.book": "PF2E_ITEM_FORGE.Categories.TreasureBook",
  "treasure.beverage": "PF2E_ITEM_FORGE.Categories.TreasureBeverage"
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
    ["treasure", "item", 60],
    ["treasure.gemstone", "treasure", 61],
    ["treasure.art", "treasure", 62],
    ["treasure.jewelry", "treasure", 63],
    ["treasure.book", "treasure", 64],
    ["treasure.beverage", "treasure", 65]
  ];

  for (const [id, parent, order] of categories) {
    registry.register({ id, parent, order, label: CORE_CATEGORY_LABEL_KEYS[id] });
  }
  return registry;
}
