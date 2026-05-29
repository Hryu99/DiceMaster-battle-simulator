import { describe, expect, it } from 'vitest'
import { BATTLE_CONFIG } from './config'
import {
  calculatePower,
  calculatePowerArmorMitigation,
  calculatePowerDefenseScore,
  calculatePowerEffectiveDamage,
  getPowerArmorContext,
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

const referenceArmor = BATTLE_CONFIG.power.referenceArmorForOffense
const armorK = BATTLE_CONFIG.power.armorRatingConstant

describe('power model B', () => {
  it('mitigation grows with armor and stays below 1', () => {
    expect(calculatePowerArmorMitigation(0)).toBe(0)
    expect(calculatePowerArmorMitigation(armorK)).toBeCloseTo(0.5)
    expect(calculatePowerArmorMitigation(1000)).toBeLessThan(1)
  })

  it('effective damage is linear in attack for fixed armor', () => {
    const low = calculatePowerEffectiveDamage(20, referenceArmor)
    const high = calculatePowerEffectiveDamage(40, referenceArmor)

    expect(high).toBeCloseTo(low * 2)
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

  it('applies crit after power armor on main hit', () => {
    const breakdown = calculatePower({
      ...baseStats,
      attack: 100,
      critChance: 100,
      critDamage: 200,
    })
    const offenseHit = calculatePowerEffectiveDamage(
      100,
      getPowerArmorContext(baseStats.armor).referenceArmor,
      getPowerArmorContext(baseStats.armor).armorRating,
    )

    expect(breakdown.expectedHitDamage).toBeCloseTo(
      offenseHit * (1 + BATTLE_CONFIG.power.critEfficiency),
    )
  })

  it('values area attack with average extra targets', () => {
    const baseBreakdown = calculatePower(baseStats)
    const areaBreakdown = calculatePower({ ...baseStats, areaAttack: 80 })
    const ctx = getPowerArmorContext(baseStats.armor)
    const expectedAreaDps =
      calculatePowerEffectiveDamage(30 * 0.8, ctx.referenceArmor, ctx.armorRating) *
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
    const ctx = getPowerArmorContext(baseStats.armor)
    const offenseHit = calculatePowerEffectiveDamage(baseStats.attack, ctx.referenceArmor, ctx.armorRating)
    const expectedAttackSpeed = 1 + (2 - 1) * BATTLE_CONFIG.power.attackSpeedEfficiency

    expect(breakdown.dps).toBeCloseTo(offenseHit * expectedAttackSpeed)
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

  it('values thorns through power armor against reference armor', () => {
    const statsWithThorns = { ...baseStats, armor: 200, thorns: 10 }
    const breakdown = calculatePower(statsWithThorns)

    const ctx = getPowerArmorContext(statsWithThorns.armor)
    expect(breakdown.thornsValue).toBeCloseTo(
      calculatePowerEffectiveDamage(200 * 0.1, ctx.referenceArmor, ctx.armorRating) *
        getReferenceIncomingAttackSpeedBase() *
        BATTLE_CONFIG.power.thornsEfficiency,
    )
  })

  it('scales armor context with hero armor stat (tier-invariant, not location)', () => {
    const low = getPowerArmorContext(40)
    const high = getPowerArmorContext(400)

    expect(low.armorScale).toBe(1)
    expect(high.armorScale).toBe(10)
    expect(high.referenceArmor).toBeGreaterThan(low.referenceArmor)
    expect(high.armorRating).toBeGreaterThan(low.armorRating)
    expect(
      calculatePowerEffectiveDamage(300, high.referenceArmor, high.armorRating),
    ).toBeLessThan(calculatePowerEffectiveDamage(300, low.referenceArmor, low.armorRating))
  })

  it('exposes reference profile from hero armor for diagnostics', () => {
    expect(getPowerReferenceProfile(40).armor).toBeCloseTo(referenceArmor)
    expect(getPowerReferenceProfile(400).armor).toBeCloseTo(referenceArmor * 10)
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
