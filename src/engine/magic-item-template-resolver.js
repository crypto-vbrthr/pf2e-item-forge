/**
 * Resolve implementation templates separately from user-selected content sources.
 * Structural templates are an implementation detail; generated content (spells,
 * published items, base equipment) continues to respect request.source.
 */
export class MagicItemTemplateResolver {
  constructor({
    compendiumIndex,
    configProvider = () => globalThis.CONFIG,
    uuidResolver = (uuid) => globalThis.fromUuid?.(uuid)
  } = {}) {
    this.index = compendiumIndex;
    this.configProvider = configProvider;
    this.uuidResolver = uuidResolver;
    this.cache = new Map();
  }

  async resolveScrollTemplate(rank) {
    return this.#resolveConfiguredSpellcastingTemplate("scroll", rank, "consumable");
  }

  async resolveWandTemplate(rank) {
    return this.#resolveConfiguredSpellcastingTemplate("wand", rank, "consumable");
  }

  resolveStaffBaseEntry() {
    return this.#preferSystem(this.index.entries.filter((entry) =>
      entry.type === "weapon" &&
      !entry.categories?.includes?.("magic.staff") &&
      Number(entry.level ?? 0) === 0 &&
      (entry.slug === "staff" || entry.slug === "quarterstaff" || entry.baseItem === "staff" || String(entry.name ?? "").toLowerCase() === "staff")
    ));
  }

  resolveSpellheartTemplateEntry() {
    return this.#preferSystem(this.index.entries.filter((entry) => entry.categories?.includes?.("magic.spellheart")));
  }

  resolveWornTemplateEntry(slot = null, { allowedTypes = ["equipment"] } = {}) {
    const category = slot ? `magic.worn.${slot}` : "magic.worn";
    const types = new Set(Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes]);
    const entries = this.index.entries
      .filter((entry) => types.has(entry.type) && entry.categories?.includes?.(category))
      .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0) || a.uuid.localeCompare(b.uuid));
    return this.#preferSystem(entries);
  }


  resolveHeldTemplateEntry(hands = null, { allowedTypes = ["equipment"], sourcePolicy = "system-only" } = {}) {
    const category = Number(hands) === 1 ? "magic.held.one-hand" : Number(hands) === 2 ? "magic.held.two-hands" : "magic.held";
    const types = new Set(Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes]);
    const entries = this.index.entries
      .filter((entry) => types.has(entry.type) && entry.categories?.includes?.(category))
      .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0) || a.uuid.localeCompare(b.uuid));
    if (sourcePolicy === "system-only") return this.#systemOnly(entries);
    return this.#preferSystem(entries);
  }

  templateMetadata(entryOrTemplate, { kind = null } = {}) {
    if (!entryOrTemplate) return null;
    return {
      kind,
      source: "implementation-template",
      uuid: entryOrTemplate.uuid ?? null,
      pack: entryOrTemplate.pack ?? null,
      packageType: entryOrTemplate.packageType ?? null,
      packageName: entryOrTemplate.packageName ?? null
    };
  }

  clearCache() {
    this.cache.clear();
  }

  #systemOnly(entries) {
    const systemId = globalThis.game?.system?.id ?? "pf2e";
    return entries.find((entry) => entry.packageType === "system" || entry.packageName === systemId || entry.packageName === "pf2e") ?? null;
  }

  #preferSystem(entries) {
    return this.#systemOnly(entries) ?? entries[0] ?? null;
  }

  async #resolveConfiguredSpellcastingTemplate(kind, rank, expectedType) {
    const key = `${kind}:${rank}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const config = this.configProvider?.();
    const definition = config?.PF2E?.spellcastingItems?.[kind];
    const uuid = definition?.compendiumUuids?.[rank] ?? definition?.compendiumUuids?.[String(rank)] ?? null;
    if (!uuid) {
      this.cache.set(key, null);
      return null;
    }
    const document = await this.uuidResolver?.(uuid);
    const source = document?.type === expectedType && typeof document.toObject === "function" ? document.toObject() : null;
    const template = source ? { uuid, source, kind, sourceType: "implementation-template" } : null;
    this.cache.set(key, template);
    return template;
  }
}
