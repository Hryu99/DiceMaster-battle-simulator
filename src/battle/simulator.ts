import { calculateArmorReducedDamage } from './damage'
import { normalizeStats } from './power'
import { pickRandom, SeededRandom, type RandomSource } from './rng'
import type {
  BattleLogEntry,
  BattleOptions,
  BattleResult,
  Combatant,
  CombatantStats,
  SimulationSummary,
  Team,
  TeamSide,
} from './types'

interface FighterState {
  instanceId: string
  side: TeamSide
  source: Combatant
  stats: CombatantStats
  health: number
  nextAttackAt: number
  currentTargetId?: string
}

const DEFAULT_OPTIONS = {
  maxTimeSeconds: 180,
  maxEvents: 20000,
  logLimit: 40,
}

export function simulateBattle(teamA: Team, teamB: Team, options: BattleOptions = {}): BattleResult {
  validateTeam(teamA)
  validateTeam(teamB)

  const rng = new SeededRandom(options.seed)
  const settings = { ...DEFAULT_OPTIONS, ...options }
  const fighters = [
    ...createFighters(teamA.members, 'A'),
    ...createFighters(teamB.members, 'B'),
  ]
  const log: BattleLogEntry[] = []
  let time = 0
  let events = 0

  while (events < settings.maxEvents && time <= settings.maxTimeSeconds) {
    const aliveA = aliveFighters(fighters, 'A')
    const aliveB = aliveFighters(fighters, 'B')

    if (aliveA.length === 0 || aliveB.length === 0) {
      return buildResult(fighters, aliveA.length > 0 ? 'A' : 'B', time, events, log)
    }

    const actor = nextActor([...aliveA, ...aliveB], rng)
    time = actor.nextAttackAt

    if (actor.health > 0) {
      performAttack(actor, fighters, rng, log, settings.logLimit, time)
      actor.nextAttackAt += 1 / actor.stats.attackSpeed
      events += 1
    }
  }

  const remainingHealthA = sumHealth(aliveFighters(fighters, 'A'))
  const remainingHealthB = sumHealth(aliveFighters(fighters, 'B'))
  const winner = remainingHealthA === remainingHealthB ? 'draw' : remainingHealthA > remainingHealthB ? 'A' : 'B'

  return buildResult(fighters, winner, time, events, log)
}

export function runSimulations(
  teamA: Team,
  teamB: Team,
  rounds: number,
  options: BattleOptions = {},
): SimulationSummary {
  const safeRounds = Math.max(1, Math.floor(rounds))
  const baseSeed = options.seed ?? 1
  let winsA = 0
  let winsB = 0
  let draws = 0
  let totalDuration = 0
  let totalRemainingHealthA = 0
  let totalRemainingHealthB = 0
  let sampleBattle: BattleResult | undefined

  for (let index = 0; index < safeRounds; index += 1) {
    const result = simulateBattle(teamA, teamB, {
      ...options,
      seed: baseSeed + index,
      logLimit: index === 0 ? options.logLimit : 0,
    })

    sampleBattle ??= result
    totalDuration += result.duration
    totalRemainingHealthA += result.remainingHealthA
    totalRemainingHealthB += result.remainingHealthB

    if (result.winner === 'A') winsA += 1
    else if (result.winner === 'B') winsB += 1
    else draws += 1
  }

  return {
    rounds: safeRounds,
    winsA,
    winsB,
    draws,
    winRateA: winsA / safeRounds,
    winRateB: winsB / safeRounds,
    averageDuration: totalDuration / safeRounds,
    averageRemainingHealthA: totalRemainingHealthA / safeRounds,
    averageRemainingHealthB: totalRemainingHealthB / safeRounds,
    sampleBattle: sampleBattle!,
  }
}

function createFighters(combatants: Combatant[], side: TeamSide): FighterState[] {
  return combatants.map((combatant, index) => {
    const stats = normalizeStats(combatant.stats)
    const interval = 1 / stats.attackSpeed

    return {
      instanceId: `${side}-${combatant.id}-${index}`,
      side,
      source: combatant,
      stats,
      health: stats.health,
      nextAttackAt: interval,
    }
  })
}

