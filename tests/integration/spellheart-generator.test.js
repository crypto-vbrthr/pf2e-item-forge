import test from "node:test";
import assert from "node:assert/strict";
import { SpellheartGenerator } from "../../src/engine/generators/spellheart-generator.js";

function request(overrides = {}) {
  return {
    mode: "magic",
    category: "magic.spellheart",
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "strict",
    rarity: [],
    source: { mode: "all", includePacks: [], excludePacks: [] },
    seed: "spellheart-seed",
    ...overrides
  };
}

function entry(id, level, { rarity = "common" } = {}) {
  return {
    id,
    uuid: `Compendium.pf2e.equipment.Item.${id}`,
    pack: "pf2e.equipment",
    packageType: "system",
    packageName: "pf2e",
    name: id,
    type: "equipment",
    level,
    rarity,
    traits: ["magical", "spellheart"],
    usage: "affixed-to-armor-or-a-weapon",
    categories: ["item", "equipment", "magic", "magic.spellheart"]
  };
}

function documentFor(selected) {
  return {
    toObject: () => ({
      _id: selected.id,
      name: selected.name,
      type: "equipment",
      img: "spellheart.webp",
      system: {
        level: { value: selected.level },
        price: { value: { gp: 325 } },
        usage: { value: "affixed-to-armor-or-a-weapon" },
        traits: { value: ["magical", "spellheart"], rarity: selected.rarity },
        description: { value: "<p>Armor benefit.</p><p>Weapon benefit.</p><p>Activate Cast a Spell.</p>" },
        rules: [{ key: "FlatModifier", selector: "test", value: 1 }]
      }
    })
  };
}

function setup(entries) {
  return new SpellheartGenerator({
    compendiumIndex: {
      ready: true,
      query: () => entries,
      getDocument: async (selected) => documentFor(selected)
    }
  });
}

test("SpellheartGenerator preserves complete predefined PF2e spellheart rules", async () => {
  const selected = entry("warding-statuette", 7);
  const result = await setup([selected]).generate(request());
  assert.equal(result.metadata.generator, "spellheart");
  assert.equal(result.metadata.magic.kind, "spellheart");
  assert.equal(result.metadata.level, 7);
  assert.equal(result.itemSource._id, null);
  assert.deepEqual(result.itemSource.system.rules, [{ key: "FlatModifier", selector: "test", value: 1 }]);
  assert.match(result.itemSource.system.description.value, /Armor benefit/);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].spellheart.mode, "existing");
});

test("SpellheartGenerator respects strict item-level selection", async () => {
  await assert.rejects(
    () => setup([entry("low", 5), entry("high", 9)]).generate(request()),
    (error) => error?.code === "NO_PREDEFINED_SPELLHEART_CANDIDATE"
  );
});

test("SpellheartGenerator nearest policy selects the closest published level with a warning", async () => {
  const result = await setup([entry("low", 5), entry("high", 9)]).generate(request({
    level: { min: 7, max: 7, target: 7 },
    levelPolicy: "nearest"
  }));
  assert.ok([5, 9].includes(result.metadata.level));
  assert.equal(result.warnings[0]?.code, "LEVEL_TARGET_APPROXIMATED");
});

test("SpellheartGenerator is deterministic for identical seeds", async () => {
  const generator = setup([entry("a", 7), entry("b", 7), entry("c", 7)]);
  const first = await generator.generate(request({ seed: "same" }));
  const second = await generator.generate(request({ seed: "same" }));
  assert.equal(first.metadata.sourceUuid, second.metadata.sourceUuid);
});

function spell(id, { rank = 1, cantrip = false, traits = ["fire"], heightening = null, rarity = "common" } = {}) {
  return {
    id,
    uuid: `Compendium.pf2e.spells.Item.${id}`,
    pack: "pf2e.spells",
    name: id,
    type: "spell",
    baseRank: cantrip ? 0 : rank,
    rank: cantrip ? 0 : rank,
    rarity,
    traits,
    cantrip,
    ritual: false,
    focus: false,
    heightening
  };
}

