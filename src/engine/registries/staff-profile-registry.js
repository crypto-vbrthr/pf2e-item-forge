import { normalizeBalanceMetadata } from "./profile-balance.js";

export class StaffProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Staff profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate staff profile: ${id}`);

    const variants = Array.isArray(definition.variants) ? definition.variants.map((variant, index) => ({
      id: String(variant.id ?? ["base", "greater", "major"][index] ?? `tier-${index + 1}`),
      label: variant.label ?? null,
      level: Number(variant.level),
      price: Number(variant.price),
      cantrip: index === 0 ? Boolean(variant.cantrip ?? definition.cantrip ?? true) : false,
      ranks: Array.isArray(variant.ranks)
        ? variant.ranks.map((rank) => ({
            rank: Number(rank.rank),
            min: Math.max(1, Number(rank.min ?? 1)),
            max: Math.max(1, Number(rank.max ?? rank.min ?? 1))
          }))
        : []
    })) : [];

    if (variants.length < 1) throw new Error(`Staff profile ${id} requires at least one variant`);
    let lastLevel = -Infinity;
    for (const variant of variants) {
      if (!Number.isInteger(variant.level) || variant.level < 1) throw new Error(`Invalid staff variant level in ${id}`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid staff variant price in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Staff profile ${id} variants must increase in level`);
      lastLevel = variant.level;
      for (const rank of variant.ranks) {
        if (!Number.isInteger(rank.rank) || rank.rank < 1 || rank.rank > 10) throw new Error(`Invalid spell rank in staff profile ${id}`);
        if (rank.max < rank.min) throw new Error(`Invalid spell count range in staff profile ${id}`);
      }
    }

    const profile = {
      id,
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      label: definition.label ?? id,
      description: definition.description ?? null,
      variants
    };
    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) {
    return this.#profiles.get(id) ?? null;
  }

  getAll() {
    return [...this.#profiles.values()];
  }

  has(id) {
    return this.#profiles.has(id);
  }
}

export function registerCoreStaffProfiles(registry = new StaffProfileRegistry()) {
  registry.register({
    id: "core.3-8-12",
    balance: { basis: "rulebook-family-patterns", reviewed: true, notes: "Core progression profile patterned after published staff family structures." },
    label: "PF2E_ITEM_FORGE.StaffProfiles.Core3812",
    cantrip: true,
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.StaffVariants.Base", level: 3, price: 60, ranks: [{ rank: 1, min: 1, max: 2 }] },
      { id: "greater", label: "PF2E_ITEM_FORGE.StaffVariants.Greater", level: 8, price: 450, ranks: [{ rank: 2, min: 1, max: 2 }, { rank: 3, min: 1, max: 2 }] },
      { id: "major", label: "PF2E_ITEM_FORGE.StaffVariants.Major", level: 12, price: 1800, ranks: [{ rank: 4, min: 1, max: 3 }, { rank: 5, min: 1, max: 2 }] }
    ]
  });

  registry.register({
    id: "core.4-8-12",
    balance: { basis: "rulebook-family-patterns", reviewed: true, notes: "Core progression profile patterned after published staff family structures." },
    label: "PF2E_ITEM_FORGE.StaffProfiles.Core4812",
    cantrip: true,
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.StaffVariants.Base", level: 4, price: 90, ranks: [{ rank: 1, min: 1, max: 2 }] },
      { id: "greater", label: "PF2E_ITEM_FORGE.StaffVariants.Greater", level: 8, price: 450, ranks: [{ rank: 2, min: 1, max: 2 }, { rank: 3, min: 1, max: 2 }] },
      { id: "major", label: "PF2E_ITEM_FORGE.StaffVariants.Major", level: 12, price: 1800, ranks: [{ rank: 4, min: 1, max: 2 }, { rank: 5, min: 1, max: 3 }] }
    ]
  });

  registry.register({
    id: "core.6-10-14",
    balance: { basis: "rulebook-family-patterns", reviewed: true, notes: "Core progression profile patterned after published staff family structures." },
    label: "PF2E_ITEM_FORGE.StaffProfiles.Core61014",
    cantrip: true,
    variants: [
      { id: "base", label: "PF2E_ITEM_FORGE.StaffVariants.Base", level: 6, price: 230, ranks: [{ rank: 1, min: 1, max: 2 }, { rank: 2, min: 1, max: 3 }] },
      { id: "greater", label: "PF2E_ITEM_FORGE.StaffVariants.Greater", level: 10, price: 900, ranks: [{ rank: 3, min: 1, max: 2 }, { rank: 4, min: 1, max: 3 }] },
      { id: "major", label: "PF2E_ITEM_FORGE.StaffVariants.Major", level: 14, price: 4000, ranks: [{ rank: 5, min: 1, max: 3 }, { rank: 6, min: 1, max: 3 }] }
    ]
  });

  return registry;
}
