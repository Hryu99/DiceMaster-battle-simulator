import { calculatePower } from './power'
import { SeededRandom, type RandomSource } from './rng'
import { runSimulations } from './simulator'
import type { Combatant, CombatantStats, Team } from './types'

export type BuildTag =
  | 'attack-heavy'
  | 'speed-heavy'
  | 'crit-heavy'
  | 'tank-health'
  | 'tank-armor'
  | 'sustain'
  | 'thorns'
  | 'balanced'

export interface StatRange {
  min: number
  max: number
  step?: number
}

export interface PowerLabConfig {
  targetPower: number
  tolerancePercent: number
  candidateCount: number
  selectedBuildCount: number
  roundsPerPair: number
  seed: number
  statRanges: Record<keyof CombatantStats, StatRange>
}

export interface PowerLabBuild {
  combatant: Combatant
  power: number
  tags: BuildTag[]
}

export interface PowerLabBuildResult extends PowerLabBuild {
  wins: number
  losses: number
  draws: number
  battles: number
  winRate: number
  averageRemainingHealth: number
}

export interface PowerLabTagSummary {
  tag: BuildTag
  buildCount: number
  averageWinRate: number
}

export interface PowerLabReport {
  config: PowerLabConfig
  candidatesGenerated: number
  builds: PowerLabBuildResult[]
  tagSummaries: PowerLabTagSummary[]
  topWinners: PowerLabBuildResult[]
  topLosers: PowerLabBuildResult[]
}

const BASE_POWER_FOR_RANGES = 150
const SCALABLE_STAT_KEYS: Array<keyof CombatantStats> = ['attack', 'health', 'armor']

export const DEFAULT_POWER_LAB_CONFIG: PowerLabConfig = {
  targetPower: 150,
  tolerancePercent: 5,
  candidateCount: 5000,
  selectedBuildCount: 40,
  roundsPerPair: 100,
  seed: 1,
  statRanges: {
    attack: { min: 15, max: 80, step: 1 },
    health: { min: 80, max: 400, step: 10 },
    armor: { min: 5, max: 80, step: 1 },
    attackSpeed: { min: 50, max: 250, step: 5 },
    critChance: { min: 0, max: 60, step: 5 },
    critDamage: { min: 120, max: 300, step: 10 },
    lifesteal: { min: 0, max: 40, step: 5 },
    areaAttack: { min: 0, max: 0, step: 1 },
    thorns: { min: 0, max: 40, step: 5 },
  },
}

export function runPowerLab(overrides: Partial<PowerLabConfig> = {}): PowerLabReport {
  const config = mergeConfig(overrides)
  const candidates = generateRandomBuilds(config)
  const selectedBuilds = selectBuildsNearPower(candidates, config)
  const builds = runOneVsOneMatrix(selectedBuilds, config)

  return {
    config,
    candidatesGenerated: candidates.length,
    builds,
    tagSummaries: summarizeTags(builds),
    topWinners: [...builds].sort(byWinRateDesc).slice(0, 10),
    topLosers: [...builds].sort(byWinRateAsc).slice(0, 10),
  }
}

export function generateRandomBuilds(config: PowerLabConfig): PowerLabBuild[] {
  const rng = new SeededRandom(config.seed)

  return Array.from({ length: config.candidateCount }, (_, index) => {
    const stats = generateStats(config.statRanges, rng)
    const combatant = createLabCombatant(`build-${index + 1}`, stats)

    return {
      combatant,
      power: calculatePower(stats).power,
      tags: tagBuild(stats),
    }
  })
}

export function selectBuildsNearPower(builds: PowerLabBuild[], config: PowerLabConfig): PowerLabBuild[] {
  const tolerance = config.targetPower * (config.tolerancePercent / 100)
  const minPower = config.targetPower - tolerance
  const maxPower = config.targetPower + tolerance

  return builds
    .filter((build) => build.power >= minPower && build.power <= maxPower)
    .sort((left, right) => Math.abs(left.power - config.targetPower) - Math.abs(right.power - config.targetPower))
    .slice(0, config.selectedBuildCount)
}

export function runOneVsOneMatrix(builds: PowerLabBuild[], config: PowerLabConfig): PowerLabBuildResult[] {
  const results = builds.map<PowerLabBuildResult>((build) => ({
    ...build,
    wins: 0,
    losses: 0,
    draws: 0,
    battles: 0,
    winRate: 0,
    averageRemainingHealth: 0,
  }))
  const remainingHealthTotals = new Map<string, number>(results.map((result) => [result.combatant.id, 0]))
  let seed = config.seed * 100000

  for (let leftIndex = 0; leftIndex < results.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < results.length; rightIndex += 1) {
      runPair(results[leftIndex], results[rightIndex], config.roundsPerPair, seed, remainingHealthTotals)
      seed += config.roundsPerPair

      runPair(results[rightIndex], results[leftIndex], config.roundsPerPair, seed, remainingHealthTotals)
      seed += config.roundsPerPair
    }
  }

  return results.map((result) => ({
    ...result,
    winRate: result.battles > 0 ? result.wins / result.battles : 0,
    averageRemainingHealth:
      result.battles > 0 ? (remainingHealthTotals.get(result.combatant.id) ?? 0) / result.battles : 0,
  }))
}

