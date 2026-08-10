import { MODULE_ID, DEFAULT_SOLVER_ATTEMPTS } from "../src/constants.js";
import { CategoryRegistry, registerCoreCategories } from "../src/engine/category-registry.js";
import { CompendiumIndex } from "../src/engine/compendium-index.js";
import { GeneratorRegistry } from "../src/engine/generator-registry.js";
import { ExistingItemGenerator } from "../src/engine/generators/existing-item-generator.js";
import { ScrollGenerator } from "../src/engine/generators/scroll-generator.js";
import { EquipmentGenerator } from "../src/engine/generators/equipment-generator.js";
import { TreasureGenerator } from "../src/engine/generators/treasure-generator.js";
import { WandGenerator } from "../src/engine/generators/wand-generator.js";
import { StaffGenerator } from "../src/engine/generators/staff-generator.js";
import { SpellheartGenerator } from "../src/engine/generators/spellheart-generator.js";
import { SpecificMagicEquipmentGenerator } from "../src/engine/generators/specific-magic-equipment-generator.js";
import { SpecificMagicShieldGenerator } from "../src/engine/generators/specific-magic-shield-generator.js";
import { WornMagicItemGenerator } from "../src/engine/generators/worn-magic-item-generator.js";
import { AccessoryRuneGenerator } from "../src/engine/generators/accessory-rune-generator.js";
import { HeldMagicItemGenerator } from "../src/engine/generators/held-magic-item-generator.js";
import { GrimoireGenerator } from "../src/engine/generators/grimoire-generator.js";
import { ApexItemGenerator } from "../src/engine/generators/apex-item-generator.js";
import { SpellheartProfileRegistry, registerCoreSpellheartProfiles } from "../src/engine/registries/spellheart-profile-registry.js";
import { WandProfileRegistry, registerCoreWandProfiles } from "../src/engine/registries/wand-profile-registry.js";
import { StaffProfileRegistry, registerCoreStaffProfiles } from "../src/engine/registries/staff-profile-registry.js";
import { SpecificItemProfileRegistry, registerCoreSpecificItemProfiles } from "../src/engine/registries/specific-item-profile-registry.js";
import { SpecificShieldProfileRegistry, registerCoreSpecificShieldProfiles } from "../src/engine/registries/specific-shield-profile-registry.js";
import { WornMagicProfileRegistry, registerCoreWornMagicProfiles } from "../src/engine/registries/worn-magic-profile-registry.js";
import { AccessoryRuneRegistry, registerCoreAccessoryRunes } from "../src/engine/registries/accessory-rune-registry.js";
import { HeldMagicProfileRegistry, registerCoreHeldMagicProfiles } from "../src/engine/registries/held-magic-profile-registry.js";
import { GrimoireProfileRegistry, registerCoreGrimoireProfiles } from "../src/engine/registries/grimoire-profile-registry.js";
import { ApexProfileRegistry, registerCoreApexProfiles } from "../src/engine/registries/apex-profile-registry.js";
import { getSelectableMagicThemes } from "../src/engine/magic-themes.js";
import { TreasureRegistry } from "../src/engine/registries/treasure-registry.js";
import { registerCoreTreasureContent } from "../src/engine/treasure/core-treasure-content.js";
import { PropertyRuneRegistry, registerCorePropertyRunes } from "../src/engine/registries/property-rune-registry.js";
import { ItemForgeEngine } from "../src/engine/item-forge-engine.js";
import { ItemForgeApi } from "../src/api/item-forge-api.js";
import { ItemForgeApplication } from "../src/app/item-forge-application.js";
import { SourceCompendiumSettings } from "../src/app/source-compendium-settings.js";
import { MagicItemTemplateResolver } from "../src/engine/magic-item-template-resolver.js";
import { MagicItemDiagnostics } from "../src/engine/magic-item-diagnostics.js";
import { normalizeSourcePolicy } from "../src/engine/source-policy.js";
import { deserializeSourcePolicy, serializeSourcePolicy } from "../src/engine/source-policy-storage.js";

let application = null;
let api = null;

function t(key) {
  return game.i18n.localize(key);
}

