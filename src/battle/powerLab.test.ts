import { describe, expect, it } from 'vitest'
import { calculatePower } from './power'
import {
  DEFAULT_POWER_LAB_CONFIG,
  generateRandomBuilds,
  runOneVsOneMatrix,
  runPowerLab,
  selectBuildsNearPower,
  tagBuild,
  type PowerLabBuild,
  type PowerLabConfig,
} from './powerLab'
import type { Combatant, CombatantStats } from './types'

const stats: CombatantStats = {
  attack: 30,
  health: 180,
  armor: 20,
  attackSpeed: 100,
  critChance: 10,
  critDamage: 150,
  lifesteal: 0,
  areaAttack: 0,
  thorns: 0,
}

describe('power lab', () => {
  it('generates deterministic builds from a seed', () => {
    const config = testConfig({ candidateCount: 5, seed: 123 })
    const firstRun = generateRandomBuilds(config)
    const secondRun = generateRandomBuilds(config)

    expect(firstRun.map((build) => build.combatant.stats)).toEqual(
      secondRun.map((build) => build.combatant.stats),
    )
  })

  it('selects builds closest to target power within tolerance', () => {
    const targetPower = calculatePower(stats).power
    const nearBuild = createBuild('near', stats)
    const farBuild = createBuild('far', { ...stats, attack: 200 })

    const selected = selectBuildsNearPower([farBuild, nearBuild], testConfig({ targetPower, tolerancePercent: 5 }))

    expect(selected).toEqual([nearBuild])
  })

  it('tags obvious build archetypes', () => {
    expect(
      tagBuild({
        ...stats,
        attack: 70,
        attackSpeed: 200,
        critChance: 40,
        health: 350,
        armor: 70,
        lifesteal: 30,
        thorns: 30,
      }),
    ).toEqual(expect.arrayContaining(['attack-heavy', 'speed-heavy', 'crit-heavy', 'tank-health', 'tank-armor', 'sustain', 'thorns']))
  })

  it('scales absolute archetype thresholds with target power', () => {
    const absoluteStats: CombatantStats = {
      ...stats,
      attack: 70,
      health: 350,
      armor: 70,
      thorns: 30,
    }
    const highTierScale = 1000 / DEFAULT_POWER_LAB_CONFIG.targetPower

    expect(tagBuild(absoluteStats)).toEqual(
      expect.arrayContaining(['attack-heavy', 'tank-health', 'tank-armor', 'thorns']),
    )
    expect(tagBuild(absoluteStats, highTierScale)).not.toEqual(
      expect.arrayContaining(['attack-heavy', 'tank-health', 'tank-armor', 'thorns']),
    )
  })

  it('runs a symmetric one-vs-one matrix', () => {
    const builds = [
      createBuild('one', stats),
      createBuild('two', { ...stats, attack: 35 }),
    ]
    const results = runOneVsOneMatrix(builds, testConfig({ roundsPerPair: 5, seed: 10 }))

    expect(results).toHaveLength(2)
    expect(results[0].battles).toBe(10)
    expect(results[1].battles).toBe(10)
    expect(results[0].wins + results[0].losses + results[0].draws).toBe(10)
    expect(results[1].wins + results[1].losses + results[1].draws).toBe(10)
  })

  it('builds a compact report', () => {
    const report = runPowerLab(testConfig({
      candidateCount: 200,
      selectedBuildCount: 4,
      roundsPerPair: 2,
      targetPower: 120,
      tolerancePercent: 50,
    }))

    expect(report.candidatesGenerated).toBe(200)
    expect(report.builds.length).toBeLessThanOrEqual(4)
    expect(report.topWinners.length).toBeLessThanOrEqual(4)
    expect(report.topLosers.length).toBeLessThanOrEqual(4)
  })

  it('scales absolute stat ranges with target power', () => {
    const report = runPowerLab(testConfig({
      candidateCount: 1,
      selectedBuildCount: 1,
      roundsPerPair: 1,
      targetPower: 1000,
      tolerancePercent: 100,
    }))
    const scale = 1000 / DEFAULT_POWER_LAB_CONFIG.targetPower

    expect(report.config.statRanges.attack.min).toBe(
      Math.round((DEFAULT_POWER_LAB_CONFIG.statRanges.attack.min * scale) / DEFAULT_POWER_LAB_CONFIG.statRanges.attack.step!) *
        DEFAULT_POWER_LAB_CONFIG.statRanges.attack.step!,
    )
    expect(report.config.statRanges.health.min).toBe(
      Math.round((DEFAULT_POWER_LAB_CONFIG.statRanges.health.min * scale) / DEFAULT_POWER_LAB_CONFIG.statRanges.health.step!) *
        DEFAULT_POWER_LAB_CONFIG.statRanges.health.step!,
    )
    expect(report.config.statRanges.armor.min).toBe(
      Math.round((DEFAULT_POWER_LAB_CONFIG.statRanges.armor.min * scale) / DEFAULT_POWER_LAB_CONFIG.statRanges.armor.step!) *
        DEFAULT_POWER_LAB_CONFIG.statRanges.armor.step!,
    )
    expect(report.config.statRanges.attackSpeed).toEqual(DEFAULT_POWER_LAB_CONFIG.statRanges.attackSpeed)
    expect(report.config.statRanges.critChance).toEqual(DEFAULT_POWER_LAB_CONFIG.statRanges.critChance)
  })
})

function testConfig(overrides: Partial<PowerLabConfig> = {}): PowerLabConfig {
  return {
    ...DEFAULT_POWER_LAB_CONFIG,
    candidateCount: 20,
    selectedBuildCount: 4,
    roundsPerPair: 3,
    seed: 1,
    ...overrides,
  }
}

function createBuild(id: string, buildStats: CombatantStats): PowerLabBuild {
  const combatant: Combatant = {
    id,
    name: id,
    stats: buildStats,
  }

  return {
    combatant,
    power: calculatePower(buildStats).power,
    tags: tagBuild(buildStats),
  }
}
