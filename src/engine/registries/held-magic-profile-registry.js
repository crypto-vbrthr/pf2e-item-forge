import { normalizeBalanceMetadata } from "./profile-balance.js";
import { validateGeneratedProfileAutomation } from "../generation-contract.js";

const VALID_RARITIES = new Set(["common", "uncommon", "rare", "unique"]);

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase()))];
}

export class HeldMagicProfileRegistry {
  #profiles = new Map();

  register(definition) {
    const id = String(definition?.id ?? "").trim();
    if (!id) throw new TypeError("Held magic profile requires a string id");
    if (this.#profiles.has(id)) throw new Error(`Duplicate held magic profile: ${id}`);

    const hands = Number(definition?.hands);
    if (![1, 2].includes(hands)) throw new Error(`Held magic profile ${id} requires hands 1 or 2`);

    const variants = Array.isArray(definition.variants)
      ? definition.variants.map((variant, index) => ({
          id: String(variant.id ?? ["base", "greater", "major", "supreme"][index] ?? `tier-${index + 1}`).trim(),
          label: variant.label ?? null,
          level: Number(variant.level),
          price: Number(variant.price),
          values: structuredClone(variant.values ?? {})
        }))
      : [];
    if (!variants.length) throw new Error(`Held magic profile ${id} requires at least one variant`);

    let lastLevel = -Infinity;
    const ids = new Set();
    for (const variant of variants) {
      if (!variant.id) throw new Error(`Held magic profile ${id} has an empty variant id`);
      if (ids.has(variant.id)) throw new Error(`Held magic profile ${id} has duplicate variant id ${variant.id}`);
      ids.add(variant.id);
      if (!Number.isInteger(variant.level) || variant.level < 1 || variant.level > 20) throw new Error(`Invalid held magic item level in ${id}`);
      if (variant.level <= lastLevel) throw new Error(`Held magic profile ${id} variants must increase in level`);
      if (!Number.isFinite(variant.price) || variant.price <= 0) throw new Error(`Invalid held magic item price in ${id}`);
      lastLevel = variant.level;
    }

    const rarity = String(definition.rarity ?? "common").trim().toLowerCase();
    if (!VALID_RARITIES.has(rarity)) throw new Error(`Held magic profile ${id} has invalid rarity ${rarity}`);
    if (definition.invested !== undefined && typeof definition.invested !== "boolean") throw new TypeError(`Held magic profile ${id} invested must be boolean`);

    const profile = {
      id,
      hands,
      label: definition.label ?? id,
      description: definition.description ?? null,
      nameTemplate: definition.nameTemplate ?? null,
      effectText: definition.effectText ?? null,
      rarity,
      invested: definition.invested === true,
      traits: uniqueStrings(definition.traits),
      automation: validateGeneratedProfileAutomation(definition.automation, { kind: "Held magic profile", id }),
      balance: normalizeBalanceMetadata(definition.balance, { basis: "unspecified", reviewed: false }),
      variants
    };
    this.#profiles.set(id, profile);
    return profile;
  }

  get(id) { return this.#profiles.get(id) ?? null; }
  getAll() { return [...this.#profiles.values()]; }
  getForHands(hands) { return this.getAll().filter((profile) => profile.hands === Number(hands)); }
  has(id) { return this.#profiles.has(id); }
}

export function registerCoreHeldMagicProfiles(registry = new HeldMagicProfileRegistry()) {
  const shared = { basis: "published-analogs", reviewed: true, analogs: ["treasure-vault-held-items"], notes: "Homebrew held-item profiles benchmarked against Treasure Vault permanent held-item level/price bands and activation cadence." };
  const variants = {
    lantern: [
      ["base",1,15,{radius:10,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerDay"}],
      ["greater",6,225,{radius:20,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["major",11,1250,{radius:30,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["supreme",16,9000,{radius:40,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"}]
    ],
    prism: [
      ["base",2,30,{bonus:1,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerDay"}],
      ["greater",7,330,{bonus:1,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["major",12,1800,{bonus:2,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["supreme",17,13000,{bonus:3,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"}]
    ],
    baton: [
      ["base",3,55,{temp:3,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerDay"}],
      ["greater",8,450,{temp:8,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["major",13,2700,{temp:13,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["supreme",18,19000,{temp:18,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"}]
    ],
    stormglass: [
      ["base",4,90,{distance:10,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerDay"}],
      ["greater",9,650,{distance:20,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["major",14,4000,{distance:30,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["supreme",19,40000,{distance:40,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"}]
    ],
    standard: [
      ["base",5,140,{bonus:1,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerDay"}],
      ["greater",10,900,{bonus:1,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["major",15,6000,{bonus:2,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerHour"}],
      ["supreme",20,70000,{bonus:3,frequency:"PF2E_ITEM_FORGE.HeldText.OncePerTenMinutes"}]
    ]
  };

  const specs = [
    ["core.waylight-lantern",1,"PF2E_ITEM_FORGE.HeldProfiles.WaylightLantern","PF2E_ITEM_FORGE.HeldText.WaylightLanternName","PF2E_ITEM_FORGE.HeldText.WaylightLanternDescription","PF2E_ITEM_FORGE.HeldText.WaylightLanternEffect",variants.lantern,["light"]],
    ["core.scholar-prism",1,"PF2E_ITEM_FORGE.HeldProfiles.ScholarPrism","PF2E_ITEM_FORGE.HeldText.ScholarPrismName","PF2E_ITEM_FORGE.HeldText.ScholarPrismDescription","PF2E_ITEM_FORGE.HeldText.ScholarPrismEffect",variants.prism,[]],
    ["core.resonance-baton",1,"PF2E_ITEM_FORGE.HeldProfiles.ResonanceBaton","PF2E_ITEM_FORGE.HeldText.ResonanceBatonName","PF2E_ITEM_FORGE.HeldText.ResonanceBatonDescription","PF2E_ITEM_FORGE.HeldText.ResonanceBatonEffect",variants.baton,[]],
    ["core.stormglass-sphere",2,"PF2E_ITEM_FORGE.HeldProfiles.StormglassSphere","PF2E_ITEM_FORGE.HeldText.StormglassSphereName","PF2E_ITEM_FORGE.HeldText.StormglassSphereDescription","PF2E_ITEM_FORGE.HeldText.StormglassSphereEffect",variants.stormglass,["air"]],
    ["core.guardian-standard",2,"PF2E_ITEM_FORGE.HeldProfiles.GuardianStandard","PF2E_ITEM_FORGE.HeldText.GuardianStandardName","PF2E_ITEM_FORGE.HeldText.GuardianStandardDescription","PF2E_ITEM_FORGE.HeldText.GuardianStandardEffect",variants.standard,[]]
  ];
  for (const [id,hands,label,nameTemplate,description,effectText,rows,traits] of specs) {
    registry.register({ id, hands, label, nameTemplate, description, effectText, traits, balance: shared, variants: rows.map(([vid,level,price,values],i)=>({ id:vid, label:["PF2E_ITEM_FORGE.SpecificItemVariants.Base","PF2E_ITEM_FORGE.SpecificItemVariants.Greater","PF2E_ITEM_FORGE.SpecificItemVariants.Major","PF2E_ITEM_FORGE.SpecificItemVariants.Supreme"][i], level, price, values })) });
  }
  return registry;
}