function performAttack(
  actor: FighterState,
  fighters: FighterState[],
  rng: RandomSource,
  log: BattleLogEntry[],
  logLimit: number,
  time: number,
): void {
  const enemies = aliveFighters(fighters, actor.side === 'A' ? 'B' : 'A')
  if (enemies.length === 0) return

  const target = getAttackTarget(actor, enemies, rng)
  const isCrit = rng.next() < actor.stats.critChance
  const baseDamage = calculateArmorReducedDamage(actor.stats.attack, target.stats.armor)
  const mainDamage = applyFinalDamage(target, isCrit ? baseDamage * actor.stats.critDamage : baseDamage)
  const mainTargetHealthAfter = target.health
  const mainDefeated = target.health <= 0 ? [target.source.name] : []
  const areaLogEntries: BattleLogEntry[] = []
  const thornsSources = mainDamage > 0 ? [target] : []

  if (actor.stats.areaAttack > 0) {
    const areaDamage = actor.stats.attack * actor.stats.areaAttack
    const areaTargets = aliveFighters(fighters, actor.side === 'A' ? 'B' : 'A')

    for (const areaTarget of areaTargets) {
      const appliedAreaDamage = applyArmorReducedDamage(areaTarget, areaDamage)

      areaLogEntries.push({
        type: 'area',
        time,
        actor: actor.source.name,
        target: areaTarget.source.name,
        damage: appliedAreaDamage,
        targetHealthAfter: areaTarget.health,
        isCrit: false,
        lifesteal: 0,
        thorns: 0,
        defeated: areaTarget.health <= 0 ? [areaTarget.source.name] : [],
      })
    }
  }

  const lifesteal = Math.min(actor.stats.health - actor.health, mainDamage * actor.stats.lifesteal)
  actor.health += lifesteal

  pushLog(log, logLimit, {
    type: 'attack',
    time,
    actor: actor.source.name,
    target: target.source.name,
    damage: mainDamage,
    targetHealthAfter: mainTargetHealthAfter,
    isCrit,
    lifesteal,
    thorns: 0,
    defeated: [...new Set(mainDefeated)],
  })

  for (const areaLogEntry of areaLogEntries) {
    pushLog(log, logLimit, areaLogEntry)
  }

  applyThorns(actor, thornsSources, log, logLimit, time)
}

function getAttackTarget(actor: FighterState, enemies: FighterState[], rng: RandomSource): FighterState {
  const currentTarget = enemies.find((enemy) => enemy.instanceId === actor.currentTargetId)
  if (currentTarget) {
    return currentTarget
  }

  const nextTarget = pickRandom(enemies, rng)
  actor.currentTargetId = nextTarget.instanceId
  return nextTarget
}

function pushLog(log: BattleLogEntry[], logLimit: number, entry: BattleLogEntry): void {
  if (log.length < logLimit) {
    log.push(entry)
  }
}

function applyThorns(
  actor: FighterState,
  thornsSources: FighterState[],
  log: BattleLogEntry[],
  logLimit: number,
  time: number,
): void {
  for (const source of thornsSources) {
    const thornsRawDamage = source.stats.armor * source.stats.thorns
    if (actor.health <= 0 || thornsRawDamage <= 0) continue

    const thornsDamage = applyArmorReducedDamage(actor, thornsRawDamage)

    pushLog(log, logLimit, {
      type: 'thorns',
      time,
      actor: source.source.name,
      target: actor.source.name,
      damage: thornsDamage,
      targetHealthAfter: actor.health,
      isCrit: false,
      lifesteal: 0,
      thorns: thornsDamage,
      defeated: actor.health <= 0 ? [actor.source.name] : [],
    })
  }
}

function applyArmorReducedDamage(target: FighterState, incomingRawDamage: number): number {
  return applyFinalDamage(target, calculateArmorReducedDamage(incomingRawDamage, target.stats.armor))
}

function applyFinalDamage(target: FighterState, damage: number): number {
  const applied = Math.min(target.health, Math.max(0, damage))
  target.health -= applied
  return applied
}

function aliveFighters(fighters: FighterState[], side: TeamSide): FighterState[] {
  return fighters.filter((fighter) => fighter.side === side && fighter.health > 0)
}

function nextActor(fighters: FighterState[], rng: RandomSource): FighterState {
  const nextAttackAt = Math.min(...fighters.map((fighter) => fighter.nextAttackAt))
  const readyFighters = fighters.filter((fighter) => Math.abs(fighter.nextAttackAt - nextAttackAt) < Number.EPSILON)

  return pickRandom(readyFighters, rng)
}

function buildResult(
  fighters: FighterState[],
  winner: BattleResult['winner'],
  duration: number,
  events: number,
  log: BattleLogEntry[],
): BattleResult {
  return {
    winner,
    duration,
    events,
    remainingHealthA: sumHealth(aliveFighters(fighters, 'A')),
    remainingHealthB: sumHealth(aliveFighters(fighters, 'B')),
    log,
  }
}

function sumHealth(fighters: FighterState[]): number {
  return fighters.reduce((total, fighter) => total + fighter.health, 0)
}

function validateTeam(team: Team): void {
  if (team.members.length < 1 || team.members.length > 4) {
    throw new Error(`${team.name} must have from 1 to 4 combatants`)
  }
}
