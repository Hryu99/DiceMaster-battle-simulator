import { BATTLE_CONFIG } from './config'
import { calculateArmorReducedDamage } from './damage'
import { GEAR_CONFIG } from './gear/gearConfig'
import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

export interface ReferenceStatScales {
  attack: number
  health: number
  armor: number
}

export interface ScaledReferenceOpponent {
  attack: number
  health: number
  armor: number
}

/** Параметры расчёта силы: эталонный враг фиксирован по тиру, не от статов героя. */
export interface PowerCalculationOptions {
  /** Целевая сила тира (как targetPower в Power Lab). По умолчанию — referenceTierBasePower. */
  referenceTierPower?: number
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

export function getReferenceTierScale(referenceTierPower?: number): number {
  const baseTier = BATTLE_CONFIG.power.referenceTierBasePower

  return Math.max(Number.EPSILON, (referenceTierPower ?? baseTier) / baseTier)
}

/** Эталонный противник: playerBase × (tierPower / referenceTierBasePower). Не зависит от статов героя. */
export function getFixedReferenceOpponent(options?: PowerCalculationOptions): ScaledReferenceOpponent {
  const base = GEAR_CONFIG.playerBase
  const scale = getReferenceTierScale(options?.referenceTierPower)

  return {
    attack: base.attack * scale,
    health: base.health * scale,
    armor: base.defence * scale,
  }
}

/** @deprecated Используйте getFixedReferenceOpponent — эталон больше не масштабируется от билда. */
export function getScaledReferenceOpponent(
  _statsInput?: CombatantStats,
  options?: PowerCalculationOptions,
): ScaledReferenceOpponent {
  return getFixedReferenceOpponent(options)
}

export function calculatePower(
  statsInput: CombatantStats,
  options?: PowerCalculationOptions,
): PowerBreakdown {
  const stats = normalizeStats(statsInput)
  const powerConfig = BATTLE_CONFIG.power
  const opponent = getFixedReferenceOpponent(options)
  const opponentAttack = Math.max(Number.EPSILON, opponent.attack)
  const opponentArmor = opponent.armor
  const incomingDamageAfterArmor = calculateArmorReducedDamage(opponentAttack, stats.armor)
  const effectiveHealth =
    stats.health * (opponentAttack / Math.max(incomingDamageAfterArmor, Number.EPSILON))
  const baseHitAfterArmor = calculateArmorReducedDamage(stats.attack, opponentArmor)
  const expectedHitDamage =
    baseHitAfterArmor * (1 + stats.critChance * (stats.critDamage - 1) * powerConfig.critEfficiency)
  const effectiveAttackSpeed = calculateEffectiveAttackSpeed(stats.attackSpeed)
  const dps = expectedHitDamage * effectiveAttackSpeed
  const hitImpactMultiplier = calculateHitImpactMultiplier(expectedHitDamage, opponentAttack)
  const weightedDps = dps * hitImpactMultiplier
  const areaHitAfterArmor = calculateArmorReducedDamage(stats.attack * stats.areaAttack, opponentArmor)
  const areaDps =
    areaHitAfterArmor * powerConfig.averageExtraTargets * powerConfig.areaEfficiency * effectiveAttackSpeed
  const effectiveDps = weightedDps + areaDps
  const areaMultiplier = dps > 0 ? (dps + areaDps) / dps : 1
  const sustain = dps * stats.lifesteal * powerConfig.lifestealEfficiency
  const sustainMultiplier =
    1 +
    sustain /
    Math.max(1, effectiveDps + effectiveHealth / powerConfig.sustainEffectiveHealthDivisor)
  const thornsRawDamage = stats.armor * stats.thorns
  const thornsAfterArmor = calculateArmorReducedDamage(thornsRawDamage, opponentArmor)
  const thornsValue =
    thornsAfterArmor * getReferenceIncomingAttackSpeedBase() * powerConfig.thornsEfficiency
  const pressure = effectiveDps + thornsValue
  const power =
    Math.pow(effectiveHealth, powerConfig.defensePowerWeight) *
    Math.pow(pressure, powerConfig.offensePowerWeight) *
    sustainMultiplier

  return {
    effectiveHealth,
    expectedHitDamage,
    dps,
    sustain,
    areaMultiplier,
    hitImpactMultiplier,
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

/** Базовая скорость входящих атак для шипов = playerBase.speed (как normalizeStats: % → множитель). */
export function getReferenceIncomingAttackSpeedBase(): number {
  return Math.max(0.05, GEAR_CONFIG.playerBase.speed / 100)
}

function calculateHitImpactMultiplier(expectedHitDamage: number, opponentAttack: number): number {
  const powerConfig = BATTLE_CONFIG.power
  const hitImpactRatio = expectedHitDamage / Math.max(opponentAttack, Number.EPSILON)
  const multiplier = 1 + powerConfig.hitImpactEfficiency * (hitImpactRatio - 1)

  return clamp(multiplier, powerConfig.minHitImpactMultiplier, powerConfig.maxHitImpactMultiplier)
}

function toReferenceStatScale(stats: CombatantStats): Pick<CombatantStats, 'attack' | 'health' | 'armor'> {
  return {
    attack: Math.max(0, stats.attack),
    health: Math.max(1, stats.health),
    armor: Math.max(0, stats.armor),
  }
}

/** Отношения герой / playerBase — только для диагностик (Arm/Ref Arm и т.п.). */
export function getReferenceStatScales(statsInput: CombatantStats): ReferenceStatScales {
  const stats = toReferenceStatScale(statsInput)
  const base = GEAR_CONFIG.playerBase

  return {
    attack: Math.max(Number.EPSILON, stats.attack / Math.max(Number.EPSILON, base.attack)),
    health: Math.max(Number.EPSILON, stats.health / Math.max(1, base.health)),
    armor: Math.max(Number.EPSILON, stats.armor / Math.max(Number.EPSILON, base.defence)),
  }
}

export function calculateCombatantPower(
  combatant: Combatant,
  options?: PowerCalculationOptions,
): number {
  return calculatePower(combatant.stats, options).power
}

export function calculateTeamPower(team: Team, options?: PowerCalculationOptions): number {
  return team.members.reduce((total, member) => total + calculateCombatantPower(member, options), 0)
}
