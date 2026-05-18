import { describe, expect, it } from 'vitest'
import {
  generateGearBuilds,
  runGearRealisticPowerLab,
  tagGearLoadout,
} from './gearRealisticPowerLab'
import { generateGearLoadout } from './gear/equipment'
import { SeededRandom } from './rng'

describe('gearRealisticPowerLab', () => {
  it('tags loadouts with a single rarity as a set tag', () => {
    const loadout = generateGearLoadout(new SeededRandom(1), { fixedRarityId: 'epic' })

    expect(tagGearLoadout(loadout)).toEqual(['epic-set'])
  })

  it('generates deterministic gear builds from seed', () => {
    const first = generateGearBuilds({
      candidateCount: 3,
      selectedBuildCount: 3,
      roundsPerPair: 1,
      seed: 7,
      targetPower: null,
      tolerancePercent: 5,
      fixedRarityId: null,
    })
    const second = generateGearBuilds({
      candidateCount: 3,
      selectedBuildCount: 3,
      roundsPerPair: 1,
      seed: 7,
      targetPower: null,
      tolerancePercent: 5,
      fixedRarityId: null,
    })

    expect(first.map((build) => build.power)).toEqual(second.map((build) => build.power))
  })

  it('runs a small gear lab report', () => {
    const report = runGearRealisticPowerLab({
      candidateCount: 20,
      selectedBuildCount: 4,
      roundsPerPair: 5,
      seed: 3,
      targetPower: null,
      tolerancePercent: 5,
      fixedRarityId: 'rare',
    })

    expect(report.builds).toHaveLength(4)
    expect(report.nakedHeroPower).toBeGreaterThan(0)
    expect(report.gearTagSummaries.length).toBeGreaterThan(0)
  })
})

