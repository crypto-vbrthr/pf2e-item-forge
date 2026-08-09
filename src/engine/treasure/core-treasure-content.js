const T = (de, en) => ({ de, en });

function registerAll(registry, entries) {
  for (const entry of entries) registry.register(entry);
}

function options(values) {
  return values.map(([id, de, en, valueFactor = 1, valueAddition = 0, weight = 1]) => ({
    id,
    label: T(de, en),
    valueFactor,
    valueAddition,
    weight
  }));
}

export function registerCoreTreasureContent(treasure) {
  registerAll(treasure.materials, [
    { id: "core.material.copper", label: T("Kupfer", "copper"), tags: ["metal", "workable", "tableware", "ceremonial", "jewelry"], valueFactor: 0.7 },
    { id: "core.material.bronze", label: T("Bronze", "bronze"), tags: ["metal", "workable", "art", "tableware", "ceremonial", "jewelry"], valueFactor: 0.85 },
    { id: "core.material.brass", label: T("Messing", "brass"), tags: ["metal", "brass", "workable", "art", "tableware", "luxury", "jewelry"], valueFactor: 0.9 },
    { id: "core.material.pewter", label: T("Zinn", "pewter"), tags: ["metal", "workable", "tableware"], valueFactor: 0.75 },
    { id: "core.material.silver", label: T("Silber", "silver"), tags: ["metal", "precious", "workable", "jewelry", "tableware", "ceremonial", "luxury"], valueFactor: 1.55 },
    { id: "core.material.electrum", label: T("Elektrum", "electrum"), tags: ["metal", "precious", "workable", "jewelry", "tableware", "ceremonial", "luxury"], valueFactor: 2.05 },
    { id: "core.material.gold", label: T("Gold", "gold"), tags: ["metal", "precious", "workable", "jewelry", "tableware", "ceremonial", "luxury"], valueFactor: 2.8 },
    { id: "core.material.platinum", label: T("Platin", "platinum"), tags: ["metal", "precious", "workable", "jewelry", "luxury"], valueFactor: 4.2 },
    { id: "core.material.walnut", label: T("Walnussholz", "walnut wood"), tags: ["wood", "carved", "frame", "luxury", "art"], valueFactor: 1.05 },
    { id: "core.material.oak", label: T("Eichenholz", "oak"), tags: ["wood", "carved", "frame", "container", "art"], valueFactor: 0.9 },
    { id: "core.material.cherrywood", label: T("Kirschholz", "cherrywood"), tags: ["wood", "carved", "frame", "luxury", "art"], valueFactor: 1.2 },
    { id: "core.material.rosewood", label: T("Rosenholz", "rosewood"), tags: ["wood", "precious", "carved", "frame", "luxury", "art"], valueFactor: 1.55 },
    { id: "core.material.ebony", label: T("Ebenholz", "ebony"), tags: ["wood", "precious", "carved", "frame", "luxury", "art"], valueFactor: 1.8 },
    { id: "core.material.marble", label: T("Marmor", "marble"), tags: ["stone", "art", "sculpture", "ceremonial"], valueFactor: 1.35 },
    { id: "core.material.alabaster", label: T("Alabaster", "alabaster"), tags: ["stone", "art", "sculpture", "fragile"], valueFactor: 1.25 },
    { id: "core.material.soapstone", label: T("Speckstein", "soapstone"), tags: ["stone", "art", "sculpture", "carved"], valueFactor: 0.95 },
    { id: "core.material.sandstone", label: T("feiner Sandstein", "fine sandstone"), tags: ["stone", "art", "sculpture", "ceremonial"], valueFactor: 0.85 },
    { id: "core.material.jade", label: T("Jade", "jade"), tags: ["stone", "precious", "jewelry", "art", "luxury"], valueFactor: 2.2 },
    { id: "core.material.porcelain", label: T("Porzellan", "porcelain"), tags: ["ceramic", "fragile", "tableware", "art", "luxury"], valueFactor: 1.35 },
    { id: "core.material.glass", label: T("Glas", "glass"), tags: ["glass", "fragile", "tableware", "container", "luxury"], valueFactor: 0.95 },
    { id: "core.material.crystal", label: T("Kristallglas", "crystal glass"), tags: ["glass", "fragile", "precious", "tableware", "container", "luxury"], valueFactor: 1.65 },
    { id: "core.material.silk", label: T("Seide", "silk"), tags: ["fabric", "precious", "textile", "luxury"], valueFactor: 1.6 },
    { id: "core.material.linen", label: T("feines Leinen", "fine linen"), tags: ["fabric", "textile", "painting"], valueFactor: 1.0 },
    { id: "core.material.wool", label: T("feine Wolle", "fine wool"), tags: ["fabric", "textile"], valueFactor: 0.9 },
    { id: "core.material.leather", label: T("Leder", "leather"), tags: ["leather", "binding", "container"], valueFactor: 1.0 },
    { id: "core.material.parchment", label: T("Pergament", "parchment"), tags: ["paper", "book", "art"], valueFactor: 1.05 },
    { id: "core.material.vellum", label: T("feines Velin", "fine vellum"), tags: ["paper", "book", "precious"], valueFactor: 1.35 },
    { id: "core.material.fine-paper", label: T("hochwertiges Papier", "fine paper"), tags: ["paper", "book", "art"], valueFactor: 0.95 },
    { id: "core.material.canvas", label: T("Leinwand", "canvas"), tags: ["fabric", "painting"], valueFactor: 0.8 },
    { id: "core.material.mother-of-pearl", label: T("Perlmutt", "mother-of-pearl"), tags: ["organic", "precious", "jewelry", "inlay", "luxury"], valueFactor: 1.65, componentValue: [6, 28] },
    { id: "core.material.amber", label: T("Bernstein", "amber"), tags: ["organic", "precious", "jewelry", "inlay"], valueFactor: 1.55, componentValue: [6, 30] },
    { id: "core.material.amethyst", label: T("Amethyst", "amethyst"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.35, componentValue: [4, 18] },
    { id: "core.material.garnet", label: T("Granat", "garnet"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.25, componentValue: [3, 15] },
    { id: "core.material.turquoise", label: T("Türkis", "turquoise"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.45, componentValue: [5, 22] },
    { id: "core.material.moonstone", label: T("Mondstein", "moonstone"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.55, componentValue: [6, 28] },
    { id: "core.material.topaz", label: T("Topas", "topaz"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.75, componentValue: [8, 38] },
    { id: "core.material.aquamarine", label: T("Aquamarin", "aquamarine"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.8, componentValue: [9, 40] },
    { id: "core.material.opal", label: T("Opal", "opal"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.8, componentValue: [8, 35] },
    { id: "core.material.pearl", label: T("Perle", "pearl"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.55, componentValue: [6, 28] },
    { id: "core.material.lapis", label: T("Lapislazuli", "lapis lazuli"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.3, componentValue: [4, 20] },
    { id: "core.material.onyx", label: T("Onyx", "onyx"), tags: ["gemstone", "precious", "inlay"], valueFactor: 1.45, componentValue: [5, 24] },
    { id: "core.material.ruby", label: T("Rubin", "ruby"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.7, componentValue: [20, 90] },
    { id: "core.material.sapphire", label: T("Saphir", "sapphire"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.6, componentValue: [18, 85] },
    { id: "core.material.emerald", label: T("Smaragd", "emerald"), tags: ["gemstone", "precious", "inlay"], valueFactor: 2.9, componentValue: [22, 100] },
    { id: "core.material.diamond", label: T("Diamant", "diamond"), tags: ["gemstone", "precious", "inlay"], valueFactor: 4.5, componentValue: [45, 180] }
  ]);

  registerAll(treasure.conditions, [
    { id: "core.condition.pristine", label: T("makellos", "pristine"), sentence: T("Der Gegenstand ist makellos erhalten.", "The item is in pristine condition."), valueFactor: 1.2, weight: 5 },
    { id: "core.condition.excellent", label: T("sehr gut erhalten", "excellent"), sentence: T("Der Gegenstand ist außergewöhnlich gut erhalten.", "The item is exceptionally well preserved."), valueFactor: 1.1, weight: 10 },
    { id: "core.condition.good", label: T("gut erhalten", "well preserved"), sentence: T("Der Gegenstand zeigt nur geringe Gebrauchsspuren.", "The item shows only minor signs of use."), valueFactor: 1.0, weight: 30 },
    { id: "core.condition.dusty", label: T("verstaubt", "dusty"), sentence: T("Eine dünne Staubschicht bedeckt die Oberfläche, ohne den Wert wesentlich zu mindern.", "A thin layer of dust covers the surface without materially reducing its value."), valueFactor: 0.98, weight: 16 },
    { id: "core.condition.patinated", label: T("patiniert", "patinated"), sentence: T("Die Oberfläche trägt eine gleichmäßige alte Patina, die dem Stück Charakter verleiht.", "The surface carries an even old patina that lends the piece character."), valueFactor: 0.97, weight: 8, requireMaterialTags: ["metal"] },
    { id: "core.condition.tarnished", label: T("angelaufen", "tarnished"), sentence: T("Die Metalloberfläche ist sichtbar angelaufen.", "The metal surface is visibly tarnished."), valueFactor: 0.9, weight: 10, requireMaterialTags: ["metal"] },
    { id: "core.condition.scratched", label: T("zerkratzt", "scratched"), sentence: T("Mehrere feine Kratzer zeugen von längerem Gebrauch.", "Several fine scratches attest to long use."), valueFactor: 0.86, weight: 12, excludeMaterialTags: ["paper", "fabric", "liquid"] },
    { id: "core.condition.faded", label: T("ausgeblichen", "faded"), sentence: T("Farben und Pigmente sind merklich ausgeblichen, das Motiv bleibt jedoch gut erkennbar.", "Colors and pigments have noticeably faded, though the design remains clear."), valueFactor: 0.84, weight: 10, requireAnyMaterialTags: ["painting", "fabric", "paper"] },
    { id: "core.condition.smoke-stained", label: T("rauchverfärbt", "smoke-stained"), sentence: T("Ein feiner gelblich-grauer Schleier verrät lange Lagerung in rauchiger Umgebung.", "A faint yellow-gray cast suggests long storage in a smoky environment."), valueFactor: 0.88, weight: 7, requireAnyMaterialTags: ["paper", "fabric", "wood", "leather"] },
    { id: "core.condition.water-stained", label: T("wasserfleckig", "water-stained"), sentence: T("Ältere Wasserflecken haben das Material verfärbt, ohne das Stück vollständig zu ruinieren.", "Old water stains discolor the material without having ruined the piece entirely."), valueFactor: 0.74, weight: 6, requireAnyMaterialTags: ["paper", "fabric", "wood", "leather"] },
    { id: "core.condition.chipped", label: T("bestoßen", "chipped"), sentence: T("An einer Kante ist ein kleines Stück abgesplittert.", "A small chip is missing from one edge."), valueFactor: 0.78, weight: 7, requireAnyMaterialTags: ["stone", "ceramic", "glass"] },
    { id: "core.condition.cracked", label: T("rissig", "cracked"), sentence: T("Ein feiner Riss durchzieht einen Teil des Gegenstands, ohne ihn vollständig zu spalten.", "A fine crack runs through part of the item without splitting it apart."), valueFactor: 0.7, weight: 5, requireAnyMaterialTags: ["stone", "ceramic", "glass", "wood"] },
    { id: "core.condition.worm-eaten", label: T("wurmstichig", "worm-eaten"), sentence: T("Kleine Fraßgänge und Löcher zeigen langjährigen Schädlingsbefall.", "Small tunnels and holes show years of insect damage."), valueFactor: 0.68, weight: 4, requireAnyMaterialTags: ["paper", "wood", "leather"] },
    { id: "core.condition.restored", label: T("restauriert", "restored"), sentence: T("Sorgfältige ältere Restaurierungen sind bei genauer Betrachtung erkennbar.", "Careful older restoration work is visible on close inspection."), valueFactor: 1.02, weight: 6, excludeMaterialTags: ["liquid", "gemstone"] },
    { id: "core.condition.worn", label: T("abgenutzt", "worn"), sentence: T("Deutliche, aber überwiegend oberflächliche Abnutzungsspuren sind erkennbar.", "Clear but mostly superficial wear is visible."), valueFactor: 0.82, weight: 11 },
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
    { id: "core.motif.ancestral", label: T("Ahnenmotiv", "ancestral motif"), phrase: T("stilisierte Ahnenfiguren und Erinnerungssymbole", "stylized ancestral figures and memorial symbols"), tags: ["decorative", "ceremonial"] },
    { id: "core.motif.military", label: T("militärisches Motiv", "military motif"), phrase: T("Banner, Waffen und geordnete Kriegerfiguren", "banners, weapons, and ordered warrior figures"), tags: ["decorative"] },
    { id: "core.motif.mythic", label: T("mythisches Motiv", "mythic motif"), phrase: T("Helden, Ungeheuer und eine dramatische Legende", "heroes, monsters, and a dramatic legend"), tags: ["decorative"] },
    { id: "core.motif.architectural", label: T("Architekturmotiv", "architectural motif"), phrase: T("Türme, Bögen und idealisierte Stadtansichten", "towers, arches, and idealized city views"), tags: ["decorative"] },
    { id: "core.motif.animal", label: T("Tiermotiv", "animal motif"), phrase: T("kunstvoll stilisierte Tiere in Bewegung", "artfully stylized animals in motion"), tags: ["decorative"] },
    { id: "core.motif.draconic", label: T("Drachenmotiv", "draconic motif"), phrase: T("verschlungene Drachen und flammenartige Ornamente", "intertwined dragons and flame-like ornament"), tags: ["decorative"] },
    { id: "core.motif.romantic", label: T("romantisches Motiv", "romantic motif"), phrase: T("ein höfisches Paar zwischen Blüten und Bändern", "a courtly pair amid flowers and ribbons"), tags: ["decorative"] },
    { id: "core.motif.scholarly", label: T("gelehrtes Motiv", "scholarly motif"), phrase: T("Schriftrollen, Sterne, Zirkel und gelehrte Embleme", "scrolls, stars, compasses, and scholarly emblems"), tags: ["decorative"] },
    { id: "core.motif.funerary", label: T("Totengedenkmotiv", "funerary motif"), phrase: T("Trauerfiguren, Grabzeichen und Symbole der Erinnerung", "mourning figures, grave markers, and symbols of remembrance"), tags: ["decorative", "ceremonial"] },
    { id: "core.motif.abstract", label: T("abstraktes Motiv", "abstract motif"), phrase: T("ineinandergreifende Formen ohne eindeutige Darstellung", "interlocking forms without a single literal subject"), tags: ["decorative"] }
  ]);

  registerAll(treasure.styles, [
    { id: "core.style.noble", label: T("adlig", "noble"), valueFactor: 1.08, weight: 13, weights: { materialTags: { precious: 1.45, luxury: 1.25 }, motifs: { "core.motif.heraldry": 2.0, "core.motif.hunting": 1.35, "core.motif.romantic": 1.25 }, craftsmanship: { "core.craftsmanship.fine": 1.35, "core.craftsmanship.masterful": 1.25 }, components: { "core.component.gemstones": 1.15, "core.component.filigree": 1.15 } } },
    { id: "core.style.dwarven", label: T("zwergisch", "dwarven"), valueFactor: 1.04, weight: 10, weights: { materialTags: { metal: 1.5, stone: 1.4, wood: 0.75 }, motifs: { "core.motif.ancestral": 2.1, "core.motif.geometric": 1.8, "core.motif.military": 1.25 }, craftsmanship: { "core.craftsmanship.solid": 1.25, "core.craftsmanship.fine": 1.25 }, components: { "core.component.engraving": 1.35 } } },
    { id: "core.style.elven", label: T("elfisch", "elven"), valueFactor: 1.06, weight: 10, weights: { materialTags: { precious: 1.25, wood: 1.2, fabric: 1.2 }, motifs: { "core.motif.nature": 1.8, "core.motif.floral": 1.9, "core.motif.celestial": 1.4, "core.motif.animal": 1.25 }, craftsmanship: { "core.craftsmanship.fine": 1.45, "core.craftsmanship.masterful": 1.3 }, components: { "core.component.filigree": 1.35, "core.component.inlay": 1.2 } } },
    { id: "core.style.ancient", label: T("altertümlich", "ancient"), valueFactor: 1.1, weight: 11, weights: { materialTags: { stone: 1.25, metal: 1.15 }, motifs: { "core.motif.ancestral": 1.65, "core.motif.religious": 1.35, "core.motif.funerary": 1.35 }, craftsmanship: { "core.craftsmanship.solid": 1.15 }, conditions: { "core.condition.patinated": 1.35, "core.condition.restored": 1.2 } } },
    { id: "core.style.rustic", label: T("rustikal", "rustic"), valueFactor: 0.92, weight: 16, weights: { materialTags: { wood: 1.6, fabric: 1.25, precious: 0.45 }, motifs: { "core.motif.nature": 1.55, "core.motif.hunting": 1.35, "core.motif.animal": 1.25 }, craftsmanship: { "core.craftsmanship.plain": 1.5, "core.craftsmanship.solid": 1.25, "core.craftsmanship.exceptional": 0.35 } } },
    { id: "core.style.courtly", label: T("höfisch", "courtly"), valueFactor: 1.12, weight: 12, weights: { materialTags: { precious: 1.55, fabric: 1.3, luxury: 1.35 }, motifs: { "core.motif.heraldry": 1.7, "core.motif.floral": 1.45, "core.motif.romantic": 1.65 }, craftsmanship: { "core.craftsmanship.fine": 1.5, "core.craftsmanship.masterful": 1.35 }, components: { "core.component.gilding": 1.2, "core.component.enamel": 1.25 } } },
    { id: "core.style.temple", label: T("sakral", "sacred"), valueFactor: 1.05, weight: 11, weights: { materialTags: { ceremonial: 1.5, stone: 1.15, precious: 1.1 }, motifs: { "core.motif.religious": 2.4, "core.motif.celestial": 1.35, "core.motif.funerary": 1.25 }, components: { "core.component.gilding": 1.25, "core.component.engraving": 1.2, "core.component.inscription": 1.3 } } },
    { id: "core.style.merchant", label: T("wohlhabend-bürgerlich", "wealthy mercantile"), valueFactor: 1.0, weight: 12, weights: { materialTags: { luxury: 1.2, precious: 1.1 }, craftsmanship: { "core.craftsmanship.solid": 1.3, "core.craftsmanship.fine": 1.2 } } },
    { id: "core.style.nautical", label: T("seefahrerisch", "nautical"), valueFactor: 1.0, weight: 7, weights: { materialTags: { wood: 1.25, brass: 1.2 }, motifs: { "core.motif.maritime": 3.0, "core.motif.celestial": 1.25 }, typeTags: { beverage: 1.25, tableware: 1.15 }, components: { "core.component.engraving": 1.15 } } },
    { id: "core.style.scholarly", label: T("gelehrt", "scholarly"), valueFactor: 1.03, weight: 7, weights: { materialTags: { book: 1.45, paper: 1.25, leather: 1.2 }, motifs: { "core.motif.scholarly": 2.8, "core.motif.celestial": 1.35, "core.motif.architectural": 1.2 }, typeTags: { book: 2.2 }, components: { "core.component.illustrations": 1.25, "core.component.signature": 1.2 } } },
    { id: "core.style.funerary", label: T("sepulkral", "funerary"), valueFactor: 1.05, weight: 6, weights: { materialTags: { stone: 1.4, metal: 1.15 }, motifs: { "core.motif.funerary": 3.0, "core.motif.ancestral": 1.7, "core.motif.religious": 1.4 }, typeTags: { ceremonial: 1.45, sculpture: 1.3 }, components: { "core.component.inscription": 1.5 } } },
    { id: "core.style.opulent", label: T("prunkvoll", "opulent"), valueFactor: 1.18, weight: 5, weights: { materialTags: { precious: 1.8, luxury: 1.5 }, craftsmanship: { "core.craftsmanship.masterful": 1.6, "core.craftsmanship.exceptional": 1.6 }, components: { "core.component.gemstones": 1.4, "core.component.gilding": 1.45, "core.component.filigree": 1.35, "core.component.enamel": 1.3 } } }
  ]);

  registerAll(treasure.components, [
    { id: "core.component.frame", label: T("Rahmen", "frame"), materialTags: ["wood", "metal"], baseValue: [4, 35], craftsmanshipMode: "near-parent", sentence: T("Der Rahmen besteht aus {material}; seine Verarbeitung ist {craftsmanship}.", "The frame is made of {material}; its workmanship is {craftsmanship}.") },
    { id: "core.component.pedestal", label: T("Sockel", "pedestal"), materialTags: ["stone", "wood", "metal"], baseValue: [3, 28], craftsmanshipMode: "near-parent", sentence: T("Das Stück steht auf einem Sockel aus {material}.", "The piece stands on a pedestal of {material}.") },
    { id: "core.component.gemstones", label: T("Edelsteineinlage", "gemstone setting"), materialTags: ["gemstone"], baseValue: [4, 18], quantity: [1, 4], craftsmanshipMode: "near-parent", sentenceSingular: T("Ein Einsatz aus {material} setzt einen kostbaren Akzent.", "A setting of {material} adds a costly accent."), sentence: T("{quantity} Einsätze aus {material} setzen kostbare Akzente.", "{quantity} settings of {material} add costly accents.") },
    { id: "core.component.inlay", label: T("Einlegearbeit", "decorative inlay"), materialTags: ["inlay"], baseValue: [3, 20], quantity: [1, 2], craftsmanshipMode: "near-parent", sentence: T("Feine Einlegearbeiten aus {material} heben einzelne Details hervor.", "Fine inlays of {material} accent selected details.") },
    { id: "core.component.gilding", label: T("Vergoldung", "gilding"), fixedMaterial: "core.material.gold", baseValue: [5, 30], craftsmanshipMode: "inherit", sentence: T("Teile der Oberfläche sind sorgfältig vergoldet.", "Parts of the surface are carefully gilded.") },
    { id: "core.component.engraving", label: T("Gravur", "engraving"), baseValue: [2, 16], craftsmanshipMode: "inherit", sentence: T("Feine Gravuren bedecken Teile der Oberfläche.", "Fine engraving covers parts of the surface.") },
    { id: "core.component.filigree", label: T("Filigranarbeit", "filigree"), baseValue: [6, 38], craftsmanshipMode: "near-parent", sentence: T("Zarte Filigranarbeit bildet ein dichtes Netz feiner Ornamente.", "Delicate filigree forms a dense web of fine ornament.") },
    { id: "core.component.enamel", label: T("Emaillearbeit", "enamel work"), baseValue: [4, 26], craftsmanshipMode: "near-parent", sentence: T("Farbige Emaille setzt leuchtende Akzente in die Verzierung.", "Colored enamel adds vivid accents to the decoration.") },
    { id: "core.component.lacquer", label: T("Lackarbeit", "lacquer work"), baseValue: [4, 24], craftsmanshipMode: "near-parent", sentence: T("Mehrere sorgfältig polierte Lackschichten verleihen der Oberfläche Tiefe und Glanz.", "Several carefully polished layers of lacquer give the surface depth and luster.") },
    { id: "core.component.embroidery", label: T("Stickerei", "embroidery"), baseValue: [5, 35], craftsmanshipMode: "near-parent", sentence: T("Dichte Stickereien in kontrastierenden Fäden ergänzen das Motiv.", "Dense embroidery in contrasting threads complements the design.") },
    { id: "core.component.binding", label: T("Einband", "binding"), materialTags: ["leather", "wood"], baseValue: [2, 20], craftsmanshipMode: "near-parent", sentence: T("Der Einband besteht aus {material}; seine Verarbeitung ist {craftsmanship}.", "The binding is made of {material}; its workmanship is {craftsmanship}.") },
    { id: "core.component.book-clasps", label: T("Buchschließen", "book clasps"), materialTags: ["metal", "precious"], baseValue: [2, 18], craftsmanshipMode: "near-parent", sentence: T("Metallene Schließen aus {material} halten den Band geschlossen.", "Metal clasps of {material} keep the volume shut.") },
    { id: "core.component.illustrations", label: T("Illustrationen", "illustrations"), baseValue: [5, 40], craftsmanshipMode: "near-parent", sentence: T("Mehrere sorgfältige Illustrationen und Zierinitialen erhöhen den Sammlerwert.", "Several careful illustrations and decorated initials increase its collector value.") },
    { id: "core.component.inscription", label: T("Inschrift", "inscription"), baseValue: [1, 12], craftsmanshipMode: "inherit", sentence: T("Eine kurze alte Inschrift nennt einen Namen, einen Anlass oder eine Widmung.", "A brief old inscription records a name, occasion, or dedication.") },
    { id: "core.component.signature", label: T("Signatur", "signature"), baseValue: [4, 28], craftsmanshipMode: "none", sentence: T("Eine erhaltene Signatur oder Werkstattmarke macht das Stück für Sammler interessanter.", "A surviving signature or workshop mark makes the piece more interesting to collectors.") },
    { id: "core.component.maker-mark", label: T("Herstellerzeichen", "maker's mark"), baseValue: [2, 14], craftsmanshipMode: "none", sentence: T("Ein gut erhaltenes Hersteller- oder Erzeugerzeichen erleichtert die Zuordnung der Herkunft.", "A well-preserved maker or producer mark makes the item's origin easier to establish.") },
    { id: "core.component.waxSeal", label: T("Wachssiegel", "wax seal"), baseValue: [1, 5], craftsmanshipMode: "none", sentence: T("Das Gefäß ist noch mit einem alten Wachssiegel verschlossen.", "The vessel remains closed with an old wax seal.") }
  ]);

  const type = (id, category, label, options = {}) => treasure.types.register({
    id,
    categories: ["treasure", category],
    label,
    tags: options.tags ?? [],
    baseValue: options.baseValue ?? [5, 30],
    bulk: options.bulk ?? 0.1,
    materialTags: options.materialTags ?? [],
    supportsMotif: options.supportsMotif ?? true,
    usesCraftsmanship: options.usesCraftsmanship ?? true,
    components: options.components ?? [],
    attributes: options.attributes ?? {},
    conditionWeights: options.conditionWeights ?? {},
    craftsmanshipWeights: options.craftsmanshipWeights ?? {},
    motifWeights: options.motifWeights ?? {},
    systemCategory: options.systemCategory ?? "art-object",
    img: options.img ?? "systems/pf2e/icons/default-icons/treasure.svg",
    nameTemplates: options.nameTemplates ?? {
      de: ["{type} aus {material}", "{type} aus {material} – {motif}"],
      en: ["{type} of {material}", "{type} of {material} with {motif}"]
    },
    descriptionTemplates: options.descriptionTemplates ?? {
      de: [
        "{craftsmanshipSentence} Das Stück besteht überwiegend aus {material}. {motifSentence} {componentSentence} {conditionSentence}",
        "Das Objekt besteht aus {material} und ist {craftsmanship}. {motifSentence} {componentSentence} {conditionSentence}"
      ],
      en: [
        "{craftsmanshipSentence} The piece is made primarily of {material}. {motifSentence} {componentSentence} {conditionSentence}",
        "The object is made of {material} and is {craftsmanship}. {motifSentence} {componentSentence} {conditionSentence}"
      ]
    }
  });

  type("core.type.gem.cut", "treasure.gemstone", T("geschliffener Edelstein", "cut gemstone"), {
    tags: ["gemstone"], baseValue: [8, 80], materialTags: ["gemstone"], supportsMotif: false, systemCategory: "gem",
    nameTemplates: { de: ["Geschliffener {material}", "Polierter {material}"], en: ["Cut {material}", "Polished {material}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Der Schliff bringt Farbe und Klarheit des Steins deutlich zur Geltung. {conditionSentence}"], en: ["{craftsmanshipSentence} The cut clearly brings out the stone's color and clarity. {conditionSentence}"] },
    conditionWeights: { "core.condition.pristine": 1.6, "core.condition.excellent": 1.4, "core.condition.damaged": 0.25 }
  });
  type("core.type.gem.uncut", "treasure.gemstone", T("ungeschliffener Edelstein", "uncut gemstone"), {
    tags: ["gemstone"], baseValue: [4, 45], materialTags: ["gemstone"], supportsMotif: false, usesCraftsmanship: false, systemCategory: "gem",
    nameTemplates: { de: ["Ungeschliffener {material}", "Roher {material}"], en: ["Uncut {material}", "Raw {material}"] },
    descriptionTemplates: { de: ["Ein natürlicher {material}, dessen Qualität trotz fehlenden Schliffs gut erkennbar ist. {conditionSentence}"], en: ["A natural {material} whose quality remains clear despite the lack of a finished cut. {conditionSentence}"] }
  });

  type("core.type.art.painting", "treasure.art.painting", T("Gemälde", "painting"), {
    tags: ["painting", "decorative"], baseValue: [12, 90], bulk: 1, materialTags: ["painting"], components: [{ id: "core.component.frame", chance: 0.88 }, { id: "core.component.signature", chance: 0.18 }],
    nameTemplates: { de: ["Gemälde: {motif}", "{style}es Gemälde – {motif}", "Gerahmtes Gemälde: {motif}"], en: ["Painting with {motif}", "{style} painting with {motif}", "Framed painting with {motif}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Das Bild zeigt {motifPhrase}. {componentSentence} {conditionSentence}", "Das Gemälde zeigt {motifPhrase}. {craftsmanshipSentence} {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} The painting depicts {motifPhrase}. {componentSentence} {conditionSentence}", "The painting depicts {motifPhrase}. {craftsmanshipSentence} {componentSentence} {conditionSentence}"] },
    conditionWeights: { "core.condition.dusty": 1.4, "core.condition.faded": 1.35, "core.condition.restored": 1.15 }
  });
  type("core.type.art.portrait", "treasure.art.painting", T("Porträt", "portrait"), {
    tags: ["painting", "decorative"], baseValue: [15, 110], bulk: 1, materialTags: ["painting"], components: [{ id: "core.component.frame", chance: 0.92 }, { id: "core.component.signature", chance: 0.2 }],
    nameTemplates: { de: ["Gerahmtes Porträt einer unbekannten Persönlichkeit", "{style}es Porträt", "Porträt: {motif}"], en: ["Framed portrait of an unknown figure", "{style} portrait", "Portrait with {motif}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Das Porträt zeigt eine sorgfältig gekleidete, heute unbekannte Person. {motifSentence} {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} The portrait depicts a carefully dressed figure whose identity is now unknown. {motifSentence} {componentSentence} {conditionSentence}"] },
    motifWeights: { "core.motif.heraldry": 1.6, "core.motif.romantic": 1.3 }, conditionWeights: { "core.condition.dusty": 1.35, "core.condition.faded": 1.25 }
  });
  type("core.type.art.icon", "treasure.art.painting", T("Kultbild", "devotional icon"), {
    tags: ["painting", "decorative", "ceremonial"], baseValue: [10, 85], bulk: 0.5, materialTags: ["painting", "wood"], components: [{ id: "core.component.frame", chance: 0.65 }, { id: "core.component.gilding", chance: 0.3 }, { id: "core.component.inscription", chance: 0.35 }],
    motifWeights: { "core.motif.religious": 4, "core.motif.celestial": 1.7, "core.motif.funerary": 1.3 },
    nameTemplates: { de: ["Kultbild: {motif}", "Sakrales Bild aus {material}"], en: ["Devotional icon with {motif}", "Sacred icon of {material}"] }
  });
  type("core.type.art.miniature", "treasure.art.painting", T("Miniaturmalerei", "miniature painting"), {
    tags: ["painting", "decorative", "luxury"], baseValue: [8, 65], bulk: 0.1, materialTags: ["paper", "parchment"], components: [{ id: "core.component.frame", chance: 0.45 }, { id: "core.component.signature", chance: 0.14 }],
    nameTemplates: { de: ["Miniaturmalerei: {motif}", "Kleine Malerei auf {material}"], en: ["Miniature painting with {motif}", "Small painting on {material}"] }
  });
  type("core.type.art.painted-panel", "treasure.art.painting", T("bemalte Tafel", "painted panel"), {
    tags: ["painting", "decorative"], baseValue: [14, 100], bulk: 1, materialTags: ["wood"], components: [{ id: "core.component.gilding", chance: 0.2 }, { id: "core.component.inscription", chance: 0.18 }],
    conditionWeights: { "core.condition.cracked": 1.2, "core.condition.smoke-stained": 1.15 }
  });

  for (const [id, label, base, bulk] of [
    ["statue", T("Statue", "statue"), [25, 160], 4],
    ["statuette", T("Statuette", "statuette"), [8, 70], 0.5],
    ["bust", T("Büste", "bust"), [12, 95], 1],
    ["relief", T("Relief", "relief"), [10, 85], 1],
    ["figurine", T("Tierfigur", "animal figurine"), [6, 55], 0.1]
  ]) type(`core.type.art.${id}`, "treasure.art.sculpture", label, {
    tags: ["sculpture", "decorative"], baseValue: base, bulk, materialTags: ["sculpture", "metal", "wood"], components: [{ id: "core.component.pedestal", chance: id === "relief" ? 0.15 : 0.58 }, { id: "core.component.inscription", chance: id === "statue" || id === "bust" ? 0.28 : 0.12 }],
    motifWeights: id === "figurine" ? { "core.motif.animal": 3 } : {},
    conditionWeights: { "core.condition.chipped": 1.15, "core.condition.patinated": 1.15 }
  });
  type("core.type.art.carved-panel", "treasure.art.sculpture", T("geschnitztes Zierpaneel", "carved decorative panel"), {
    tags: ["decorative", "carved"], baseValue: [12, 90], bulk: 1, materialTags: ["wood"], components: [{ id: "core.component.inlay", chance: 0.22 }, { id: "core.component.lacquer", chance: 0.22 }], conditionWeights: { "core.condition.worm-eaten": 1.15, "core.condition.cracked": 1.15 }
  });

  type("core.type.art.tapestry", "treasure.art.textile", T("Wandteppich", "tapestry"), {
    tags: ["textile", "decorative"], baseValue: [18, 140], bulk: 1, materialTags: ["textile"], components: [{ id: "core.component.embroidery", chance: 0.35 }],
    nameTemplates: { de: ["Wandteppich: {motif}", "Bestickter Wandteppich – {motif}"], en: ["Tapestry with {motif}", "Wall tapestry with {motif}"] },
    conditionWeights: { "core.condition.faded": 1.6, "core.condition.dusty": 1.35, "core.condition.water-stained": 1.1 }
  });
  type("core.type.art.carpet", "treasure.art.textile", T("kostbarer Teppich", "valuable carpet"), {
    tags: ["textile", "decorative", "luxury"], baseValue: [20, 150], bulk: 2, materialTags: ["textile"], components: [{ id: "core.component.embroidery", chance: 0.3 }],
    nameTemplates: { de: ["Teppich: {motif}", "{style}er Zierteppich"], en: ["Carpet with {motif}", "{style} decorative carpet"] },
    conditionWeights: { "core.condition.worn": 1.5, "core.condition.faded": 1.35, "core.condition.water-stained": 1.1 }
  });
  type("core.type.art.embroidered-hanging", "treasure.art.textile", T("bestickter Wandbehang", "embroidered wall hanging"), {
    tags: ["textile", "decorative"], baseValue: [14, 110], bulk: 1, materialTags: ["textile"], components: [{ id: "core.component.embroidery", chance: 0.9 }], conditionWeights: { "core.condition.faded": 1.4, "core.condition.smoke-stained": 1.15 }
  });

  const jewelry = [
    ["necklace", T("Halskette", "necklace"), [5, 45], 0.52],
    ["pendant", T("Anhänger", "pendant"), [4, 38], 0.55],
    ["ring", T("Ring", "ring"), [3, 35], 0.45],
    ["signet-ring", T("Siegelring", "signet ring"), [5, 48], 0.28],
    ["bracelet", T("Armband", "bracelet"), [4, 38], 0.48],
    ["armlet", T("Armreif", "armlet"), [6, 52], 0.5],
    ["anklet", T("Fußkettchen", "anklet"), [4, 32], 0.45],
    ["tiara", T("Tiara", "tiara"), [18, 120], 0.82],
    ["diadem", T("Diadem", "diadem"), [20, 135], 0.86],
    ["circlet", T("Stirnreif", "circlet"), [10, 75], 0.62],
    ["brooch", T("Brosche", "brooch"), [5, 42], 0.52],
    ["earrings", T("Paar Ohrringe", "pair of earrings"), [6, 50], 0.56],
    ["hairpin", T("Zierhaarnadel", "ornamental hairpin"), [4, 34], 0.35]
  ];
  for (const [id, label, base, gemChance] of jewelry) type(`core.type.jewelry.${id}`, "treasure.jewelry", label, {
    tags: ["jewelry", "decorative"], baseValue: base, materialTags: ["jewelry"], components: [
      { id: "core.component.gemstones", chance: gemChance },
      { id: "core.component.engraving", chance: 0.3 },
      { id: "core.component.filigree", chance: ["tiara", "diadem", "circlet", "brooch"].includes(id) ? 0.34 : 0.2 },
      { id: "core.component.enamel", chance: ["brooch", "signet-ring", "pendant"].includes(id) ? 0.24 : 0.12 }
    ],
    motifWeights: id === "signet-ring" ? { "core.motif.heraldry": 3 } : {},
    conditionWeights: { "core.condition.excellent": 1.15, "core.condition.tarnished": 1.1, "core.condition.damaged": 0.65 }
  });

  const tableware = [
    ["goblet", T("Kelch", "goblet"), [5, 48], 0.1],
    ["cup", T("Trinkbecher", "drinking cup"), [3, 28], 0.1],
    ["drinking-horn", T("verziertes Trinkhorn", "decorated drinking horn"), [4, 34], 0.1],
    ["plate", T("Teller", "plate"), [3, 25], 0.1],
    ["bowl", T("Schale", "bowl"), [4, 32], 0.1],
    ["platter", T("Servierplatte", "serving platter"), [7, 55], 0.5],
    ["tray", T("Serviertablett", "serving tray"), [6, 48], 0.5],
    ["pitcher", T("Krug", "pitcher"), [5, 42], 0.5],
    ["ewer", T("Zierkanne", "ornamental ewer"), [8, 62], 0.5],
    ["decanter", T("Karaffe", "decanter"), [8, 65], 0.1],
    ["salt-cellar", T("Salzgefäß", "salt cellar"), [4, 30], 0.1],
    ["cutlery-set", T("kostbares Besteckset", "valuable cutlery set"), [12, 90], 0.5],
    ["tea-service", T("kunstvolles Teeservice", "ornate tea service"), [18, 130], 1]
  ];
  for (const [id, label, base, bulk] of tableware) type(`core.type.tableware.${id}`, "treasure.tableware", label, {
    tags: ["tableware", "decorative"], baseValue: base, bulk, materialTags: ["tableware"], components: [
      { id: "core.component.gilding", chance: ["tea-service", "ewer", "goblet"].includes(id) ? 0.28 : 0.16 },
      { id: "core.component.engraving", chance: 0.32 },
      { id: "core.component.enamel", chance: ["tea-service", "plate", "bowl"].includes(id) ? 0.24 : 0.12 }
    ], conditionWeights: { "core.condition.chipped": 1.1, "core.condition.tarnished": 1.1 }
  });

  const ceremonial = [
    ["ritual-bowl", T("Ritualschale", "ritual bowl"), [6, 50]],
    ["incense-burner", T("Weihrauchgefäß", "incense burner"), [7, 58]],
    ["idol", T("Kultidol", "cult idol"), [10, 90]],
    ["ceremonial-mask", T("Zeremonienmaske", "ceremonial mask"), [8, 70]],
    ["offering-plate", T("Opferteller", "offering plate"), [7, 55]],
    ["reliquary", T("Reliquienschrein", "reliquary"), [14, 120]],
    ["prayer-beads", T("kostbare Gebetskette", "valuable prayer beads"), [5, 45]],
    ["ceremonial-chalice", T("Zeremonienkelch", "ceremonial chalice"), [10, 85]],
    ["votive-lamp", T("Votivlampe", "votive lamp"), [6, 48]],
    ["shrine-plaque", T("Schreinplakette", "shrine plaque"), [8, 65]]
  ];
  for (const [id, label, base] of ceremonial) type(`core.type.ceremonial.${id}`, "treasure.ceremonial", label, {
    tags: ["ceremonial", "decorative"], baseValue: base, materialTags: ["ceremonial", "art", "wood"], components: [
      { id: "core.component.gemstones", chance: id === "reliquary" ? 0.42 : 0.2 },
      { id: "core.component.gilding", chance: ["reliquary", "ceremonial-chalice", "shrine-plaque"].includes(id) ? 0.28 : 0.16 },
      { id: "core.component.inscription", chance: 0.38 }
    ], motifWeights: { "core.motif.religious": 3.2, "core.motif.celestial": 1.45, "core.motif.funerary": id === "reliquary" ? 2.0 : 1.15 }
  });

  const luxury = [
    ["jewelry-box", T("Schmuckkästchen", "jewelry box"), [6, 55], 0.1],
    ["mirror", T("Handspiegel", "hand mirror"), [5, 42], 0.1],
    ["perfume-bottle", T("Parfümflakon", "perfume bottle"), [4, 36], 0.1],
    ["comb", T("Zierkamm", "decorative comb"), [3, 28], 0.1],
    ["game-set", T("kunstvolles Spielset", "ornate game set"), [12, 85], 0.5],
    ["seal-stamp", T("Siegelstempel", "seal stamp"), [4, 30], 0.1],
    ["decorative-box", T("verzierte Schatulle", "decorative box"), [7, 60], 0.1],
    ["folding-fan", T("kostbarer Fächer", "valuable folding fan"), [5, 42], 0.1],
    ["writing-set", T("repräsentatives Schreibset", "formal writing set"), [10, 72], 0.5],
    ["music-box", T("mechanische Spieluhr", "mechanical music box"), [14, 110], 0.5],
    ["snuff-box", T("verzierte Schnupftabakdose", "ornate snuffbox"), [5, 40], 0.1],
    ["vanity-case", T("kostbares Toilettenkästchen", "valuable vanity case"), [12, 95], 0.5],
    ["decorative-clock", T("dekorative Tischuhr", "decorative table clock"), [18, 140], 1]
  ];
  for (const [id, label, base, bulk] of luxury) type(`core.type.luxury.${id}`, "treasure.luxury", label, {
    tags: ["luxury", "decorative"], baseValue: base, bulk, materialTags: ["luxury", "wood", "metal", "glass"], components: [
      { id: "core.component.gemstones", chance: 0.14 },
      { id: "core.component.engraving", chance: 0.25 },
      { id: "core.component.inlay", chance: 0.22 },
      { id: "core.component.lacquer", chance: ["jewelry-box", "decorative-box", "vanity-case", "folding-fan"].includes(id) ? 0.28 : 0.1 },
      { id: "core.component.signature", chance: ["music-box", "decorative-clock", "writing-set"].includes(id) ? 0.18 : 0.08 }
    ],
    motifWeights: id === "folding-fan" ? { "core.motif.floral": 1.8, "core.motif.nature": 1.45, "core.motif.romantic": 1.35 } : {}
  });

  const bookSubjects = {
    chronicle: [T("Chronik eines alten Adelshauses", "chronicle of an old noble house"), T("Stadtchronik", "city chronicle"), T("Chronik einer Grenzfestung", "chronicle of a frontier fortress")],
    poetry: [T("Sammlung höfischer Gedichte", "collection of courtly poems"), T("illustrierte Balladensammlung", "illustrated collection of ballads"), T("Zyklus elegischer Gedichte", "cycle of elegiac poems")],
    religious: [T("theologische Abhandlung", "theological treatise"), T("Sammlung alter Hymnen", "collection of old hymns"), T("kommentierte Predigtsammlung", "annotated collection of sermons")],
    travel: [T("Reisebericht aus fernen Ländern", "travelogue from distant lands"), T("Bericht einer Seeexpedition", "account of a sea expedition"), T("Beschreibung abgelegener Gebirgspässe", "description of remote mountain passes")],
    atlas: [T("handgezeichneter Atlas", "hand-drawn atlas"), T("Küsten- und Hafenatlas", "coastal and harbor atlas"), T("Atlas alter Handelswege", "atlas of old trade routes")],
    bestiary: [T("illustriertes Bestiarium", "illustrated bestiary"), T("naturkundliche Tierbeschreibung", "natural history of animals"), T("Sammlung ungewöhnlicher Tierbeobachtungen", "collection of unusual animal observations")],
    cookbook: [T("Sammlung kostbarer Hofrezepte", "collection of costly court recipes"), T("regionaler Rezeptband", "regional cookbook"), T("Abhandlung über Gewürze und Festmahle", "treatise on spices and feasts")],
    manuscript: [T("unveröffentlichtes Manuskript", "unpublished manuscript"), T("handschriftliche Abhandlung", "handwritten treatise"), T("unvollendeter gelehrter Entwurf", "unfinished scholarly draft")],
    history: [T("Geschichte eines untergegangenen Fürstentums", "history of a vanished principality"), T("kommentierte Kriegschronik", "annotated war history"), T("Sammlung historischer Reden", "collection of historical speeches")],
    philosophy: [T("philosophischer Dialog", "philosophical dialogue"), T("Abhandlung über Ethik und Herrschaft", "treatise on ethics and rulership"), T("Sammlung gelehrter Disputationen", "collection of scholarly disputations")],
    genealogy: [T("Genealogie mehrerer Adelslinien", "genealogy of several noble lines"), T("illustriertes Familienregister", "illustrated family register"), T("Stammbaum einer alten Dynastie", "family tree of an old dynasty")],
    astronomy: [T("Abhandlung über Sternbilder", "treatise on constellations"), T("Tafeln alter Himmelsbeobachtungen", "tables of old celestial observations"), T("illustrierter Sternatlas", "illustrated star atlas")]
  };
  const bookTypeLabels = {
    chronicle: T("Chronik", "chronicle"),
    poetry: T("Gedichtsammlung", "poetry collection"),
    religious: T("Religiöses Werk", "religious work"),
    travel: T("Reisebericht", "travelogue"),
    atlas: T("Atlas", "atlas"),
    bestiary: T("Bestiarium", "bestiary"),
    cookbook: T("Kochbuch", "cookbook"),
    manuscript: T("Manuskript", "manuscript"),
    history: T("Geschichtswerk", "historical work"),
    philosophy: T("Philosophische Abhandlung", "philosophical treatise"),
    genealogy: T("Genealogischer Band", "genealogical volume"),
    astronomy: T("Astronomisches Werk", "astronomical work")
  };
  for (const [id, subjects] of Object.entries(bookSubjects)) type(`core.type.book.${id}`, "treasure.book", bookTypeLabels[id] ?? T("Buch", "book"), {
    tags: ["book"], baseValue: id === "manuscript" ? [8, 100] : [4, 70], bulk: 0.1, materialTags: ["book", "paper"], supportsMotif: false,
    components: [
      { id: "core.component.binding", chance: 0.94 },
      { id: "core.component.book-clasps", chance: ["chronicle", "religious", "genealogy", "atlas"].includes(id) ? 0.35 : 0.18 },
      { id: "core.component.illustrations", chance: ["atlas", "bestiary", "chronicle", "genealogy", "astronomy"].includes(id) ? 0.66 : 0.24 },
      { id: "core.component.signature", chance: id === "manuscript" ? 0.42 : 0.14 }
    ],
    attributes: {
      subject: { options: subjects.map((label, index) => ({ id: `${id}-subject-${index}`, label, valueFactor: index ? 1.05 : 1, weight: 1 })) },
      edition: { options: options([
        [`${id}-edition-copy`, "spätere Abschrift", "later copy", 0.9, 0, 3],
        [`${id}-edition-old`, "alte Abschrift", "old copy", 1.05, 0, 4],
        [`${id}-edition-fine`, "kostbare Ausgabe", "fine edition", 1.28, 0, 2],
        [`${id}-edition-original`, "frühe Originalfassung", "early original version", 1.55, 0, 1]
      ]) },
      completeness: { options: options([
        [`${id}-complete`, "vollständig", "complete", 1, 0, 7],
        [`${id}-minor-gaps`, "mit wenigen fehlenden Seiten", "with a few missing pages", 0.82, 0, 2],
        [`${id}-fragmentary`, "nur teilweise vollständig", "partially complete", 0.62, 0, 1]
      ]) }
    },
    nameTemplates: { de: ["{subject}", "{edition}: {subject}"], en: ["{subject}", "{edition}: {subject}"] },
    descriptionTemplates: { de: ["{craftsmanshipSentence} Es handelt sich um eine {edition}; der Band ist {completeness}. {componentSentence} {conditionSentence}", "Inhalt: {subject}. Ausgabeform: {edition}; der Band ist {completeness}. {componentSentence} {conditionSentence}"], en: ["{craftsmanshipSentence} This is a {edition}; the volume is {completeness}. {componentSentence} {conditionSentence}", "The volume contains a {subject}. Edition: {edition}; the volume is {completeness}. {componentSentence} {conditionSentence}"] },
    conditionWeights: { "core.condition.dusty": 1.35, "core.condition.worn": 1.35, "core.condition.faded": 1.25, "core.condition.water-stained": 1.15, "core.condition.worm-eaten": 1.1, "core.condition.tarnished": 0 },
    craftsmanshipWeights: { "core.craftsmanship.rude": 0.45, "core.craftsmanship.plain": 0.85, "core.craftsmanship.fine": 1.15 }
  });

  const beverageAttributes = {
    wine: {
      kind: [T("kräftiger Rotwein", "full-bodied red wine"), T("heller Weißwein", "bright white wine"), T("gewürzter Wein", "spiced wine"), T("süßer Dessertwein", "sweet dessert wine")],
      vessel: [T("Flasche", "bottle"), T("kleines Fässchen", "small cask"), T("Amphore", "amphora"), T("verzierte Karaffe", "decorative decanter")],
      age: [T("junger Jahrgang", "young vintage"), T("gut gereifter Jahrgang", "well-aged vintage"), T("alter Jahrgang", "old vintage"), T("außergewöhnlich alter Jahrgang", "exceptionally old vintage")]
    },
    beer: {
      kind: [T("dunkles Starkbier", "dark strong ale"), T("würziges Klosterbier", "spiced abbey ale"), T("helles Lagerbier", "pale lager"), T("kräftiges Rauchbier", "robust smoked ale")],
      vessel: [T("kleines Fässchen", "small cask"), T("Steingutkrug", "stoneware jug"), T("versiegelte Flasche", "sealed bottle")],
      age: [T("frische Abfüllung", "fresh batch"), T("gelagerte Abfüllung", "cellared batch")]
    },
    mead: {
      kind: [T("würziger Honigmet", "spiced honey mead"), T("kräftiger Waldhonigmet", "robust forest-honey mead"), T("heller Blütenmet", "light blossom mead"), T("dunkler Gewürzmet", "dark spiced mead")],
      vessel: [T("Flasche", "bottle"), T("kleines Fässchen", "small cask"), T("Steingutkrug", "stoneware jug")],
      age: [T("frische Abfüllung", "fresh batch"), T("gereifte Abfüllung", "aged batch"), T("lange gereifte Abfüllung", "long-aged batch")]
    },
    spirit: {
      kind: [T("Obstbrand", "fruit brandy"), T("Kräuterlikör", "herbal liqueur"), T("kräftiger Branntwein", "strong spirit"), T("gewürzter Hochprozentiger", "spiced high-proof spirit")],
      vessel: [T("versiegelte Flasche", "sealed bottle"), T("kleines Fässchen", "small cask"), T("verzierte Karaffe", "decorative decanter")],
      age: [T("mehrjährig gelagert", "aged for several years"), T("lange gereift", "long-aged"), T("sehr lange gereift", "very long-aged")]
    },
    cider: {
      kind: [T("trockener Apfelwein", "dry apple cider"), T("würziger Birnenwein", "spiced pear cider"), T("süßer Obstwein", "sweet fruit cider")],
      vessel: [T("Flasche", "bottle"), T("kleines Fässchen", "small cask"), T("Steingutkrug", "stoneware jug")],
      age: [T("frische Abfüllung", "fresh batch"), T("kurz gelagert", "briefly cellared"), T("gut gelagert", "well cellared")]
    }
  };
  const beverageTypeLabels = {
    wine: T("Wein", "wine"),
    beer: T("Bier", "beer"),
    mead: T("Met", "mead"),
    spirit: T("Spirituose", "spirit"),
    cider: T("Obstwein", "fruit cider")
  };
  for (const [id, attrs] of Object.entries(beverageAttributes)) type(`core.type.beverage.${id}`, id === "cider" ? "treasure.beverage" : `treasure.beverage.${id}`, beverageTypeLabels[id] ?? T("alkoholisches Getränk", "alcoholic beverage"), {
    tags: ["beverage", "liquid"], baseValue: id === "spirit" ? [4, 60] : id === "wine" ? [3, 50] : [2, 42], bulk: 0.5, materialTags: [], supportsMotif: false, usesCraftsmanship: false,
    components: [{ id: "core.component.waxSeal", chance: id === "wine" || id === "spirit" ? 0.6 : 0.22 }, { id: "core.component.maker-mark", chance: id === "wine" || id === "spirit" ? 0.16 : 0.08 }],
    attributes: {
      kind: { options: attrs.kind.map((label, index) => ({ id: `${id}-kind-${index}`, label, valueFactor: 1 + index * 0.07, weight: 1 })) },
      vessel: { options: attrs.vessel.map((label, index) => ({ id: `${id}-vessel-${index}`, label, valueFactor: 1 + index * 0.12, weight: index === 0 ? 3 : 2 })) },
      age: { options: attrs.age.map((label, index) => ({ id: `${id}-age-${index}`, label, valueFactor: 1 + index * 0.22, weight: Math.max(1, 4 - index) })) },
      quality: { options: options([
        [`${id}-quality-0`, "ordentlich", "decent", 0.9, 0, 3],
        [`${id}-quality-1`, "hochwertig", "high quality", 1.2, 0, 4],
        [`${id}-quality-2`, "erlesen", "exquisite", 1.65, 0, 2],
        [`${id}-quality-3`, "herausragend", "outstanding", 2.05, 0, 1]
      ]) },
      origin: { options: options([
        [`${id}-origin-local`, "aus einer guten regionalen Produktion", "from a good regional producer", 1, 0, 5],
        [`${id}-origin-known`, "aus einem angesehenen Anbaugebiet", "from a respected producing region", 1.18, 0, 3],
        [`${id}-origin-rare`, "aus einer selten gehandelten Herkunft", "from a rarely traded origin", 1.42, 0, 1]
      ]) }
    },
    nameTemplates: { de: ["{vessel}: {kind}", "{kind} – {age}"], en: ["{vessel}: {kind}", "{kind} in a {vessel}"] },
    descriptionTemplates: { de: ["Inhalt: {kind}. Qualität: {quality}; {origin}. Altersangabe: {age}. {componentSentence} {conditionSentence}", "Das Gefäß enthält {kind}, {quality} und {origin}. Der Inhalt ist {age}. {componentSentence} {conditionSentence}"], en: ["Contents: {kind}. Quality: {quality}; {origin}. Age: {age}. {componentSentence} {conditionSentence}", "The vessel contains {kind}, {quality} and {origin}. The contents are {age}. {componentSentence} {conditionSentence}"] },
    conditionWeights: { "core.condition.good": 1.5, "core.condition.dusty": 1.25, "core.condition.pristine": 1.1, "core.condition.damaged": 0.35 }
  });

  return treasure;
}
