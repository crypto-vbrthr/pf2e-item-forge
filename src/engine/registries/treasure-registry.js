import { ContentRegistry } from "./content-registry.js";

export class TreasureRegistry {
  constructor() {
    this.types = new ContentRegistry("treasure type");
    this.materials = new ContentRegistry("treasure material");
    this.components = new ContentRegistry("treasure component");
    this.motifs = new ContentRegistry("treasure motif");
    this.conditions = new ContentRegistry("treasure condition");
    this.craftsmanship = new ContentRegistry("treasure craftsmanship");
    this.styles = new ContentRegistry("treasure style");
  }
}
