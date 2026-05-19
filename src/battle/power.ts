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

export interface PowerCalculationOptions {
  enemyArmorScale?: number
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

export function calculatePower(statsInput: CombatantStats, options: PowerCalculationOptions = {}): PowerBreakdown {
  const stats = normalizeStats(statsInput)
  const powerConfig = BATTLE_CONFIG.power
  const enemyArmorScale = Math.max(Number.EPSILON, options.enemyArmorScale ?? 1)
  const referenceIncomingHit = calculateReferenceIncomingHit(stats)
  const referenceEnemyArmor = calculateReferenceEnemyArmor(stats, enemyArmorScale)
  const incomingDamageAfterArmor = calculateArmorReducedDamage(referenceIncomingHit, stats.armor)
  const effectiveHealth =
    stats.health * (referenceIncomingHit / Math.max(incomingDamageAfterArmor, Number.EPSILON))
  const baseHitAfterArmor = calculateArmorReducedDamage(stats.attack, referenceEnemyArmor)
  const expectedHitDamage =
    baseHitAfterArmor * (1 + stats.critChance * (stats.critDamage - 1) * powerConfig.critEfficiency)
  const effectiveAttackSpeed = calculateEffectiveAttackSpeed(stats.attackSpeed)
  const dps = expectedHitDamage * effectiveAttackSpeed
  const hitImpactMultiplier = calculateHitImpactMultiplier(expectedHitDamage, referenceIncomingHit)
  const weightedDps = dps * hitImpactMultiplier
  const areaHitAfterArmor = calculateArmorReducedDamage(stats.attack * stats.areaAttack, referenceEnemyArmor)
  const areaDps =
    areaHitAfterArmor * powerConfig.averageExtraTargets * powerConfig.areaEfficiency * effectiveAttackSpeed
  const effectiveDps = weightedDps + areaDps
  const areaMultiplier = dps > 0 ? (dps + areaDps) / dps : 1
  const sustain = dps * stats.lifesteal * powerConfig.lifestealEfficiency
  const sustainMultiplier = 1 + sustain / Math.max(1, effectiveDps + effectiveHealth / 20)
  const thornsRawDamage = stats.armor * stats.thorns
  const thornsAfterArmor = calculateArmorReducedDamage(thornsRawDamage, referenceEnemyArmor)
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

/** Броня эталона без scale героя (playerBase.defence). */
export function getReferenceEnemyArmorBase(): number {
  return GEAR_CONFIG.playerBase.defence
}

/** Базовая скорость входящих атак для шипов = playerBase.speed (как normalizeStats: % → множитель). */
export function getReferenceIncomingAttackSpeedBase(): number {
  return Math.max(0.05, GEAR_CONFIG.playerBase.speed / 100)
}

export function calculateReferenceEnemyArmor(
  statsInput: CombatantStats,
  enemyArmorScale = 1,
): number {
  return getScaledReferenceOpponent(statsInput).armor * Math.max(Number.EPSILON, enemyArmorScale)
}

function calculateHitImpactMultiplier(expectedHitDamage: number, referenceIncomingHit: number): number {
  const powerConfig = BATTLE_CONFIG.power
  const hitImpactRatio = expectedHitDamage / Math.max(referenceIncomingHit, Number.EPSILON)
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

export function getReferenceStatScales(statsInput: CombatantStats): ReferenceStatScales {
  const stats = toReferenceStatScale(statsInput)
  const base = GEAR_CONFIG.playerBase

  return {
    attack: Math.max(Number.EPSILON, stats.attack / Math.max(Number.EPSILON, base.attack)),
    health: Math.max(Number.EPSILON, stats.health / Math.max(1, base.health)),
    armor: Math.max(Number.EPSILON, stats.armor / Math.max(Number.EPSILON, base.defence)),
  }
}

/** Общий scale: взвешенное геометрическое среднее отношений герой / playerBase. */
export function getReferenceOpponentScale(statsInput: CombatantStats): number {
  const scales = getReferenceStatScales(statsInput)
  const powerConfig = BATTLE_CONFIG.power

  return (
    Math.pow(scales.attack, powerConfig.opponentScaleAttackWeight) *
    Math.pow(scales.health, powerConfig.opponentScaleHealthWeight) *
    Math.pow(scales.armor, powerConfig.opponentScaleArmorWeight)
  )
}

/** Эталонный противник: playerBase × S (единый scale по геом. среднему). */
export function getScaledReferenceOpponent(statsInput: CombatantStats): ScaledReferenceOpponent {
  const base = GEAR_CONFIG.playerBase
  const scale = getReferenceOpponentScale(statsInput)

  return {
    attack: base.attack * scale,
    health: base.health * scale,
    armor: base.defence * scale,
  }
}

/** Условный входящий удар = атака эталонного противника (oppAttack). */
export function calculateReferenceIncomingHit(statsInput: CombatantStats): number {
  return Math.max(Number.EPSILON, getScaledReferenceOpponent(statsInput).attack)
}

export function calculateCombatantPower(combatant: Combatant): number {
  return calculatePower(combatant.stats).power
}

export function calculateTeamPower(team: Team): number {
  return team.members.reduce((total, member) => total + calculateCombatantPower(member), 0)
}
