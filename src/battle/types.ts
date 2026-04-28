export type TeamSide = 'A' | 'B'

export interface CombatantStats {
  attack: number
  health: number
  armor: number
  attackSpeed: number
  critChance: number
  critDamage: number
  lifesteal: number
  areaAttack: number
  thorns: number
}

export interface Combatant {
  id: string
  name: string
  stats: CombatantStats
}

export interface Team {
  name: string
  members: Combatant[]
}

export interface BattleOptions {
  seed?: number
  maxTimeSeconds?: number
  maxEvents?: number
  logLimit?: number
}

export interface BattleLogEntry {
  type: 'attack' | 'area'
  time: number
  actor: string
  target: string
  damage: number
  targetHealthAfter: number
  isCrit: boolean
  lifesteal: number
  thorns: number
  defeated: string[]
}

export interface BattleResult {
  winner: TeamSide | 'draw'
  duration: number
  events: number
  remainingHealthA: number
  remainingHealthB: number
  log: BattleLogEntry[]
}

export interface SimulationSummary {
  rounds: number
  winsA: number
  winsB: number
  draws: number
  winRateA: number
  winRateB: number
  averageDuration: number
  averageRemainingHealthA: number
  averageRemainingHealthB: number
  sampleBattle: BattleResult
}

export interface PowerBreakdown {
  effectiveHealth: number
  expectedHitDamage: number
  dps: number
  sustain: number
  areaMultiplier: number
  thornsValue: number
  power: number
}
