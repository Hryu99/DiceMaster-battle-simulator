import { calculatePower } from './power'
import {
  createPowerLabDiagnostics,
  runOneVsOneMatrix,
  selectBuildsNearPower,
  summarizeOverall,
  summarizeTags,
  tagBuild,
  type PowerLabBuild,
  type PowerLabBuildResult,
  type PowerLabOverallSummary,
  type PowerLabTagSummary,
} from './powerLab'
import {
  buildCombatantStatsFromGear,
  createNakedHeroStats,
  describeGearLoadout,
  generateGearLoadout,
  type GearLoadout,
} from './gear/equipment'
import type { EquipmentRarityId } from './gear/gearConfig'
import { SeededRandom } from './rng'
import type { Combatant, CombatantStats } from './types'

export type GearBuildTag =
  | 'naked'
  | 'common-set'
  | 'rare-set'
  | 'epic-set'
  | 'legendary-set'
  | 'mixed-rarity'

export interface GearRealisticPowerLabConfig {
  candidateCount: number
  selectedBuildCount: number
  roundsPerPair: number
  seed: number
  targetPower: number | null
  tolerancePercent: number
  fixedRarityId: EquipmentRarityId | null
}

export interface GearRealisticBuild extends PowerLabBuild {
  loadout: GearLoadout
  gearTags: GearBuildTag[]
}

export interface GearRealisticBuildResult extends GearRealisticBuild, PowerLabBuildResult {}

export interface GearRealisticPowerLabReport {
  config: GearRealisticPowerLabConfig
  candidatesGenerated: number
  nakedHeroPower: number
  legendaryReferencePower: number | null
  builds: GearRealisticBuildResult[]
  overallSummary: PowerLabOverallSummary
  tagSummaries: PowerLabTagSummary[]
  gearTagSummaries: GearTagSummary[]
  topWinners: GearRealisticBuildResult[]
  topLosers: GearRealisticBuildResult[]
}

export interface GearTagSummary {
  tag: GearBuildTag
  buildCount: number
  averageWinRate: number
  averagePower: number
}

export const DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG: GearRealisticPowerLabConfig = {
  candidateCount: 5000,
  selectedBuildCount: 40,
  roundsPerPair: 100,
  seed: 1,
  targetPower: null,
  tolerancePercent: 5,
  fixedRarityId: null,
}

export function runGearRealisticPowerLab(
  overrides: Partial<GearRealisticPowerLabConfig> = {},
): GearRealisticPowerLabReport {
  const config = { ...DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG, ...overrides }
  const candidates = generateGearBuilds(config)
  const selectedBuilds = selectGearBuilds(candidates, config)
  const matrixConfig = { roundsPerPair: config.roundsPerPair, seed: config.seed }
  const builds = runOneVsOneMatrix(selectedBuilds, matrixConfig) as GearRealisticBuildResult[]

  return {
    config,
    candidatesGenerated: candidates.length,
    nakedHeroPower: calculatePower(createNakedHeroStats()).power,
    legendaryReferencePower: calculateLegendaryReferencePower(),
    builds,
    overallSummary: summarizeOverall(builds),
    tagSummaries: summarizeTags(builds),
    gearTagSummaries: summarizeGearTags(builds),
    topWinners: [...builds].sort((left, right) => right.winRate - left.winRate).slice(0, 10),
    topLosers: [...builds].sort((left, right) => left.winRate - right.winRate).slice(0, 10),
  }
}

export function generateGearBuilds(config: GearRealisticPowerLabConfig): GearRealisticBuild[] {
  const rng = new SeededRandom(config.seed)
  return Array.from({ length: config.candidateCount }, (_, index) => {
    const loadout = generateGearLoadout(rng, {
      fixedRarityId: config.fixedRarityId ?? undefined,
    })
    const stats = buildCombatantStatsFromGear(loadout)
    const breakdown = calculatePower(stats)

    return {
      combatant: createGearCombatant(`gear-build-${index + 1}`, stats),
      power: breakdown.power,
      tags: tagBuild(stats),
      diagnostics: createPowerLabDiagnostics(stats, breakdown),
      loadout,
      gearTags: tagGearLoadout(loadout),
    }
  })
}

export function selectGearBuilds(
  builds: GearRealisticBuild[],
  config: GearRealisticPowerLabConfig,
): GearRealisticBuild[] {
  if (config.targetPower === null) {
    return [...builds]
      .sort((left, right) => right.power - left.power)
      .slice(0, config.selectedBuildCount)
  }

  return selectBuildsNearPower(builds, {
    targetPower: config.targetPower,
    tolerancePercent: config.tolerancePercent,
    selectedBuildCount: config.selectedBuildCount,
  }) as GearRealisticBuild[]
}

export function tagGearLoadout(loadout: GearLoadout): GearBuildTag[] {
  if (loadout.pieces.length === 0) {
    return ['naked']
  }

  const rarityIds = loadout.pieces.map((piece) => piece.rarityId)
  const uniqueRarities = new Set(rarityIds)

  if (uniqueRarities.size === 1) {
    const rarityId = rarityIds[0]
    if (rarityId === 'common') return ['common-set']
    if (rarityId === 'rare') return ['rare-set']
    if (rarityId === 'epic') return ['epic-set']
    if (rarityId === 'legendary') return ['legendary-set']
  }

  return ['mixed-rarity']
}

function createGearCombatant(id: string, stats: CombatantStats): Combatant {
  return {
    id,
    name: `Билд ${id.replace('gear-build-', '')}`,
    stats,
  }
}

function calculateLegendaryReferencePower(): number | null {
  const rng = new SeededRandom(42)
  const loadout = generateGearLoadout(rng, { fixedRarityId: 'legendary' })
  return calculatePower(buildCombatantStatsFromGear(loadout)).power
}

export function summarizeGearTags(builds: GearRealisticBuildResult[]): GearTagSummary[] {
  const groups = new Map<GearBuildTag, { totalWinRate: number; totalPower: number; buildCount: number }>()

  for (const build of builds) {
    for (const tag of build.gearTags) {
      const group = groups.get(tag) ?? { totalWinRate: 0, totalPower: 0, buildCount: 0 }
      group.totalWinRate += build.winRate
      group.totalPower += build.power
      group.buildCount += 1
      groups.set(tag, group)
    }
  }

  return [...groups.entries()]
    .map(([tag, group]) => ({
      tag,
      buildCount: group.buildCount,
      averageWinRate: group.buildCount > 0 ? group.totalWinRate / group.buildCount : 0,
      averagePower: group.buildCount > 0 ? group.totalPower / group.buildCount : 0,
    }))
    .sort((left, right) => right.averageWinRate - left.averageWinRate)
}

export { describeGearLoadout }
