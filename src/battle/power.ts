import { BATTLE_CONFIG } from './config'
import { GEAR_CONFIG } from './gear/gearConfig'
import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

export interface ReferenceStatScales {
  attack: number
  health: number
  armor: number
}

/** Фиксированный playerBase для диагностик Power Lab (не влияет на силу). */
export interface PowerReferenceProfile {
  attack: number
  armor: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeStats(stats: CombatantStats): CombatantStats {
  return {
    attack: Math.max(0, stats.attack),
    health: Math.max(1, stats.health),
    armor: Math.max(0, stats.armor),
    attackSpeed: Math.max(0.05, stats.attackSpeed / 100),
    critChance: clamp(stats.critChance / 100, 0, 1),
    critDamage: Math.max(1, stats.critDamage / 100),
    lifesteal: clamp(stats.lifesteal / 100, 0, 1),
    areaAttack: clamp(stats.areaAttack / 100, 0, 1),
    thorns: Math.max(0, stats.thorns / 100),
  }
}

function getDefenseReferenceStats(): { health: number; armor: number } {
  const base = GEAR_CONFIG.playerBase

  return { health: base.health, armor: base.defence }
}

/**
 * Defense относительно playerBase: (HP/H₀)^α × (armor/A₀)^(1−α).
 * Степени в сумме = 1 → при HP, armor, atk ×t defense и offense ×t, сила ×t.
 */
export function calculatePowerDefenseScore(health: number, armor: number): number {
  const { healthDefenseExponent } = BATTLE_CONFIG.power
  const { health: hRef, armor: aRef } = getDefenseReferenceStats()
  const armorExponent = 1 - healthDefenseExponent
  const armorForScore = Math.max(armor, aRef * 0.01)

  const hFactor = Math.pow(Math.max(1, health) / hRef, healthDefenseExponent)
  const aFactor = Math.pow(armorForScore / aRef, armorExponent)
  const anchor = Math.pow(hRef, healthDefenseExponent) * Math.pow(aRef, armorExponent)

  return anchor * hFactor * aFactor
}

export function getPowerReferenceProfile(): PowerReferenceProfile {
  const base = GEAR_CONFIG.playerBase

  return {
    attack: base.attack,
    armor: base.defence,
  }
}

/**
 * Модель D1: offense без mit цели; defense только от своих HP/брони.
 * Бой не затрагивается — см. calculateArmorReducedDamage.
 */
export function calculatePower(statsInput: CombatantStats): PowerBreakdown {
  const stats = normalizeStats(statsInput)
  const powerConfig = BATTLE_CONFIG.power

  const offenseHit = stats.attack
  const expectedHitDamage =
    offenseHit * (1 + stats.critChance * (stats.critDamage - 1) * powerConfig.critEfficiency)
  const effectiveAttackSpeed = calculateEffectiveAttackSpeed(stats.attackSpeed)
  const dps = expectedHitDamage * effectiveAttackSpeed
  const areaDps =
    stats.attack *
    stats.areaAttack *
    powerConfig.averageExtraTargets *
    powerConfig.areaEfficiency *
    effectiveAttackSpeed
  const areaMultiplier = dps > 0 ? (dps + areaDps) / dps : 1
  const defenseScore = calculatePowerDefenseScore(stats.health, stats.armor)
  const sustain = dps * stats.lifesteal * powerConfig.lifestealEfficiency
  const offensePressure = dps + areaDps
  const sustainMultiplier =
    1 +
    sustain /
    Math.max(1, offensePressure + defenseScore / powerConfig.sustainEffectiveHealthDivisor)
  const thornsValue =
    stats.armor *
    stats.thorns *
    getReferenceIncomingAttackSpeedBase() *
    powerConfig.thornsEfficiency
  const offenseScore = offensePressure + thornsValue
  const power =
    Math.pow(defenseScore, powerConfig.defensePowerWeight) *
    Math.pow(offenseScore, powerConfig.offensePowerWeight) *
    sustainMultiplier

  return {
    effectiveHealth: defenseScore,
    expectedHitDamage,
    dps,
    sustain,
    areaMultiplier,
    hitImpactMultiplier: 1,
    thornsValue,
    power,
  }
}

function calculateEffectiveAttackSpeed(attackSpeed: number): number {
  return Math.max(
    Number.EPSILON,
    1 + (attackSpeed - 1) * BATTLE_CONFIG.power.attackSpeedEfficiency,
  )
}

/** Базовая скорость для шипов в силе = playerBase.speed. */
export function getReferenceIncomingAttackSpeedBase(): number {
  return Math.max(0.05, GEAR_CONFIG.playerBase.speed / 100)
}

function toReferenceStatScale(stats: CombatantStats): Pick<CombatantStats, 'attack' | 'health' | 'armor'> {
  return {
    attack: Math.max(0, stats.attack),
    health: Math.max(1, stats.health),
    armor: Math.max(0, stats.armor),
  }
}

/** Отношения герой / playerBase — диагностика Power Lab. */
export function getReferenceStatScales(statsInput: CombatantStats): ReferenceStatScales {
  const stats = toReferenceStatScale(statsInput)
  const base = GEAR_CONFIG.playerBase

  return {
    attack: Math.max(Number.EPSILON, stats.attack / Math.max(Number.EPSILON, base.attack)),
    health: Math.max(Number.EPSILON, stats.health / Math.max(1, base.health)),
    armor: Math.max(Number.EPSILON, stats.armor / Math.max(Number.EPSILON, base.defence)),
  }
}

export function calculateCombatantPower(combatant: Combatant): number {
  return calculatePower(combatant.stats).power
}

export function calculateTeamPower(team: Team): number {
  return team.members.reduce((total, member) => total + calculateCombatantPower(member), 0)
}