export function tagBuild(statsInput: CombatantStats): BuildTag[] {
  const stats = { ...statsInput, areaAttack: 0 }
  const tags: BuildTag[] = []

  if (stats.attack >= 60) tags.push('attack-heavy')
  if (stats.attackSpeed >= 180) tags.push('speed-heavy')
  if (stats.critChance >= 35 || stats.critChance * Math.max(0, stats.critDamage - 100) >= 5000) tags.push('crit-heavy')
  if (stats.health >= 300) tags.push('tank-health')
  if (stats.armor >= 55) tags.push('tank-armor')
  if (stats.lifesteal >= 25) tags.push('sustain')
  if (stats.thorns >= 25 && stats.armor >= 35) tags.push('thorns')

  return tags.length > 0 ? tags : ['balanced']
}

export function summarizeTags(builds: PowerLabBuildResult[]): PowerLabTagSummary[] {
  const groups = new Map<BuildTag, { totalWinRate: number; buildCount: number }>()

  for (const build of builds) {
    for (const tag of build.tags) {
      const group = groups.get(tag) ?? { totalWinRate: 0, buildCount: 0 }
      group.totalWinRate += build.winRate
      group.buildCount += 1
      groups.set(tag, group)
    }
  }

  return [...groups.entries()]
    .map(([tag, group]) => ({
      tag,
      buildCount: group.buildCount,
      averageWinRate: group.buildCount > 0 ? group.totalWinRate / group.buildCount : 0,
    }))
    .sort((left, right) => right.averageWinRate - left.averageWinRate)
}

function mergeConfig(overrides: Partial<PowerLabConfig>): PowerLabConfig {
  const config = {
    ...DEFAULT_POWER_LAB_CONFIG,
    ...overrides,
    statRanges: {
      ...DEFAULT_POWER_LAB_CONFIG.statRanges,
      ...overrides.statRanges,
    },
  }

  return {
    ...config,
    statRanges: scaleStatRanges(config),
  }
}

function scaleStatRanges(config: PowerLabConfig): PowerLabConfig['statRanges'] {
  const scale = Math.max(Number.EPSILON, config.targetPower / BASE_POWER_FOR_RANGES)
  const scaledRanges = { ...config.statRanges }

  for (const key of SCALABLE_STAT_KEYS) {
    scaledRanges[key] = scaleRange(config.statRanges[key], scale)
  }

  return scaledRanges
}

function scaleRange(range: StatRange, scale: number): StatRange {
  const step = range.step ?? 1

  return {
    ...range,
    min: roundToStep(range.min * scale, step),
    max: roundToStep(range.max * scale, step),
  }
}

function roundToStep(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step)
}

function generateStats(ranges: PowerLabConfig['statRanges'], rng: RandomSource): CombatantStats {
  return {
    attack: randomFromRange(ranges.attack, rng),
    health: randomFromRange(ranges.health, rng),
    armor: randomFromRange(ranges.armor, rng),
    attackSpeed: randomFromRange(ranges.attackSpeed, rng),
    critChance: randomFromRange(ranges.critChance, rng),
    critDamage: randomFromRange(ranges.critDamage, rng),
    lifesteal: randomFromRange(ranges.lifesteal, rng),
    areaAttack: randomFromRange(ranges.areaAttack, rng),
    thorns: randomFromRange(ranges.thorns, rng),
  }
}

function randomFromRange(range: StatRange, rng: RandomSource): number {
  const step = range.step ?? 1
  const steps = Math.floor((range.max - range.min) / step)
  return range.min + Math.floor(rng.next() * (steps + 1)) * step
}

function createLabCombatant(id: string, stats: CombatantStats): Combatant {
  return {
    id,
    name: `Билд ${id.replace('build-', '')}`,
    stats,
  }
}

function runPair(
  left: PowerLabBuildResult,
  right: PowerLabBuildResult,
  rounds: number,
  seed: number,
  remainingHealthTotals: Map<string, number>,
): void {
  const summary = runSimulations(createTeam(left.combatant), createTeam(right.combatant), rounds, {
    seed,
    logLimit: 0,
  })

  left.wins += summary.winsA
  left.losses += summary.winsB
  left.draws += summary.draws
  left.battles += summary.rounds
  right.wins += summary.winsB
  right.losses += summary.winsA
  right.draws += summary.draws
  right.battles += summary.rounds
  remainingHealthTotals.set(
    left.combatant.id,
    (remainingHealthTotals.get(left.combatant.id) ?? 0) + summary.averageRemainingHealthA * rounds,
  )
  remainingHealthTotals.set(
    right.combatant.id,
    (remainingHealthTotals.get(right.combatant.id) ?? 0) + summary.averageRemainingHealthB * rounds,
  )
}

function createTeam(combatant: Combatant): Team {
  return {
    name: combatant.name,
    members: [combatant],
  }
}

function byWinRateDesc(left: PowerLabBuildResult, right: PowerLabBuildResult): number {
  return right.winRate - left.winRate
}

function byWinRateAsc(left: PowerLabBuildResult, right: PowerLabBuildResult): number {
  return left.winRate - right.winRate
}