function registerSettings() {
  // Foundry v14's SettingsConfig displays the strings supplied to the setting
  // registration. Localize them eagerly instead of relying on SettingsConfig to
  // resolve module translation keys later.
  game.settings.register(MODULE_ID, "defaultSolverAttempts", {
    name: t("PF2E_ITEM_FORGE.Settings.DefaultSolverAttempts.Name"),
    hint: t("PF2E_ITEM_FORGE.Settings.DefaultSolverAttempts.Hint"),
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_SOLVER_ATTEMPTS,
    range: { min: 1, max: 1000, step: 1 }
  });

  // The complete source policy is edited in one dedicated settings window.
  // The backing values stay hidden so the generic Foundry settings form never
  // exposes a mode selector without the pack list it controls.
  game.settings.register(MODULE_ID, "defaultSourceMode", {
    scope: "world",
    config: false,
    type: String,
    default: "all"
  });

  // The selected pack list is edited through the dedicated source-settings menu.
  // Keeping the backing JSON hidden avoids exposing a brittle raw field in
  // Foundry's generic settings UI.
  game.settings.register(MODULE_ID, "defaultSourcePacks", {
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Canonical full source-policy storage. Legacy mode/include settings remain
  // registered for migration/backwards compatibility, but new writes persist
  // mode, includePacks, and excludePacks together so the public API contract
  // round-trips without loss.
  game.settings.register(MODULE_ID, "defaultSourcePolicy", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.registerMenu(MODULE_ID, "sourceCompendiums", {
    name: t("PF2E_ITEM_FORGE.Settings.SourceCompendiums.Name"),
    label: t("PF2E_ITEM_FORGE.Settings.SourceCompendiums.Label"),
    hint: t("PF2E_ITEM_FORGE.Settings.SourceCompendiums.MenuHint"),
    icon: "fa-solid fa-books",
    type: SourceCompendiumSettings,
    restricted: true
  });
}

function parseStoredPackIds(value) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return [...new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id) : [])];
  } catch (_error) {
    return [];
  }
}

function getStoredSourcePolicy() {
  return deserializeSourcePolicy(game.settings.get(MODULE_ID, "defaultSourcePolicy"), {
    legacyMode: game.settings.get(MODULE_ID, "defaultSourceMode") ?? "all",
    legacyIncludePacks: parseStoredPackIds(game.settings.get(MODULE_ID, "defaultSourcePacks"))
  });
}

async function setStoredSourcePolicy(source = {}) {
  const policy = normalizeSourcePolicy(source);
  await game.settings.set(MODULE_ID, "defaultSourcePolicy", serializeSourcePolicy(policy));
  // Keep the pre-v0.0.36 backing settings synchronized for worlds/modules that
  // still read them directly. They are no longer the canonical store.
  await game.settings.set(MODULE_ID, "defaultSourcePacks", JSON.stringify(policy.includePacks));
  await game.settings.set(MODULE_ID, "defaultSourceMode", policy.mode);
}

function createApi() {
  const categories = registerCoreCategories(new CategoryRegistry());
  const compendiumIndex = new CompendiumIndex({ categoryRegistry: categories });
  const generators = new GeneratorRegistry();
  const treasure = registerCoreTreasureContent(new TreasureRegistry({ categories }));
  const propertyRunes = registerCorePropertyRunes(new PropertyRuneRegistry());
  const wandProfiles = registerCoreWandProfiles(new WandProfileRegistry());
  const staffProfiles = registerCoreStaffProfiles(new StaffProfileRegistry());
  const spellheartProfiles = registerCoreSpellheartProfiles(new SpellheartProfileRegistry());
  const specificItemProfiles = registerCoreSpecificItemProfiles(new SpecificItemProfileRegistry());
  const specificShieldProfiles = registerCoreSpecificShieldProfiles(new SpecificShieldProfileRegistry());
  const wornMagicProfiles = registerCoreWornMagicProfiles(new WornMagicProfileRegistry());
  const accessoryRunes = registerCoreAccessoryRunes(new AccessoryRuneRegistry());
  const heldMagicProfiles = registerCoreHeldMagicProfiles(new HeldMagicProfileRegistry());
  const grimoireProfiles = registerCoreGrimoireProfiles(new GrimoireProfileRegistry());
  const apexProfiles = registerCoreApexProfiles(new ApexProfileRegistry());
  const templateResolver = new MagicItemTemplateResolver({ compendiumIndex });
  generators.register(new TreasureGenerator({ categories, treasure }), { priority: 200, modes: ["treasure"] });
  generators.register(new WandGenerator({ compendiumIndex, wandProfiles, templateResolver }), { priority: 220, modes: ["magic"] });
  generators.register(new StaffGenerator({ compendiumIndex, staffProfiles, templateResolver }), { priority: 210, modes: ["magic"] });
  generators.register(new SpecificMagicShieldGenerator({ compendiumIndex, specificShieldProfiles }), { priority: 219, modes: ["magic"] });
  generators.register(new SpecificMagicEquipmentGenerator({ compendiumIndex, specificItemProfiles, propertyRunes }), { priority: 218, modes: ["magic"] });
  generators.register(new WornMagicItemGenerator({ compendiumIndex, wornMagicProfiles, templateResolver }), { priority: 217, modes: ["magic"] });
  generators.register(new AccessoryRuneGenerator({ compendiumIndex, accessoryRunes }), { priority: 216, modes: ["magic"] });
  generators.register(new HeldMagicItemGenerator({ compendiumIndex, heldMagicProfiles, templateResolver }), { priority: 214, modes: ["magic"] });
  generators.register(new GrimoireGenerator({ compendiumIndex, grimoireProfiles, templateResolver }), { priority: 213, modes: ["magic"] });
  generators.register(new ApexItemGenerator({ compendiumIndex, apexProfiles, templateResolver }), { priority: 212, modes: ["magic"] });
  generators.register(new SpellheartGenerator({ compendiumIndex, spellheartProfiles, templateResolver }), { priority: 215, modes: ["magic"] });
  generators.register(new ScrollGenerator({ compendiumIndex, templateResolver }), { priority: 200, modes: ["existing"] });
  generators.register(new EquipmentGenerator({ compendiumIndex, propertyRunes }), { priority: 150, modes: ["equipment"] });
  generators.register(new ExistingItemGenerator({ compendiumIndex }), { priority: 0, modes: ["existing"] });

  const engine = new ItemForgeEngine({
    categories,
    generators,
    compendiumIndex,
    defaultOptions: () => {
      const sourcePolicy = getStoredSourcePolicy();
      return {
        defaultSourceMode: sourcePolicy.mode,
        defaultSourcePacks: sourcePolicy.includePacks,
        defaultExcludedPacks: sourcePolicy.excludePacks,
        defaultSolverAttempts: game.settings.get(MODULE_ID, "defaultSolverAttempts")
      };
    }
  });

  const openApplication = (options = {}) => {
    if (!application || !application.rendered) {
      application = new ItemForgeApplication({ api, ...options });
    } else if (Object.hasOwn(options, "request")) {
      application.setRequest(options.request ?? {});
    }
    application.render({ force: true });
    return application;
  };

  const itemForgeApi = new ItemForgeApi({
    engine, categories, generators, compendiumIndex, treasure, propertyRunes,
    magicThemes: getSelectableMagicThemes(), wandProfiles, staffProfiles, spellheartProfiles,
    specificItemProfiles, specificShieldProfiles, wornMagicProfiles, accessoryRunes,
    heldMagicProfiles, grimoireProfiles, apexProfiles,
    sourcePolicyStore: { get: getStoredSourcePolicy, set: setStoredSourcePolicy },
    openApplication
  });
  itemForgeApi.diagnostics = new MagicItemDiagnostics({ api: itemForgeApi });
  return itemForgeApi;
}

