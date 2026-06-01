import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG } from './config'
import {
  calculatePower,
  calculatePowerDefenseScore,
  getPowerReferenceProfile,
  getReferenceIncomingAttackSpeedBase,
  getReferenceStatScales,
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

const proportionalHero: CombatantStats = {
  attack: 25,
  health: 100,
  armor: 10,
  attackSpeed: 100,
  critChance: 0,
  critDamage: 150,
  lifesteal: 0,
  areaAttack: 0,
  thorns: 0,
}

describe('power model D1', () => {
  it('scales power linearly when all core stats scale together', () => {
    const scale = 100
    const small = calculatePower(proportionalHero)
    const large = calculatePower({
      ...proportionalHero,
      attack: proportionalHero.attack * scale,
      health: proportionalHero.health * scale,
      armor: proportionalHero.armor * scale,
    })

    expect(large.dps / small.dps).toBeCloseTo(scale)
    expect(large.effectiveHealth / small.effectiveHealth).toBeCloseTo(scale)
    expect(large.power / small.power).toBeCloseTo(scale)
  })

  it('defense uses Cobb-Douglas vs playerBase (exponents sum to 1)', () => {
    const { health: hRef, defence: aRef } = GEAR_CONFIG.playerBase
    const alpha = BATTLE_CONFIG.power.healthDefenseExponent
    const score = calculatePowerDefenseScore(200, 20)

    expect(score).toBeCloseTo(
      Math.pow(hRef, alpha) *
        Math.pow(aRef, 1 - alpha) *
        Math.pow(200 / hRef, alpha) *
        Math.pow(20 / aRef, 1 - alpha),
    )
  })
})

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

    expect(improvedPower).toBeGreaterThan(basePower)
  })

  it('increases power when attack grows on a tank-heavy build', () => {
    const tankStats: CombatantStats = {
      attack: 123,
      health: 542,
      armor: 422,
      attackSpeed: 123,
      critChance: 5,
      critDamage: 452,
      lifesteal: 42,
      areaAttack: 120,
      thorns: 200,
    }

    expect(calculatePower({ ...tankStats, attack: 150 }).power).toBeGreaterThan(
      calculatePower(tankStats).power,
    )
  })

  it('uses defense score as effectiveHealth in breakdown', () => {
    const breakdown = calculatePower(baseStats)

    expect(breakdown.effectiveHealth).toBeCloseTo(
      calculatePowerDefenseScore(baseStats.health, baseStats.armor),
    )
  })

  it('applies crit to raw attack on main hit', () => {
    const breakdown = calculatePower({
      ...baseStats,
      attack: 100,
      critChance: 100,
      critDamage: 200,
    })

    expect(breakdown.expectedHitDamage).toBeCloseTo(100 * (1 + BATTLE_CONFIG.power.critEfficiency))
  })

  it('values area attack with average extra targets', () => {
    const baseBreakdown = calculatePower(baseStats)
    const areaBreakdown = calculatePower({ ...baseStats, areaAttack: 80 })
    const expectedAreaDps =
      30 *
      0.8 *
      BATTLE_CONFIG.power.averageExtraTargets *
      BATTLE_CONFIG.power.areaEfficiency *
      1

    expect(areaBreakdown.power).toBeGreaterThan(baseBreakdown.power)
    expect(areaBreakdown.dps * areaBreakdown.areaMultiplier - baseBreakdown.dps).toBeCloseTo(
      expectedAreaDps,
    )
  })

  it('does not include area attack damage in sustain', () => {
    const withoutArea = calculatePower({ ...baseStats, lifesteal: 50, areaAttack: 0 })
    const withArea = calculatePower({ ...baseStats, lifesteal: 50, areaAttack: 100 })

    expect(withArea.sustain).toBeCloseTo(withoutArea.sustain)
  })

  it('discounts attack speed above baseline in dps', () => {
    const breakdown = calculatePower({ ...baseStats, attackSpeed: 200, critChance: 0 })
    const expectedAttackSpeed = 1 + (2 - 1) * BATTLE_CONFIG.power.attackSpeedEfficiency

    expect(breakdown.dps).toBeCloseTo(baseStats.attack * expectedAttackSpeed)
  })

  it('combines defense and offense with sustain multiplier', () => {
    const breakdown = calculatePower(baseStats)
    const offenseScore = breakdown.dps * breakdown.areaMultiplier + breakdown.thornsValue
    const sustainMultiplier =
      1 +
      breakdown.sustain /
      Math.max(
        1,
        offenseScore - breakdown.thornsValue + breakdown.effectiveHealth / BATTLE_CONFIG.power.sustainEffectiveHealthDivisor,
      )

    expect(breakdown.hitImpactMultiplier).toBe(1)
    expect(breakdown.power).toBeCloseTo(
      Math.pow(breakdown.effectiveHealth, BATTLE_CONFIG.power.defensePowerWeight) *
        Math.pow(offenseScore, BATTLE_CONFIG.power.offensePowerWeight) *
        sustainMultiplier,
    )
  })

  it('values thorns without target armor mitigation', () => {
    const statsWithThorns = { ...baseStats, armor: 200, thorns: 10 }
    const breakdown = calculatePower(statsWithThorns)

    expect(breakdown.thornsValue).toBeCloseTo(
      200 * 0.1 * getReferenceIncomingAttackSpeedBase() * BATTLE_CONFIG.power.thornsEfficiency,
    )
  })

  it('does not reduce offense when hero armor grows (vacuum offense)', () => {
    const lowArmor = calculatePower({ ...baseStats, armor: 40 }).expectedHitDamage
    const highArmor = calculatePower({ ...baseStats, armor: 400 }).expectedHitDamage

    expect(highArmor).toBeCloseTo(lowArmor)
  })

  it('exposes fixed playerBase reference profile for diagnostics', () => {
    expect(getPowerReferenceProfile()).toEqual({
      attack: GEAR_CONFIG.playerBase.attack,
      armor: GEAR_CONFIG.playerBase.defence,
    })
  })

  it('exposes hero-to-base ratios for diagnostics', () => {
    expect(
      getReferenceStatScales({
        attack: 60,
        health: 200,
        armor: 30,
        attackSpeed: 100,
        critChance: 0,
        critDamage: 150,
        lifesteal: 0,
        areaAttack: 0,
        thorns: 0,
      }),
    ).toEqual({ attack: 2.4, health: 2, armor: 3 })
  })
})
