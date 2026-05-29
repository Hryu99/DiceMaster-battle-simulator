import { calculatePower, getPowerReferenceProfile } from './power'
import { SeededRandom, type RandomSource } from './rng'
import { runSimulations } from './simulator'
import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

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

export interface PowerLabMatrixConfig {
  roundsPerPair: number
  seed: number
}

export interface PowerLabSelectionConfig {
  targetPower: number
  tolerancePercent: number
  selectedBuildCount: number
}

export interface PowerLabConfig extends PowerLabMatrixConfig, PowerLabSelectionConfig {
  candidateCount: number
  statRanges: Record<keyof CombatantStats, StatRange>
}

export interface PowerLabBuild {
  combatant: Combatant
  power: number
  tags: BuildTag[]
  diagnostics: PowerLabDiagnostics
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
  diagnostics: PowerLabDiagnostics
}

export interface PowerLabReport {
  config: PowerLabConfig
  candidatesGenerated: number
  builds: PowerLabBuildResult[]
  overallSummary: PowerLabOverallSummary
  tagSummaries: PowerLabTagSummary[]
  topWinners: PowerLabBuildResult[]
  topLosers: PowerLabBuildResult[]
}

export interface PowerLabOverallSummary {
  buildCount: number
  averagePower: number
  averageWinRate: number
  diagnostics: PowerLabDiagnostics
  armorToOpponentArmorRatio: number
  attackToOpponentArmorRatio: number
}

export interface PowerLabDiagnostics {
  attack: number
  health: number
  armor: number
  attackSpeed: number
  expectedHitDamage: number
  dps: number
  effectiveHealth: number
  sustain: number
  hitImpactMultiplier: number
  hitToReferenceRatio: number
  opponentAttack: number
  opponentArmor: number
  effectiveHealthToDpsRatio: number
  dpsToEffectiveHealthRatio: number
  thornsValue: number
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
    overallSummary: summarizeOverall(builds),
    tagSummaries: summarizeTags(builds),
    topWinners: [...builds].sort(byWinRateDesc).slice(0, 10),
    topLosers: [...builds].sort(byWinRateAsc).slice(0, 10),
  }
}

export function generateRandomBuilds(config: PowerLabConfig): PowerLabBuild[] {
  const rng = new SeededRandom(config.seed)
  const tagScale = getStatScale(config)

  return Array.from({ length: config.candidateCount }, (_, index) => {
    const stats = generateStats(config.statRanges, rng)
    const combatant = createLabCombatant(`build-${index + 1}`, stats)
    const breakdown = calculatePower(stats)

    return {
      combatant,
      power: breakdown.power,
      tags: tagBuild(stats, tagScale),
      diagnostics: createPowerLabDiagnostics(stats, breakdown),
    }
  })
}

export function selectBuildsNearPower(
  builds: PowerLabBuild[],
  config: PowerLabSelectionConfig,
): PowerLabBuild[] {
  const tolerance = config.targetPower * (config.tolerancePercent / 100)
  const minPower = config.targetPower - tolerance
  const maxPower = config.targetPower + tolerance

  return builds
    .filter((build) => build.power >= minPower && build.power <= maxPower)
    .sort((left, right) => Math.abs(left.power - config.targetPower) - Math.abs(right.power - config.targetPower))
    .slice(0, config.selectedBuildCount)
}