function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  game.pf2eItemForge = api;
}

function getRootElement(app, element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  if (app?.element instanceof HTMLElement) return app.element;
  return null;
}

/**
 * Foundry v14 exposes DocumentDirectory#documentName. PF2e may subclass the
 * core ItemDirectory, so constructor-name checks are intentionally avoided.
 */
function isItemDirectory(app) {
  if (!app) return false;
  try {
    if (app.documentName === "Item") return true;
  } catch (_error) {
    // Ignore accessors which are not available on an application.
  }
  return app.tabName === "items" && Boolean(app.collection);
}

function findDirectoryButtonHost(root) {
  if (!root) return null;

  // The ApplicationV2 hook can provide either the full application element or
  // the HTML for a rendered part. Support both shapes.
  if (root.matches?.(".header-actions")) return root;
  if (root.matches?.(".directory-header")) {
    return root.querySelector(".header-actions") ?? root;
  }
  if (root.matches?.('[data-application-part="header"]')) {
    return root.querySelector(".header-actions") ?? root;
  }

  return root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".header-actions")
    ?? root.querySelector(".directory-header")
    ?? root.querySelector('[data-application-part="header"]')
    ?? root.querySelector(":scope > header");
}

function addDirectoryButton(app, element) {
  if (!api || !isItemDirectory(app)) return false;
  const root = getRootElement(app, element);
  if (!root || root.querySelector(`[data-${MODULE_ID}-open]`)) return false;

  const host = findDirectoryButtonHost(root);
  if (!host) return false;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("item-forge-directory-button");
  button.setAttribute(`data-${MODULE_ID}-open`, "true");
  button.innerHTML = `<i class="fa-solid fa-hammer"></i><span>${t("PF2E_ITEM_FORGE.Button.Open")}</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    api.open();
  });
  host.append(button);
  return true;
}

function ensureCurrentItemDirectoryButton() {
  const directory = ui?.items ?? ui?.sidebar?.tabs?.items ?? null;
  if (!directory) return;

  // The sidebar may already have rendered before the ready hook. Inject now,
  // and retry one animation frame later in case a v14 part render is pending.
  addDirectoryButton(directory, directory.element);
  requestAnimationFrame(() => addDirectoryButton(directory, directory.element));
}

Hooks.once("init", () => {
  registerSettings();

  // Build and expose the API during init so directory render hooks which fire
  // before ready can already create a working Item Forge button.
  api = createApi();
  exposeApi();
});

Hooks.once("ready", async () => {
  try {
    await api.refreshIndex();
  } catch (error) {
    console.error("PF2E Item Forge | Initial compendium index failed", error);
  }

  ensureCurrentItemDirectoryButton();
  Hooks.callAll("pf2eItemForgeReady", api);
  console.log(`PF2E Item Forge | Ready (API v${api.apiVersion})`);
});

// Specific and generic ApplicationV2 hooks are both intentional. PF2e can
// subclass ItemDirectory; documentName keeps the generic fallback narrowly
// restricted to the World Item directory.
Hooks.on("renderItemDirectory", addDirectoryButton);
Hooks.on("renderDocumentDirectory", addDirectoryButton);
Hooks.on("renderApplicationV2", addDirectoryButton);
