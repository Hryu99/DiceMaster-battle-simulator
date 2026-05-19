import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG } from './config'
import { calculateArmorReducedDamage } from './damage'
import {
  calculatePower,
  calculateReferenceEnemyArmor,
  calculateReferenceIncomingHit,
  getReferenceEnemyArmorBase,
  getReferenceIncomingAttackSpeedBase,
  getReferenceOpponentScale,
  getReferenceStatScales,
  getScaledReferenceOpponent,
} from './power'
import { GEAR_CONFIG } from './gear/gearConfig'
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
      calculateArmorReducedDamage(30 * 0.8, calculateReferenceEnemyArmor(baseStats)) *
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
      calculateArmorReducedDamage(100, calculateReferenceEnemyArmor({ ...baseStats, attack: 100, critChance: 100, critDamage: 200 })) *
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
      calculateArmorReducedDamage(
        100,
        calculateReferenceEnemyArmor({ ...baseStats, attack: 100, critChance: 100, critDamage: 300, areaAttack: 100 }),
      ) *
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
    const expectedHitDamage = calculateArmorReducedDamage(
      baseStats.attack,
      calculateReferenceEnemyArmor({ ...baseStats, attackSpeed: 200, critChance: 0 }),
    )
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
    const scaledStats = { ...baseStats, attack: 100, critChance: 0 }
    const scaledBreakdown = calculatePower(scaledStats, { enemyArmorScale: 2 })

    expect(scaledBreakdown.expectedHitDamage).toBeCloseTo(
      calculateArmorReducedDamage(100, calculateReferenceEnemyArmor(scaledStats, 2)),
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
    const referenceIncomingHit = calculateReferenceIncomingHit(baseStats)
    const incomingDamageAfterArmor = calculateArmorReducedDamage(referenceIncomingHit, baseStats.armor)

    expect(breakdown.effectiveHealth).toBeCloseTo(
      baseStats.health * (referenceIncomingHit / incomingDamageAfterArmor),
    )
  })

  it('uses scale 1 and mirrors playerBase when hero stats match playerBase', () => {
    const mirrorStats = {
      attack: GEAR_CONFIG.playerBase.attack,
      health: GEAR_CONFIG.playerBase.health,
      armor: GEAR_CONFIG.playerBase.defence,
      attackSpeed: 100,
      critChance: 0,
      critDamage: 150,
      lifesteal: 0,
      areaAttack: 0,
      thorns: 0,
    }

    expect(getReferenceStatScales(mirrorStats)).toEqual({ attack: 1, health: 1, armor: 1 })
    expect(getReferenceOpponentScale(mirrorStats)).toBeCloseTo(1)
    expect(getScaledReferenceOpponent(mirrorStats)).toEqual({
      attack: GEAR_CONFIG.playerBase.attack,
      health: GEAR_CONFIG.playerBase.health,
      armor: GEAR_CONFIG.playerBase.defence,
    })
    expect(calculateReferenceIncomingHit(mirrorStats)).toBeCloseTo(GEAR_CONFIG.playerBase.attack)
  })

  it('combines per-stat scales with weighted geometric mean', () => {
    const heroStats = {
      attack: 60,
      health: 200,
      armor: 30,
      attackSpeed: 100,
      critChance: 0,
      critDamage: 150,
      lifesteal: 0,
      areaAttack: 0,
      thorns: 0,
    }

    expect(getReferenceStatScales(heroStats).attack).toBeCloseTo(2.4)
    expect(getReferenceStatScales(heroStats).health).toBeCloseTo(2)
    expect(getReferenceStatScales(heroStats).armor).toBeCloseTo(3)

    const scale = getReferenceOpponentScale(heroStats)
    expect(scale).toBeCloseTo(2.38, 1)

    const opponent = getScaledReferenceOpponent(heroStats)
    expect(opponent.attack).toBeCloseTo(25 * scale, 1)
    expect(opponent.health).toBeCloseTo(100 * scale, 0)
    expect(opponent.armor).toBeCloseTo(10 * scale, 1)
    expect(calculateReferenceIncomingHit(heroStats)).toBeCloseTo(opponent.attack)
    expect(calculateReferenceEnemyArmor(heroStats)).toBeCloseTo(opponent.armor)
  })

  it('values thorns as a percentage of armor', () => {
    const statsWithThorns = { ...baseStats, armor: 200, thorns: 10 }
    const breakdown = calculatePower(statsWithThorns)
    const expectedThornsRawDamage = 200 * 0.1

    expect(breakdown.thornsValue).toBeCloseTo(
      calculateArmorReducedDamage(expectedThornsRawDamage, calculateReferenceEnemyArmor(statsWithThorns)) *
        getReferenceIncomingAttackSpeedBase() *
        BATTLE_CONFIG.power.thornsEfficiency,
    )
  })
})
