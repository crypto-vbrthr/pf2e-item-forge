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
import { SpellheartProfileRegistry, registerCoreSpellheartProfiles } from "../src/engine/registries/spellheart-profile-registry.js";
import { WandProfileRegistry, registerCoreWandProfiles } from "../src/engine/registries/wand-profile-registry.js";
import { StaffProfileRegistry, registerCoreStaffProfiles } from "../src/engine/registries/staff-profile-registry.js";
import { SpecificItemProfileRegistry, registerCoreSpecificItemProfiles } from "../src/engine/registries/specific-item-profile-registry.js";
import { getSelectableMagicThemes } from "../src/engine/magic-themes.js";
import { TreasureRegistry } from "../src/engine/registries/treasure-registry.js";
import { registerCoreTreasureContent } from "../src/engine/treasure/core-treasure-content.js";
import { PropertyRuneRegistry, registerCorePropertyRunes } from "../src/engine/registries/property-rune-registry.js";
import { ItemForgeEngine } from "../src/engine/item-forge-engine.js";
import { ItemForgeApi } from "../src/api/item-forge-api.js";
import { ItemForgeApplication } from "../src/app/item-forge-application.js";
import { MagicItemTemplateResolver } from "../src/engine/magic-item-template-resolver.js";
import { MagicItemDiagnostics } from "../src/engine/magic-item-diagnostics.js";

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

  game.settings.register(MODULE_ID, "defaultSourceMode", {
    name: t("PF2E_ITEM_FORGE.Settings.DefaultSourceMode.Name"),
    hint: t("PF2E_ITEM_FORGE.Settings.DefaultSourceMode.Hint"),
    scope: "world",
    config: true,
    type: String,
    choices: {
      all: t("PF2E_ITEM_FORGE.SourceMode.All"),
      system: t("PF2E_ITEM_FORGE.SourceMode.System"),
      selected: t("PF2E_ITEM_FORGE.SourceMode.Selected")
    },
    default: "all"
  });
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
  const templateResolver = new MagicItemTemplateResolver({ compendiumIndex });
  generators.register(new TreasureGenerator({ categories, treasure }), { priority: 200, modes: ["treasure"] });
  generators.register(new WandGenerator({ compendiumIndex, wandProfiles, templateResolver }), { priority: 220, modes: ["magic"] });
  generators.register(new StaffGenerator({ compendiumIndex, staffProfiles, templateResolver }), { priority: 210, modes: ["magic"] });
  generators.register(new SpecificMagicEquipmentGenerator({ compendiumIndex, specificItemProfiles, propertyRunes }), { priority: 218, modes: ["magic"] });
  generators.register(new SpellheartGenerator({ compendiumIndex, spellheartProfiles, templateResolver }), { priority: 215, modes: ["magic"] });
  generators.register(new ScrollGenerator({ compendiumIndex, templateResolver }), { priority: 200, modes: ["existing"] });
  generators.register(new EquipmentGenerator({ compendiumIndex, propertyRunes }), { priority: 150, modes: ["equipment"] });
  generators.register(new ExistingItemGenerator({ compendiumIndex }), { priority: 0, modes: ["existing"] });

  const engine = new ItemForgeEngine({
    categories,
    generators,
    compendiumIndex,
    defaultOptions: () => ({
      defaultSourceMode: game.settings.get(MODULE_ID, "defaultSourceMode"),
      defaultSolverAttempts: game.settings.get(MODULE_ID, "defaultSolverAttempts")
    })
  });

  const openApplication = (options = {}) => {
    if (!application || !application.rendered) application = new ItemForgeApplication({ api, ...options });
    application.render({ force: true });
    return application;
  };

  const itemForgeApi = new ItemForgeApi({ engine, categories, generators, compendiumIndex, treasure, propertyRunes, magicThemes: getSelectableMagicThemes(), wandProfiles, staffProfiles, spellheartProfiles, specificItemProfiles, openApplication });
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
