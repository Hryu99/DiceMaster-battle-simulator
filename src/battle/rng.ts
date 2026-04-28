export interface RandomSource {
  next(): number
}

export class SeededRandom implements RandomSource {
  private state: number

  constructor(seed = Date.now()) {
    this.state = seed >>> 0 || 1
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0
    return this.state / 0x100000000
  }
}

export function pickRandom<T>(items: T[], rng: RandomSource): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty list')
  }

  return items[Math.floor(rng.next() * items.length)]
}
