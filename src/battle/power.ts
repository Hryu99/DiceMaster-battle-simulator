import { BATTLE_CONFIG } from './config'
import { calculateArmorReducedDamage } from './damage'
import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

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
  const referenceIncomingHit = calculateReferenceIncomingHit(stats)
  const referenceEnemyArmor = calculateReferenceEnemyArmor(options.enemyArmorScale)
  const incomingDamageAfterArmor = calculateArmorReducedDamage(referenceIncomingHit, stats.armor)
  const effectiveHealth =
    stats.health * (referenceIncomingHit / Math.max(incomingDamageAfterArmor, Number.EPSILON))
  const baseHitAfterArmor = calculateArmorReducedDamage(stats.attack, referenceEnemyArmor)
  const expectedHitDamage = baseHitAfterArmor * (1 + stats.critChance * (stats.critDamage - 1))
  const dps = expectedHitDamage * stats.attackSpeed
  const hitImpactMultiplier = calculateHitImpactMultiplier(expectedHitDamage, referenceIncomingHit)
  const weightedDps = dps * hitImpactMultiplier
  const areaHitAfterArmor = calculateArmorReducedDamage(stats.attack * stats.areaAttack, referenceEnemyArmor)
  const areaDps =
    areaHitAfterArmor * powerConfig.averageExtraTargets * powerConfig.areaEfficiency * stats.attackSpeed
  const effectiveDps = weightedDps + areaDps
  const areaMultiplier = dps > 0 ? (dps + areaDps) / dps : 1
  const sustain = dps * stats.lifesteal * powerConfig.lifestealEfficiency
  const sustainMultiplier = 1 + sustain / Math.max(1, effectiveDps + effectiveHealth / 20)
  const thornsRawDamage = stats.armor * stats.thorns
  const thornsAfterArmor = calculateArmorReducedDamage(thornsRawDamage, referenceEnemyArmor)
  const thornsValue = thornsAfterArmor * powerConfig.averageIncomingAttackSpeed * powerConfig.thornsEfficiency
  const power = Math.sqrt(effectiveHealth * (effectiveDps + thornsValue)) * sustainMultiplier

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

function calculateReferenceEnemyArmor(enemyArmorScale = 1): number {
  const powerConfig = BATTLE_CONFIG.power
  return powerConfig.averageEnemyArmor * Math.max(Number.EPSILON, enemyArmorScale)
}

function calculateHitImpactMultiplier(expectedHitDamage: number, referenceIncomingHit: number): number {
  const powerConfig = BATTLE_CONFIG.power
  const hitImpactRatio = expectedHitDamage / Math.max(referenceIncomingHit, Number.EPSILON)
  const multiplier = 1 + powerConfig.hitImpactEfficiency * (hitImpactRatio - 1)

  return clamp(multiplier, powerConfig.minHitImpactMultiplier, powerConfig.maxHitImpactMultiplier)
}

function calculateReferenceIncomingHit(stats: CombatantStats): number {
  const powerConfig = BATTLE_CONFIG.power
  const attackScale = stats.attack
  const healthScale = stats.health / powerConfig.referenceTargetTtk
  const armorScale = stats.armor / powerConfig.expectedArmorToAttackRatio

  return Math.max(
    Number.EPSILON,
    attackScale * powerConfig.referenceAttackWeight +
      healthScale * powerConfig.referenceHealthWeight +
      armorScale * powerConfig.referenceArmorWeight,
  )
}

export function calculateCombatantPower(combatant: Combatant): number {
  return calculatePower(combatant.stats).power
}

export function calculateTeamPower(team: Team): number {
  return team.members.reduce((total, member) => total + calculateCombatantPower(member), 0)
}