export function runOneVsOneMatrix(
  builds: PowerLabBuild[],
  config: PowerLabMatrixConfig,
): PowerLabBuildResult[] {
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

export function tagBuild(statsInput: CombatantStats, scale = 1): BuildTag[] {
  const stats = { ...statsInput, areaAttack: 0 }
  const tags: BuildTag[] = []

  if (stats.attack >= 60 * scale) tags.push('attack-heavy')
  if (stats.attackSpeed >= 180) tags.push('speed-heavy')
  if (stats.critChance >= 35 || stats.critChance * Math.max(0, stats.critDamage - 100) >= 5000) tags.push('crit-heavy')
  if (stats.health >= 300 * scale) tags.push('tank-health')
  if (stats.armor >= 55 * scale) tags.push('tank-armor')
  if (stats.lifesteal >= 25) tags.push('sustain')
  if (stats.thorns >= 25 && stats.armor >= 35 * scale) tags.push('thorns')

  return tags.length > 0 ? tags : ['balanced']
}

export function summarizeTags(builds: PowerLabBuildResult[]): PowerLabTagSummary[] {
  const groups = new Map<BuildTag, { totalWinRate: number; buildCount: number; diagnostics: PowerLabDiagnostics }>()

  for (const build of builds) {
    for (const tag of build.tags) {
      const group = groups.get(tag) ?? {
        totalWinRate: 0,
        buildCount: 0,
        diagnostics: createEmptyDiagnostics(),
      }
      group.totalWinRate += build.winRate
      group.buildCount += 1
      addDiagnostics(group.diagnostics, build.diagnostics)
      groups.set(tag, group)
    }
  }

  return [...groups.entries()]
    .map(([tag, group]) => ({
      tag,
      buildCount: group.buildCount,
      averageWinRate: group.buildCount > 0 ? group.totalWinRate / group.buildCount : 0,
      diagnostics: divideDiagnostics(group.diagnostics, group.buildCount),
    }))
    .sort((left, right) => right.averageWinRate - left.averageWinRate)
}

export function summarizeOverall(builds: PowerLabBuildResult[]): PowerLabOverallSummary {
  const diagnostics = createEmptyDiagnostics()
  let totalPower = 0
  let totalWinRate = 0

  for (const build of builds) {
    addDiagnostics(diagnostics, build.diagnostics)
    totalPower += build.power
    totalWinRate += build.winRate
  }

  const averagedDiagnostics = divideDiagnostics(diagnostics, builds.length)

  return {
    buildCount: builds.length,
    averagePower: builds.length > 0 ? totalPower / builds.length : 0,
    averageWinRate: builds.length > 0 ? totalWinRate / builds.length : 0,
    diagnostics: averagedDiagnostics,
    armorToOpponentArmorRatio:
      averagedDiagnostics.opponentArmor > 0
        ? averagedDiagnostics.armor / averagedDiagnostics.opponentArmor
        : 0,
    attackToOpponentArmorRatio:
      averagedDiagnostics.opponentArmor > 0
        ? averagedDiagnostics.attack / averagedDiagnostics.opponentArmor
        : 0,
  }
}

export function createPowerLabDiagnostics(
  stats: CombatantStats,
  breakdown: PowerBreakdown,
): PowerLabDiagnostics {
  const reference = getPowerReferenceProfile()

  return {
    attack: stats.attack,
    health: stats.health,
    armor: stats.armor,
    attackSpeed: stats.attackSpeed,
    expectedHitDamage: breakdown.expectedHitDamage,
    dps: breakdown.dps,
    effectiveHealth: breakdown.effectiveHealth,
    sustain: breakdown.sustain,
    hitImpactMultiplier: breakdown.hitImpactMultiplier,
    hitToReferenceRatio: breakdown.expectedHitDamage / Math.max(reference.attack, Number.EPSILON),
    opponentAttack: reference.attack,
    opponentArmor: reference.armor,
    effectiveHealthToDpsRatio: breakdown.effectiveHealth / Math.max(breakdown.dps, Number.EPSILON),
    dpsToEffectiveHealthRatio: breakdown.dps / Math.max(breakdown.effectiveHealth, Number.EPSILON),
    thornsValue: breakdown.thornsValue,
  }
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

function createEmptyDiagnostics(): PowerLabDiagnostics {
  return {
    attack: 0,
    health: 0,
    armor: 0,
    attackSpeed: 0,
    expectedHitDamage: 0,
    dps: 0,
    effectiveHealth: 0,
    sustain: 0,
    hitImpactMultiplier: 0,
    hitToReferenceRatio: 0,
    opponentAttack: 0,
    opponentArmor: 0,
    effectiveHealthToDpsRatio: 0,
    dpsToEffectiveHealthRatio: 0,
    thornsValue: 0,
  }
}

function addDiagnostics(target: PowerLabDiagnostics, source: PowerLabDiagnostics): void {
  target.attack += source.attack
  target.health += source.health
  target.armor += source.armor
  target.attackSpeed += source.attackSpeed
  target.expectedHitDamage += source.expectedHitDamage
  target.dps += source.dps
  target.effectiveHealth += source.effectiveHealth
  target.sustain += source.sustain
  target.hitImpactMultiplier += source.hitImpactMultiplier
  target.hitToReferenceRatio += source.hitToReferenceRatio
  target.opponentAttack += source.opponentAttack
  target.opponentArmor += source.opponentArmor
  target.effectiveHealthToDpsRatio += source.effectiveHealthToDpsRatio
  target.dpsToEffectiveHealthRatio += source.dpsToEffectiveHealthRatio
  target.thornsValue += source.thornsValue
}

function divideDiagnostics(diagnostics: PowerLabDiagnostics, divisor: number): PowerLabDiagnostics {
  const safeDivisor = Math.max(1, divisor)

  return {
    attack: diagnostics.attack / safeDivisor,
    health: diagnostics.health / safeDivisor,
    armor: diagnostics.armor / safeDivisor,
    attackSpeed: diagnostics.attackSpeed / safeDivisor,
    expectedHitDamage: diagnostics.expectedHitDamage / safeDivisor,
    dps: diagnostics.dps / safeDivisor,
    effectiveHealth: diagnostics.effectiveHealth / safeDivisor,
    sustain: diagnostics.sustain / safeDivisor,
    hitImpactMultiplier: diagnostics.hitImpactMultiplier / safeDivisor,
    hitToReferenceRatio: diagnostics.hitToReferenceRatio / safeDivisor,
    opponentAttack: diagnostics.opponentAttack / safeDivisor,
    opponentArmor: diagnostics.opponentArmor / safeDivisor,
    effectiveHealthToDpsRatio: diagnostics.effectiveHealthToDpsRatio / safeDivisor,
    dpsToEffectiveHealthRatio: diagnostics.dpsToEffectiveHealthRatio / safeDivisor,
    thornsValue: diagnostics.thornsValue / safeDivisor,
  }
}

function scaleStatRanges(config: PowerLabConfig): PowerLabConfig['statRanges'] {
  const scale = getStatScale(config)
  const scaledRanges = { ...config.statRanges }

  for (const key of SCALABLE_STAT_KEYS) {
    scaledRanges[key] = scaleRange(config.statRanges[key], scale)
  }

  return scaledRanges
}

function getStatScale(config: Pick<PowerLabConfig, 'targetPower'>): number {
  return Math.max(Number.EPSILON, config.targetPower / BASE_POWER_FOR_RANGES)
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
