import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG } from './config'
import { calculateArmorReducedDamage } from './damage'
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
    ['areaAttack', { areaAttack: 50 }],
    ['thorns', { thorns: 15 }],
  ] as const)('does not reduce power when %s grows', (_name, overrides) => {
    const basePower = calculatePower(baseStats).power
    const improvedPower = calculatePower({ ...baseStats, ...overrides }).power

    expect(improvedPower).toBeGreaterThanOrEqual(basePower)
  })

  it('values area attack with an average expected number of extra targets', () => {
    const basePower = calculatePower(baseStats).power
    const areaPower = calculatePower({ ...baseStats, areaAttack: 80 }).power
    const baseBreakdown = calculatePower(baseStats)
    const areaBreakdown = calculatePower({ ...baseStats, areaAttack: 80 })
    const expectedAreaDps =
      calculateArmorReducedDamage(30 * 0.8, BATTLE_CONFIG.power.averageEnemyArmor) *
      BATTLE_CONFIG.power.averageExtraTargets *
      BATTLE_CONFIG.power.areaEfficiency *
      1

    expect(areaPower).toBeGreaterThan(basePower)
    expect(areaBreakdown.dps * areaBreakdown.areaMultiplier - baseBreakdown.dps).toBeCloseTo(expectedAreaDps)
  })

  it('applies armor before crit in expected main hit damage', () => {
    const breakdown = calculatePower({
      ...baseStats,
      attack: 100,
      critChance: 100,
      critDamage: 200,
    })

    expect(breakdown.expectedHitDamage).toBeCloseTo(
      calculateArmorReducedDamage(100, BATTLE_CONFIG.power.averageEnemyArmor) *
        (1 + BATTLE_CONFIG.power.critEfficiency),
    )
  })

  it('does not let crit damage increase area attack contribution', () => {
    const breakdown = calculatePower({
      ...baseStats,
      attack: 100,
      critChance: 100,
      critDamage: 300,
      areaAttack: 100,
    })
    const expectedAreaDps =
      calculateArmorReducedDamage(100, BATTLE_CONFIG.power.averageEnemyArmor) *
      BATTLE_CONFIG.power.averageExtraTargets *
      BATTLE_CONFIG.power.areaEfficiency *
      1

    expect(breakdown.dps * breakdown.areaMultiplier - breakdown.dps).toBeCloseTo(expectedAreaDps)
  })

  it('does not include area attack damage in sustain', () => {
    const withoutArea = calculatePower({ ...baseStats, lifesteal: 50, areaAttack: 0 })
    const withArea = calculatePower({ ...baseStats, lifesteal: 50, areaAttack: 100 })

    expect(withArea.sustain).toBeCloseTo(withoutArea.sustain)
  })

  it('discounts attack speed above the baseline in power dps', () => {
    const breakdown = calculatePower({ ...baseStats, attackSpeed: 200, critChance: 0 })
    const expectedHitDamage = calculateArmorReducedDamage(baseStats.attack, BATTLE_CONFIG.power.averageEnemyArmor)
    const expectedAttackSpeed = 1 + (2 - 1) * BATTLE_CONFIG.power.attackSpeedEfficiency

    expect(breakdown.dps).toBeCloseTo(expectedHitDamage * expectedAttackSpeed)
  })

  it('combines defense and pressure with configured power weights', () => {
    const breakdown = calculatePower(baseStats)
    const pressure = breakdown.dps * breakdown.hitImpactMultiplier + breakdown.thornsValue
    const sustainMultiplier =
      1 + breakdown.sustain / Math.max(1, pressure + breakdown.effectiveHealth / 20)

    expect(breakdown.power).toBeCloseTo(
      Math.pow(breakdown.effectiveHealth, BATTLE_CONFIG.power.defensePowerWeight) *
        Math.pow(pressure, BATTLE_CONFIG.power.offensePowerWeight) *
        sustainMultiplier,
    )
  })

  it('can scale reference enemy armor for higher power tiers', () => {
    const scaledBreakdown = calculatePower({ ...baseStats, attack: 100, critChance: 0 }, { enemyArmorScale: 2 })

    expect(scaledBreakdown.expectedHitDamage).toBeCloseTo(
      calculateArmorReducedDamage(100, BATTLE_CONFIG.power.averageEnemyArmor * 2),
    )
  })

  it('rewards larger main hits relative to the reference incoming hit', () => {
    const heavyHit = calculatePower({
      ...baseStats,
      attack: 100,
      attackSpeed: 100,
      health: 100,
      armor: 10,
      critChance: 0,
    })
    const smallHit = calculatePower({
      ...baseStats,
      attack: 20,
      attackSpeed: 100,
      health: 100,
      armor: 10,
      critChance: 0,
    })

    expect(heavyHit.hitImpactMultiplier).toBeGreaterThan(1)
    expect(smallHit.hitImpactMultiplier).toBeLessThan(1)
  })

  it('limits hit impact multiplier to configured bounds', () => {
    const hugeHit = calculatePower({
      ...baseStats,
      attack: 10000,
      health: 1,
      armor: 0,
      attackSpeed: 100,
      critChance: 100,
      critDamage: 1000,
    })
    const tinyHit = calculatePower({
      ...baseStats,
      attack: 1,
      health: 1000,
      armor: 100,
      attackSpeed: 100,
      critChance: 0,
    })

    expect(hugeHit.hitImpactMultiplier).toBe(BATTLE_CONFIG.power.maxHitImpactMultiplier)
    expect(tinyHit.hitImpactMultiplier).toBe(BATTLE_CONFIG.power.minHitImpactMultiplier)
  })

  it('calculates effective health through the shared armor damage model', () => {
    const breakdown = calculatePower(baseStats)
    const referenceIncomingHit =
      baseStats.attack * BATTLE_CONFIG.power.referenceAttackWeight +
      (baseStats.health / BATTLE_CONFIG.power.referenceTargetTtk) * BATTLE_CONFIG.power.referenceHealthWeight +
      (baseStats.armor / BATTLE_CONFIG.power.expectedArmorToAttackRatio) * BATTLE_CONFIG.power.referenceArmorWeight
    const incomingDamageAfterArmor = calculateArmorReducedDamage(referenceIncomingHit, baseStats.armor)

    expect(breakdown.effectiveHealth).toBeCloseTo(
      baseStats.health * (referenceIncomingHit / incomingDamageAfterArmor),
    )
  })

  it('values thorns as a percentage of armor', () => {
    const statsWithThorns = { ...baseStats, armor: 200, thorns: 10 }
    const breakdown = calculatePower(statsWithThorns)
    const expectedThornsRawDamage = 200 * 0.1

    expect(breakdown.thornsValue).toBeCloseTo(
      calculateArmorReducedDamage(expectedThornsRawDamage, BATTLE_CONFIG.power.averageEnemyArmor) *
        BATTLE_CONFIG.power.averageIncomingAttackSpeed *
        BATTLE_CONFIG.power.thornsEfficiency,
    )
  })
})