function generatedSetup(spells, { templateLevel = 3 } = {}) {
  const template = entry("template-heart", templateLevel);
  return new SpellheartGenerator({
    compendiumIndex: {
      ready: true,
      entries: [template],
      query: () => [template],
      querySpells: () => spells,
      getDocument: async () => ({
        toObject: () => ({
          _id: template.id,
          name: "Published Template",
          type: "equipment",
          img: "published.webp",
          system: {
            level: { value: templateLevel },
            price: { value: { gp: 55 } },
            usage: { value: "affixed-to-armor-or-a-weapon" },
            traits: { value: ["magical", "spellheart", "cold"], rarity: "common" },
            description: { value: "<p>Published rules.</p>" },
            rules: [{ key: "PublishedRuleThatMustNotLeak" }],
            slug: "published-template"
          }
        })
      })
    },
    formatter: (key, data = {}) => {
      const table = {
        "PF2E_ITEM_FORGE.SpellheartText.ElementalDescription": "Elemental heart.",
        "PF2E_ITEM_FORGE.SpellheartText.ElementalName": `${data.variant ?? ""} ${data.theme ?? ""} heart`.trim(),
        "PF2E_ITEM_FORGE.SpellheartText.ElementalArmor": `Resistance ${data.resistance ?? "?"} ${data.damage ?? ""}.`,
        "PF2E_ITEM_FORGE.SpellheartText.ElementalWeapon": `Weapon +${data.weaponDamage ?? "?"} ${data.damage ?? ""}.`,
        "PF2E_ITEM_FORGE.SpellheartText.StandardActivation": "Activate Cast a Spell",
        "PF2E_ITEM_FORGE.SpellheartText.SpellStatistics": `Attack ${data.spellAttack}; DC ${data.spellDC}.`,
        "PF2E_ITEM_FORGE.SpellheartText.OncePerDay": "once per day",
        "PF2E_ITEM_FORGE.SpellheartText.Armor": "Armor",
        "PF2E_ITEM_FORGE.SpellheartText.Weapon": "Weapon",
        "PF2E_ITEM_FORGE.SpellheartText.AutomationNote": "Rules-text automation note.",
        "PF2E_ITEM_FORGE.Magic.Cantrip": "Cantrip",
        "PF2E_ITEM_FORGE.Magic.SpellRankLabel": `Rank ${data.rank ?? "?"}`,
        "PF2E_ITEM_FORGE.Magic.HeightenedShort": `heightened ${data.rank ?? "?"}`,
        "PF2E_ITEM_FORGE.MagicThemes.Fire": "Fire",
        "PF2E_ITEM_FORGE.Damage.Fire": "fire",
        "PF2E_ITEM_FORGE.SpellheartProfiles.ElementalConduit": "Elemental Conduit",
        "PF2E_ITEM_FORGE.SpellheartVariants.Base": "Base",
        "PF2E_ITEM_FORGE.SpellheartVariants.Greater": "Greater",
        "PF2E_ITEM_FORGE.SpellheartVariants.Major": "Major"
      };
      return table[key] ?? key;
    }
  });
}

function generatedRequest(overrides = {}) {
  return request({
    level: { min: 3, max: 3, target: 3 },
    magic: {
      spellheartMode: "generated",
      spellheartProfile: "core.elemental-conduit",
      theme: "fire",
      allowHeightened: true
    },
    ...overrides
  });
}

test("generated spellheart composes a coherent profile and removes unrelated template Rule Elements", async () => {
  const generator = generatedSetup([
    spell("ignition", { cantrip: true, traits: ["fire"] })
  ]);
  const result = await generator.generate(generatedRequest());
  assert.equal(result.metadata.spellheart.mode, "generated");
  assert.equal(result.metadata.spellheart.profile, "core.elemental-conduit");
  assert.equal(result.metadata.spellheart.variant, "base");
  assert.equal(result.metadata.spellheart.theme, "fire");
  assert.equal(result.metadata.level, 3);
  assert.equal(result.itemSource.system.price.value.gp, 60);
  assert.deepEqual(result.itemSource.system.rules, []);
  assert.equal(result.itemSource.system.slug, null);
  assert.ok(result.itemSource.system.traits.value.includes("spellheart"));
  assert.ok(result.itemSource.system.traits.value.includes("fire"));
  assert.match(result.itemSource.system.description.value, /ignition/);
  assert.match(result.itemSource.system.description.value, /Resistance 2 fire/);
  assert.equal(result.itemSource.flags["pf2e-item-forge"].spellheart.automation, "rules-text");
});

