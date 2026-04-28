import type { Combatant, CombatantStats, PowerBreakdown, Team } from './types'

export const POWER_CONSTANTS = {
  armorScale: 100,
  lifestealEfficiency: 0.65,
  areaEfficiency: 0.55,
  averageExtraTargets: 1.5,
  thornsEfficiency: 0.45,
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
    thorns: Math.max(0, stats.thorns),
  }
}

export function calculatePower(statsInput: CombatantStats): PowerBreakdown {
  const stats = normalizeStats(statsInput)
  const effectiveHealth = stats.health * (1 + stats.armor / POWER_CONSTANTS.armorScale)
  const expectedHitDamage = stats.attack * (1 + stats.critChance * (stats.critDamage - 1))
  const dps = expectedHitDamage * stats.attackSpeed
  const areaMultiplier = 1 + stats.areaAttack * POWER_CONSTANTS.averageExtraTargets * POWER_CONSTANTS.areaEfficiency
  const effectiveDps = dps * areaMultiplier
  const sustain = dps * stats.lifesteal * POWER_CONSTANTS.lifestealEfficiency
  const sustainMultiplier = 1 + sustain / Math.max(1, effectiveDps + effectiveHealth / 20)
  const thornsValue = stats.thorns * Math.sqrt(effectiveHealth) * POWER_CONSTANTS.thornsEfficiency
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
