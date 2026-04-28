import { describe, expect, it } from 'vitest'
import { calculatePower } from './power'
import type { CombatantStats } from './types'

const baseStats: CombatantStats = {
  attack: 30,
  health: 300,
  armor: 20,
  attackSpeed: 100,
  critChance: 10,
  critDamage: 150,
  lifesteal: 0,
  areaAttack: 0,
  thorns: 0,
}

describe('calculatePower', () => {
  it.each([
    ['attack', { attack: 40 }],
    ['health', { health: 400 }],
    ['armor', { armor: 40 }],
    ['attackSpeed', { attackSpeed: 140 }],
    ['critChance', { critChance: 25 }],
    ['critDamage', { critDamage: 200 }],
    ['lifesteal', { lifesteal: 15 }],
    ['areaAttack', { areaAttack: 0.5 }],
    ['thorns', { thorns: 0.15 }],
  ] as const)('does not reduce power when %s grows', (_name, overrides) => {
    const basePower = calculatePower(baseStats, 4).power
    const improvedPower = calculatePower({ ...baseStats, ...overrides }, 4).power

    expect(improvedPower).toBeGreaterThanOrEqual(basePower)
  })

  it('values area attack only when there are extra targets', () => {
    const singleTargetPower = calculatePower({ ...baseStats, areaAttack: 0.8 }, 1).power
    const multiTargetPower = calculatePower({ ...baseStats, areaAttack: 0.8 }, 4).power

    expect(multiTargetPower).toBeGreaterThan(singleTargetPower)
  })
})