test("generated greater elemental spellheart selects an appropriate daily spell and scales profile values", async () => {
  const generator = generatedSetup([
    spell("ignition", { cantrip: true, traits: ["fire"] }),
    spell("fireball", { rank: 3, traits: ["fire"] })
  ]);
  const result = await generator.generate(generatedRequest({
    level: { min: 8, max: 8, target: 8 }
  }));
  assert.equal(result.metadata.level, 8);
  assert.equal(result.itemSource.system.price.value.gp, 450);
  assert.equal(result.metadata.spellheart.spellDC, 24);
  assert.equal(result.metadata.spellheart.spellAttack, 14);
  assert.match(result.metadata.spellheart.armorEffect, /5/);
  assert.match(result.metadata.spellheart.weaponEffect, /1d6/);
  assert.equal(result.metadata.spells.filter((s) => !s.cantrip).length, 1);
  assert.equal(result.metadata.spells.find((s) => !s.cantrip).rank, 3);
});

test("generated spellheart can use a meaningfully heightened spell but never downranks it", async () => {
  const generator = generatedSetup([
    spell("ignition", { cantrip: true, traits: ["fire"] }),
    spell("scorching-ray", { rank: 1, traits: ["fire"], heightening: { type: "interval", interval: 1 } })
  ]);
  const result = await generator.generate(generatedRequest({
    level: { min: 8, max: 8, target: 8 }
  }));
  const daily = result.metadata.spells.find((s) => !s.cantrip);
  assert.equal(daily.baseRank, 1);
  assert.equal(daily.rank, 3);
  assert.equal(daily.heightened, true);

  await assert.rejects(
    () => generatedSetup([
      spell("ignition", { cantrip: true, traits: ["fire"] }),
      spell("too-high", { rank: 4, traits: ["fire"] })
    ]).generate(generatedRequest({ level: { min: 8, max: 8, target: 8 } })),
    (error) => error?.code === "NO_SPELLHEART_SPELL_CANDIDATE"
  );
});

test("generated spellheart honors allowHeightened false", async () => {
  await assert.rejects(
    () => generatedSetup([
      spell("ignition", { cantrip: true, traits: ["fire"] }),
      spell("scorching-ray", { rank: 1, traits: ["fire"], heightening: { type: "interval", interval: 1 } })
    ]).generate(generatedRequest({
      level: { min: 8, max: 8, target: 8 },
      magic: {
        spellheartMode: "generated",
        spellheartProfile: "core.elemental-conduit",
        theme: "fire",
        allowHeightened: false
      }
    })),
    (error) => error?.code === "NO_SPELLHEART_SPELL_CANDIDATE"
  );
});

test("generated spellheart is deterministic for identical seeds", async () => {
  const generator = generatedSetup([
    spell("ignition", { cantrip: true, traits: ["fire"] }),
    spell("fireball", { rank: 3, traits: ["fire"] }),
    spell("blazing-bolt", { rank: 3, traits: ["fire"] })
  ]);
  const first = await generator.generate(generatedRequest({ level: { min: 8, max: 8, target: 8 }, seed: "same-custom" }));
  const second = await generator.generate(generatedRequest({ level: { min: 8, max: 8, target: 8 }, seed: "same-custom" }));
  assert.deepEqual(first.metadata.spells, second.metadata.spells);
  assert.equal(first.itemSource.name, second.itemSource.name);
});

test("generated spellheart rejects an unknown custom profile", async () => {
  await assert.rejects(
    () => generatedSetup([spell("ignition", { cantrip: true, traits: ["fire"] })]).generate(generatedRequest({
      magic: { spellheartMode: "generated", spellheartProfile: "does.not.exist", theme: "fire", allowHeightened: true }
    })),
    (error) => error?.code === "UNKNOWN_SPELLHEART_PROFILE"
  );
});
