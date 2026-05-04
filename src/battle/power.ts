import { BATTLE_CONFIG } from './config'
import { calculateArmorReducedDamage } from './damage'
import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

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

export function calculatePower(statsInput: CombatantStats): PowerBreakdown {
  const stats = normalizeStats(statsInput)
  const powerConfig = BATTLE_CONFIG.power
  const incomingDamageAfterArmor = calculateArmorReducedDamage(powerConfig.averageIncomingHit, stats.armor)
  const effectiveHealth =
    stats.health * (powerConfig.averageIncomingHit / Math.max(incomingDamageAfterArmor, Number.EPSILON))
  const baseHitAfterArmor = calculateArmorReducedDamage(stats.attack, powerConfig.averageEnemyArmor)
  const expectedHitDamage = baseHitAfterArmor * (1 + stats.critChance * (stats.critDamage - 1))
  const dps = expectedHitDamage * stats.attackSpeed
  const areaHitAfterArmor = calculateArmorReducedDamage(stats.attack * stats.areaAttack, powerConfig.averageEnemyArmor)
  const areaDps =
    areaHitAfterArmor * powerConfig.averageExtraTargets * powerConfig.areaEfficiency * stats.attackSpeed
  const effectiveDps = dps + areaDps
  const areaMultiplier = dps > 0 ? effectiveDps / dps : 1
  const sustain = dps * stats.lifesteal * powerConfig.lifestealEfficiency
  const sustainMultiplier = 1 + sustain / Math.max(1, effectiveDps + effectiveHealth / 20)
  const thornsRawDamage = stats.armor * stats.thorns
  const thornsAfterArmor = calculateArmorReducedDamage(thornsRawDamage, powerConfig.averageEnemyArmor)
  const thornsValue = thornsAfterArmor * powerConfig.averageIncomingAttackSpeed * powerConfig.thornsEfficiency
  const power = Math.sqrt(effectiveHealth * (effectiveDps + thornsValue)) * sustainMultiplier

  return {
    effectiveHealth,
    expectedHitDamage,
    dps,
    sustain,
    areaMultiplier,
    thornsValue,
    power,
  }
}

export function calculateCombatantPower(combatant: Combatant): number {
  return calculatePower(combatant.stats).power
}

export function calculateTeamPower(team: Team): number {
  return team.members.reduce((total, member) => total + calculateCombatantPower(member), 0)
}
