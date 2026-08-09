const T = (de, en) => ({ de, en });

function registerAll(registry, entries) {
  for (const entry of entries) registry.register(entry);
}

export function registerCoreTreasureContent(treasure) {
  registerAll(treasure.materials, [
    { id: "core.material.copper", label: T("Kupfer", "copper"), tags: ["metal", "workable", "tableware", "ceremonial", "jewelry"], valueFactor: 0.7 },
    { id: "core.material.bronze", label: T("Bronze", "bronze"), tags: ["metal", "workable", "art", "tableware", "ceremonial", "jewelry"], valueFactor: 0.85 },
    { id: "core.material.pewter", label: T("Zinn", "pewter"), tags: ["metal", "workable", "tableware"], valueFactor: 0.75 },
    { id: "core.material.silver", label: T("Silber", "silver"), tags: ["metal", "precious", "workable", "jewelry", "tableware", "ceremonial", "luxury"], valueFactor: 1.55 },
    { id: "core.material.gold", label: T("Gold", "gold"), tags: ["metal", "precious", "workable", "jewelry", "tableware", "ceremonial", "luxury"], valueFactor: 2.8 },
    { id: "core.material.platinum", label: T("Platin", "platinum"), tags: ["metal", "precious", "workable", "jewelry", "luxury"], valueFactor: 4.2 },
    { id: "core.material.walnut", label: T("Walnussholz", "walnut wood"), tags: ["wood", "carved", "frame", "luxury", "art"], valueFactor: 1.05 },
    { id: "core.material.oak", label: T("Eichenholz", "oak"), tags: ["wood", "carved", "frame", "container", "art"], valueFactor: 0.9 },
    { id: "core.material.ebony", label: T("Ebenholz", "ebony"), tags: ["wood", "precious", "carved", "frame", "luxury", "art"], valueFactor: 1.8 },
    { id: "core.material.marble", label: T("Marmor", "marble"), tags: ["stone", "art", "sculpture", "ceremonial"], valueFactor: 1.35 },
    { id: "core.material.alabaster", label: T("Alabaster", "alabaster"), tags: ["stone", "art", "sculpture", "fragile"], valueFactor: 1.25 },
    { id: "core.material.jade", label: T("Jade", "jade"), tags: ["stone", "precious", "jewelry", "art", "luxury"], valueFactor: 2.2 },
    { id: "core.material.porcelain", label: T("Porzellan", "porcelain"), tags: ["ceramic", "fragile", "tableware", "art", "luxury"], valueFactor: 1.35 },
    { id: "core.material.glass", label: T("Glas", "glass"), tags: ["glass", "fragile", "tableware", "container", "luxury"], valueFactor: 0.95 },
    { id: "core.material.crystal", label: T("Kristallglas", "crystal glass"), tags: ["glass", "fragile", "precious", "tableware", "container", "luxury"], valueFactor: 1.65 },
    { id: "core.material.silk", label: T("Seide", "silk"), tags: ["fabric", "precious", "textile", "luxury"], valueFactor: 1.6 },
    { id: "core.material.wool", label: T("feine Wolle", "fine wool"), tags: ["fabric", "textile"], valueFactor: 0.9 },
    { id: "core.material.leather", label: T("Leder", "leather"), tags: ["leather", "binding", "container"], valueFactor: 1.0 },
    { id: "core.material.parchment", label: T("Pergament", "parchment"), tags: ["paper", "book", "art"], valueFactor: 1.05 },
    { id: "core.material.canvas", label: T("Leinwand", "canvas"), tags: ["fabric", "painting"], valueFactor: 0.8 },
    { id: "core.material.amethyst", label: T("Amethyst", "amethyst"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.35, componentValue: [4, 18] },
    { id: "core.material.garnet", label: T("Granat", "garnet"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.25, componentValue: [3, 15] },
    { id: "core.material.opal", label: T("Opal", "opal"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.8, componentValue: [8, 35] },
    { id: "core.material.pearl", label: T("Perle", "pearl"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.55, componentValue: [6, 28] },
    { id: "core.material.lapis", label: T("Lapislazuli", "lapis lazuli"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.3, componentValue: [4, 20] },
    { id: "core.material.onyx", label: T("Onyx", "onyx"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.45, componentValue: [5, 24] },
    { id: "core.material.ruby", label: T("Rubin", "ruby"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.7, componentValue: [20, 90] },
    { id: "core.material.sapphire", label: T("Saphir", "sapphire"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.6, componentValue: [18, 85] },
    { id: "core.material.emerald", label: T("Smaragd", "emerald"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.9, componentValue: [22, 100] }
  ]);

  registerAll(treasure.conditions, [
    { id: "core.condition.pristine", label: T("makellos", "pristine"), sentence: T("Der Gegenstand ist makellos erhalten.", "The item is in pristine condition."), valueFactor: 1.2, weight: 5 },
    { id: "core.condition.excellent", label: T("sehr gut erhalten", "excellent"), sentence: T("Der Gegenstand ist außergewöhnlich gut erhalten.", "The item is exceptionally well preserved."), valueFactor: 1.1, weight: 10 },
    { id: "core.condition.good", label: T("gut erhalten", "well preserved"), sentence: T("Der Gegenstand zeigt nur geringe Gebrauchsspuren.", "The item shows only minor signs of use."), valueFactor: 1.0, weight: 32 },
    { id: "core.condition.dusty", label: T("verstaubt", "dusty"), sentence: T("Eine dünne Staubschicht bedeckt die Oberfläche, ohne den Wert wesentlich zu mindern.", "A thin layer of dust covers the surface without materially reducing its value."), valueFactor: 0.98, weight: 18 },
    { id: "core.condition.tarnished", label: T("angelaufen", "tarnished"), sentence: T("Die Metalloberfläche ist sichtbar angelaufen.", "The metal surface is visibly tarnished."), valueFactor: 0.9, weight: 12, requireMaterialTags: ["metal"] },
    { id: "core.condition.scratched", label: T("zerkratzt", "scratched"), sentence: T("Mehrere feine Kratzer zeugen von längerem Gebrauch.", "Several fine scratches attest to long use."), valueFactor: 0.86, weight: 14, excludeMaterialTags: ["paper", "fabric", "liquid"] },
    { id: "core.condition.chipped", label: T("bestoßen", "chipped"), sentence: T("An einer Kante ist ein kleines Stück abgesplittert.", "A small chip is missing from one edge."), valueFactor: 0.78, weight: 7, requireAnyMaterialTags: ["stone", "ceramic", "glass"] },
    { id: "core.condition.worn", label: T("abgenutzt", "worn"), sentence: T("Deutliche, aber rein oberflächliche Abnutzungsspuren sind erkennbar.", "Clear but mostly superficial wear is visible."), valueFactor: 0.82, weight: 12 },
    { id: "core.condition.damaged", label: T("beschädigt", "damaged"), sentence: T("Der Gegenstand ist sichtbar beschädigt, aber noch vollständig genug, um verkauft zu werden.", "The item is visibly damaged, but remains complete enough to be sold."), valueFactor: 0.65, weight: 5 }
  ]);

  registerAll(treasure.craftsmanship, [
    { id: "core.craftsmanship.rude", label: T("grob gearbeitet", "roughly made"), sentence: T("Die Verarbeitung ist grob und zweckmäßig.", "The workmanship is rough and functional."), valueFactor: 0.72, weight: 5 },
    { id: "core.craftsmanship.plain", label: T("schlicht", "plain"), sentence: T("Die Verarbeitung ist schlicht und ohne besondere Feinheiten.", "The workmanship is plain and unadorned."), valueFactor: 0.9, weight: 17 },
    { id: "core.craftsmanship.solid", label: T("solide", "solid"), sentence: T("Der Gegenstand ist solide und fachkundig gefertigt.", "The item is solidly and competently made."), valueFactor: 1.0, weight: 32 },
    { id: "core.craftsmanship.fine", label: T("fein gearbeitet", "finely made"), sentence: T("Feine Details verraten eine sorgfältige, hochwertige Arbeit.", "Fine details reveal careful, high-quality workmanship."), valueFactor: 1.32, weight: 25 },
    { id: "core.craftsmanship.masterful", label: T("meisterlich", "masterfully made"), sentence: T("Die meisterliche Verarbeitung ist selbst für ungeübte Augen sofort erkennbar.", "The masterful workmanship is obvious even to an untrained eye."), valueFactor: 1.85, weight: 15 },
    { id: "core.craftsmanship.exceptional", label: T("außergewöhnlich", "exceptional"), sentence: T("Die Ausführung ist außergewöhnlich präzise und beinahe makellos.", "The execution is exceptionally precise and nearly flawless."), valueFactor: 2.5, weight: 6 }
  ]);

  registerAll(treasure.motifs, [
    { id: "core.motif.heraldry", label: T("heraldisches Motiv", "heraldic motif"), phrase: T("Wappen, Kronen und heraldische Zeichen", "coats of arms, crowns, and heraldic devices"), tags: ["decorative"] },
    { id: "core.motif.religious", label: T("religiöses Motiv", "religious motif"), phrase: T("religiöse Symbole und eine feierliche Szene", "religious symbols and a solemn scene"), tags: ["decorative", "ceremonial"] },
    { id: "core.motif.nature", label: T("Naturmotiv", "nature motif"), phrase: T("Blätter, Tiere und Landschaftsformen", "leaves, animals, and landscape forms"), tags: ["decorative"] },
    { id: "core.motif.maritime", label: T("maritimes Motiv", "maritime motif"), phrase: T("Wellen, Schiffe und Seevögel", "waves, ships, and seabirds"), tags: ["decorative"] },
    { id: "core.motif.hunting", label: T("Jagdmotiv", "hunting motif"), phrase: T("eine Jagdszene mit Reitern und Wild", "a hunting scene with riders and game"), tags: ["decorative"] },
    { id: "core.motif.celestial", label: T("Himmelsmotiv", "celestial motif"), phrase: T("Sterne, Monde und stilisierte Himmelsbahnen", "stars, moons, and stylized celestial paths"), tags: ["decorative"] },
    { id: "core.motif.floral", label: T("florales Motiv", "floral motif"), phrase: T("verschlungene Blüten- und Rankenornamente", "intertwined floral and vine ornaments"), tags: ["decorative"] },
    { id: "core.motif.geometric", label: T("geometrisches Motiv", "geometric motif"), phrase: T("präzise geometrische Muster", "precise geometric patterns"), tags: ["decorative"] },
    { id: "core.motif.ancestral", label: T("Ahnenmotiv", "ancestral motif"), phrase: T("stilisierte Ahnenfiguren und Erinnerungssymbole", "stylized ancestral figures and memorial symbols"), tags: ["decorative", "ceremonial"] }
  ]);

  registerAll(treasure.styles, [
    { id: "core.style.noble", label: T("adlig", "noble"), valueFactor: 1.08, weight: 14 },
    { id: "core.style.dwarven", label: T("zwergisch", "dwarven"), valueFactor: 1.04, weight: 10 },
    { id: "core.style.elven", label: T("elfisch", "elven"), valueFactor: 1.06, weight: 10 },
    { id: "core.style.ancient", label: T("altertümlich", "ancient"), valueFactor: 1.1, weight: 12 },
    { id: "core.style.rustic", label: T("rustikal", "rustic"), valueFactor: 0.92, weight: 18 },
    { id: "core.style.courtly", label: T("höfisch", "courtly"), valueFactor: 1.12, weight: 12 },
    { id: "core.style.temple", label: T("sakral", "sacred"), valueFactor: 1.05, weight: 12 },
    { id: "core.style.merchant", label: T("wohlhabend-bürgerlich", "wealthy mercantile"), valueFactor: 1.0, weight: 12 }
  ]);

  registerAll(treasure.components, [
    { id: "core.component.frame", label: T("Rahmen", "frame"), materialTags: ["wood", "metal"], baseValue: [4, 35], sentence: T("Der Rahmen besteht aus {material}; seine Verarbeitung ist {craftsmanship}.", "The frame is made of {material}; its workmanship is {craftsmanship}.") },
    { id: "core.component.pedestal", label: T("Sockel", "pedestal"), materialTags: ["stone", "wood", "metal"], baseValue: [3, 28], sentence: T("Das Stück steht auf einem Sockel aus {material}.", "The piece stands on a pedestal of {material}.") },
    { id: "core.component.gemstones", label: T("Edelsteineinlage", "gemstone setting"), materialTags: ["gemstone"], baseValue: [4, 18], quantity: [1, 4], sentence: T("{quantity} Einsätze aus {material} setzen kostbare Akzente.", "{quantity} settings of {material} add costly accents.") },
    { id: "core.component.gilding", label: T("Vergoldung", "gilding"), fixedMaterial: "core.material.gold", baseValue: [5, 30], sentence: T("Teile der Oberfläche sind sorgfältig vergoldet.", "Parts of the surface are carefully gilded.") },
    { id: "core.component.engraving", label: T("Gravur", "engraving"), baseValue: [2, 16], sentence: T("Feine Gravuren bedecken Teile der Oberfläche.", "Fine engraving covers parts of the surface.") },
    { id: "core.component.binding", label: T("Einband", "binding"), materialTags: ["leather", "wood"], baseValue: [2, 20], sentence: T("Der Einband besteht aus {material}; seine Verarbeitung ist {craftsmanship}.", "The binding is made of {material}; its workmanship is {craftsmanship}.") },
    { id: "core.component.illustrations", label: T("Illustrationen", "illustrations"), baseValue: [5, 40], sentence: T("Mehrere sorgfältige Illustrationen und Zierinitialen erhöhen den Sammlerwert.", "Several careful illustrations and decorated initials increase its collector value.") },
    { id: "core.component.waxSeal", label: T("Wachssiegel", "wax seal"), baseValue: [1, 5], sentence: T("Das Gefäß ist noch mit einem alten Wachssiegel verschlossen.", "The vessel remains closed with an old wax seal.") }
  ]);

  const type = (id, category, label, options = {}) => treasure.types.register({
    id,
    categories: ["treasure", category],
    label,
    tags: options.tags ?? [],
    baseValue: options.baseValue ?? [5, 30],
    materialTags: options.materialTags ?? [],
    supportsMotif: options.supportsMotif ?? true,
    usesCraftsmanship: options.usesCraftsmanship ?? true,
    components: options.components ?? [],
    attributes: options.attributes ?? {},
    systemCategory: options.systemCategory ?? "art-object",
    img: options.img ?? "systems/pf2e/icons/default-icons/treasure.svg",
    nameTemplates: options.nameTemplates ?? {
      de: ["{type} aus {material}"],
      en: ["{type} of {material}"]
    },
    descriptionTemplates: options.descriptionTemplates ?? {
      de: ["{craftsmanshipSentence} Das Stück besteht überwiegend aus {material}. {motifSentence} {componentSentence} {conditionSentence}"],
      en: ["{craftsmanshipSentence} The piece is made primarily of {material}. {motifSentence} {componentSentence} {conditionSentence}"]
    }
  });

  type("core.type.gem.cut", "treasure.gemstone", T("geschliffener Edelstein", "cut gemstone"), {
    tags: ["gemstone"], baseValue: [8, 80], materialTags: ["gemstone"], supportsMotif: false, systemCategory: "gem",
    nameTemplates: { de: ["Geschliffener {material}"], en: ["Cut {material}"] },
    descriptionTemplates: { de: ["Der Stein wurde {craftsmanship} geschliffen und poliert. {conditionSentence}"], en: ["The stone has been {craftsmanship} cut and polished. {conditionSentence}"] }
  });
  type("core.type.gem.uncut", "treasure.gemstone", T("ungeschliffener Edelstein", "uncut gemstone"), {
    tags: ["gemstone"], baseValue: [4, 45], materialTags: ["gemstone"], supportsMotif: false, systemCategory: "gem",
    nameTemplates: { de: ["Ungeschliffener {material}"], en: ["Uncut {material}"] },
    descriptionTemplates: { de: ["Ein natürlicher {material}, dessen Qualität trotz fehlenden Schliffs gut erkennbar ist. {conditionSentence}"], en: ["A natural {material} whose quality remains clear despite the lack of a finished cut. {conditionSentence}"] }
  });

  type("core.type.art.painting", "treasure.art.painting", T("Gemälde", "painting"), {
    tags: ["painting", "decorative"], baseValue: [12, 90], materialTags: ["painting"], components: [{ id: "core.component.frame", chance: 0.88 }],
    nameTemplates: { de: ["Gemälde mit {motif}", "{style}es Gemälde mit {motif}"], en: ["Painting with {motif}", "{style} painting with {motif}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Das Bild zeigt {motifPhrase}. {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} The painting depicts {motifPhrase}. {componentSentence} {conditionSentence}"] }
  });
  type("core.type.art.portrait", "treasure.art.painting", T("Porträt", "portrait"), {
    tags: ["painting", "decorative"], baseValue: [15, 110], materialTags: ["painting"], components: [{ id: "core.component.frame", chance: 0.92 }],
    nameTemplates: { de: ["Gerahmtes Porträt einer unbekannten Persönlichkeit", "{style}es Porträt"], en: ["Framed portrait of an unknown figure", "{style} portrait"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Das Porträt zeigt eine sorgfältig gekleidete, heute unbekannte Person. {motifSentence} {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} The portrait depicts a carefully dressed figure whose identity is now unknown. {motifSentence} {componentSentence} {conditionSentence}"] }
  });

  for (const [id, label, base] of [
    ["statue", T("Statue", "statue"), [25, 160]],
    ["statuette", T("Statuette", "statuette"), [8, 70]],
    ["bust", T("Büste", "bust"), [12, 95]],
    ["relief", T("Relief", "relief"), [10, 85]]
  ]) type(`core.type.art.${id}`, "treasure.art.sculpture", label, {
    tags: ["sculpture", "decorative"], baseValue: base, materialTags: ["sculpture", "metal", "wood"], components: [{ id: "core.component.pedestal", chance: id === "relief" ? 0.15 : 0.62 }]
  });

  type("core.type.art.tapestry", "treasure.art.textile", T("Wandteppich", "tapestry"), {
    tags: ["textile", "decorative"], baseValue: [18, 140], materialTags: ["textile"], components: [],
    nameTemplates: { de: ["Wandteppich mit {motif}"], en: ["Tapestry with {motif}"] }
  });

  for (const [id, label, base] of [
    ["necklace", T("Halskette", "necklace"), [5, 45]],
    ["ring", T("Ring", "ring"), [3, 35]],
    ["bracelet", T("Armband", "bracelet"), [4, 38]],
    ["anklet", T("Fußkettchen", "anklet"), [4, 32]],
    ["tiara", T("Tiara", "tiara"), [18, 120]],
    ["brooch", T("Brosche", "brooch"), [5, 42]],
    ["earrings", T("Paar Ohrringe", "pair of earrings"), [6, 50]]
  ]) type(`core.type.jewelry.${id}`, "treasure.jewelry", label, {
    tags: ["jewelry", "decorative"], baseValue: base, materialTags: ["jewelry"], components: [
      { id: "core.component.gemstones", chance: id === "tiara" ? 0.82 : 0.48 },
      { id: "core.component.engraving", chance: 0.34 }
    ]
  });

  for (const [id, label, base] of [
    ["goblet", T("Kelch", "goblet"), [5, 48]],
    ["cup", T("Trinkbecher", "drinking cup"), [3, 28]],
    ["plate", T("Teller", "plate"), [3, 25]],
    ["bowl", T("Schale", "bowl"), [4, 32]],
    ["platter", T("Servierplatte", "serving platter"), [7, 55]],
    ["decanter", T("Karaffe", "decanter"), [8, 65]]
  ]) type(`core.type.tableware.${id}`, "treasure.tableware", label, {
    tags: ["tableware", "decorative"], baseValue: base, materialTags: ["tableware"], components: [
      { id: "core.component.gilding", chance: 0.18 },
      { id: "core.component.engraving", chance: 0.35 }
    ]
  });

  for (const [id, label, base] of [
    ["ritual-bowl", T("Ritualschale", "ritual bowl"), [6, 50]],
    ["incense-burner", T("Weihrauchgefäß", "incense burner"), [7, 58]],
    ["idol", T("Kultidol", "cult idol"), [10, 90]],
    ["ceremonial-mask", T("Zeremonienmaske", "ceremonial mask"), [8, 70]]
  ]) type(`core.type.ceremonial.${id}`, "treasure.ceremonial", label, {
    tags: ["ceremonial", "decorative"], baseValue: base, materialTags: ["ceremonial", "art", "wood"], components: [{ id: "core.component.gemstones", chance: 0.22 }]
  });

  for (const [id, label, base] of [
    ["jewelry-box", T("Schmuckkästchen", "jewelry box"), [6, 55]],
    ["mirror", T("Handspiegel", "hand mirror"), [5, 42]],
    ["perfume-bottle", T("Parfümflakon", "perfume bottle"), [4, 36]],
    ["comb", T("Zierkamm", "decorative comb"), [3, 28]],
    ["game-set", T("kunstvolles Spielset", "ornate game set"), [12, 85]],
    ["seal-stamp", T("Siegelstempel", "seal stamp"), [4, 30]],
    ["decorative-box", T("verzierte Schatulle", "decorative box"), [7, 60]]
  ]) type(`core.type.luxury.${id}`, "treasure.luxury", label, {
    tags: ["luxury", "decorative"], baseValue: base, materialTags: ["luxury", "wood", "metal", "glass"], components: [{ id: "core.component.gemstones", chance: 0.16 }, { id: "core.component.engraving", chance: 0.28 }]
  });

  const bookSubjects = {
    chronicle: [T("Chronik eines alten Adelshauses", "chronicle of an old noble house"), T("Stadtchronik", "city chronicle")],
    poetry: [T("Sammlung höfischer Gedichte", "collection of courtly poems"), T("illustrierte Balladensammlung", "illustrated collection of ballads")],
    religious: [T("theologische Abhandlung", "theological treatise"), T("Sammlung alter Hymnen", "collection of old hymns")],
    travel: [T("Reisebericht aus fernen Ländern", "travelogue from distant lands"), T("Bericht einer Seeexpedition", "account of a sea expedition")],
    atlas: [T("handgezeichneter Atlas", "hand-drawn atlas"), T("Küsten- und Hafenatlas", "coastal and harbor atlas")],
    bestiary: [T("illustriertes Bestiarium", "illustrated bestiary"), T("naturkundliche Tierbeschreibung", "natural history of animals")],
    cookbook: [T("Sammlung kostbarer Hofrezepte", "collection of costly court recipes"), T("regionaler Rezeptband", "regional cookbook")],
    manuscript: [T("unveröffentlichtes Manuskript", "unpublished manuscript"), T("handschriftliche Abhandlung", "handwritten treatise")]
  };
  for (const [id, subjects] of Object.entries(bookSubjects)) type(`core.type.book.${id}`, "treasure.book", T("Buch", "book"), {
    tags: ["book"], baseValue: id === "manuscript" ? [8, 100] : [4, 65], materialTags: ["book", "paper"], supportsMotif: false,
    components: [{ id: "core.component.binding", chance: 0.94 }, { id: "core.component.illustrations", chance: ["atlas", "bestiary", "chronicle"].includes(id) ? 0.62 : 0.25 }],
    attributes: { subject: { options: subjects.map((label, index) => ({ id: `${id}-${index}`, label, valueFactor: index ? 1.05 : 1 })) } },
    nameTemplates: { de: ["{subject}"], en: ["{subject}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Der Text ist vollständig genug, um als Sammler- und Handelsgut zu gelten. {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} The text is complete enough to retain value as a collectible and trade good. {componentSentence} {conditionSentence}"] }
  });

  const beverageAttributes = {
    wine: {
      kind: [T("kräftiger Rotwein", "full-bodied red wine"), T("heller Weißwein", "bright white wine"), T("gewürzter Wein", "spiced wine")],
      vessel: [T("Flasche", "bottle"), T("kleines Fässchen", "small cask"), T("Amphore", "amphora")],
      age: [T("junger Jahrgang", "young vintage"), T("gut gereifter Jahrgang", "well-aged vintage"), T("alter Jahrgang", "old vintage")]
    },
    beer: {
      kind: [T("dunkles Starkbier", "dark strong ale"), T("würziges Klosterbier", "spiced abbey ale"), T("helles Lagerbier", "pale lager")],
      vessel: [T("kleines Fässchen", "small cask"), T("Steingutkrug", "stoneware jug")],
      age: [T("frische Abfüllung", "fresh batch"), T("gelagerte Abfüllung", "cellared batch")]
    },
    mead: {
      kind: [T("würziger Honigmet", "spiced honey mead"), T("kräftiger Waldhonigmet", "robust forest-honey mead"), T("heller Blütenmet", "light blossom mead")],
      vessel: [T("Flasche", "bottle"), T("kleines Fässchen", "small cask"), T("Steingutkrug", "stoneware jug")],
      age: [T("frische Abfüllung", "fresh batch"), T("gereifte Abfüllung", "aged batch")]
    },
    spirit: {
      kind: [T("Obstbrand", "fruit brandy"), T("Kräuterlikör", "herbal liqueur"), T("kräftiger Branntwein", "strong spirit")],
      vessel: [T("versiegelte Flasche", "sealed bottle"), T("kleines Fässchen", "small cask"), T("verzierte Karaffe", "decorative decanter")],
      age: [T("mehrjährig gelagert", "aged for several years"), T("lange gereift", "long-aged")]
    }
  };
  for (const [id, attrs] of Object.entries(beverageAttributes)) type(`core.type.beverage.${id}`, `treasure.beverage.${id}`, T("alkoholisches Getränk", "alcoholic beverage"), {
    tags: ["beverage", "liquid"], baseValue: id === "spirit" ? [4, 55] : [2, 40], materialTags: [], supportsMotif: false, usesCraftsmanship: false,
    components: [{ id: "core.component.waxSeal", chance: id === "wine" || id === "spirit" ? 0.58 : 0.2 }],
    attributes: {
      kind: { options: attrs.kind.map((label, index) => ({ id: `${id}-kind-${index}`, label, valueFactor: 1 + index * 0.08 })) },
      vessel: { options: attrs.vessel.map((label, index) => ({ id: `${id}-vessel-${index}`, label, valueFactor: 1 + index * 0.12 })) },
      age: { options: attrs.age.map((label, index) => ({ id: `${id}-age-${index}`, label, valueFactor: 1 + index * 0.22 })) },
      quality: { options: [
        { id: `${id}-quality-0`, label: T("ordentlich", "decent"), valueFactor: 0.9 },
        { id: `${id}-quality-1`, label: T("hochwertig", "high quality"), valueFactor: 1.2 },
        { id: `${id}-quality-2`, label: T("erlesen", "exquisite"), valueFactor: 1.65 }
      ] }
    },
    nameTemplates: { de: ["{vessel}: {kind}"], en: ["{vessel}: {kind}"] },
    descriptionTemplates: { de: ["Inhalt: {kind}. Qualität: {quality}. Altersangabe: {age}. {componentSentence} {conditionSentence}"], en: ["Contents: {kind}. Quality: {quality}. Age: {age}. {componentSentence} {conditionSentence}"] }
  });

  return treasure;
}
