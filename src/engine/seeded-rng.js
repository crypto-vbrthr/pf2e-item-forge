function xmur3(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng {
  constructor(seed) {
    this.seed = String(seed ?? "item-forge");
    this._random = mulberry32(xmur3(this.seed)());
  }

  random() {
    return this._random();
  }

  integer(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError("SeededRng.integer requires integer min <= max");
    }
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values[this.integer(0, values.length - 1)];
  }

  shuffle(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.integer(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export function createSeed() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `item-forge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
